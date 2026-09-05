import re
from dataclasses import dataclass, field
from urllib.parse import SplitResult, urlsplit, urlunsplit


PHONE_RE = re.compile(r"(?<!\d)(?:\+?91[\s().-]?)?[6-9](?:[\s().-]?\d){9}(?!\d)")
EMAIL_RE = re.compile(r"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}\b")
UPI_RE = re.compile(r"\b[\w.-]{2,256}@[a-zA-Z]{2,64}\b")
URL_RE = re.compile(r"https?://[^\s<>\"']+", re.I)
DOMAIN_RE = re.compile(r"(?<![@\w.-])(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}\b")
HANDLE_RE = re.compile(r"(?<![\w.])@[a-zA-Z0-9._]{3,30}")
TRANSACTION_RE = re.compile(r"\b(?:utr|transaction\s*id|txn\s*id)\s*[:#-]?\s*([a-zA-Z0-9-]{8,40})\b", re.I)

TYPE_ALIASES = {
    "phone": "phone",
    "phone number": "phone",
    "email": "email",
    "upi": "upi",
    "upi id": "upi",
    "transaction id": "transaction_id",
    "transaction id / utr": "transaction_id",
    "utr": "transaction_id",
    "url": "url",
    "domain": "domain",
    "username": "social_handle",
    "social handle": "social_handle",
    "reported account": "reported_account",
    "bank account": "bank_account",
    "account identifier": "bank_account",
}


@dataclass(frozen=True)
class IndicatorCandidate:
    indicator_type: str
    raw_value: str
    source_label: str
    extraction_source: str = "deterministic"
    source_evidence_id: str | None = None
    metadata: dict = field(default_factory=dict)


def canonical_type(value: str) -> str | None:
    return TYPE_ALIASES.get(value.strip().casefold())


def classify_value(value: str, hinted_type: str | None = None) -> str | None:
    raw = value.strip().rstrip(".,;)")
    hint = canonical_type(hinted_type or "")
    if hint and hint != "reported_account":
        return hint
    if URL_RE.fullmatch(raw):
        return "url"
    if EMAIL_RE.fullmatch(raw):
        return "email"
    if UPI_RE.fullmatch(raw):
        return "upi"
    if PHONE_RE.fullmatch(raw):
        return "phone"
    if HANDLE_RE.fullmatch(raw) or re.fullmatch(r"[a-zA-Z0-9._]{3,30}", raw):
        return "social_handle"
    if DOMAIN_RE.fullmatch(raw):
        return "domain"
    return None


def _normalise_host(host: str) -> str | None:
    candidate = host.strip().rstrip(".").casefold()
    if not candidate or " " in candidate:
        return None
    try:
        return candidate.encode("idna").decode("ascii")
    except UnicodeError:
        return None


def normalize_indicator(indicator_type: str, value: str, platform: str | None = None) -> str | None:
    raw = value.strip().rstrip(".,;")
    if not raw or len(raw) > 700:
        return None
    if indicator_type == "phone":
        compact = re.sub(r"[\s().-]", "", raw)
        if compact.startswith("00"):
            compact = f"+{compact[2:]}"
        if re.fullmatch(r"[6-9]\d{9}", compact):
            compact = f"+91{compact}"
        elif re.fullmatch(r"91[6-9]\d{9}", compact):
            compact = f"+{compact}"
        return compact if re.fullmatch(r"\+[1-9]\d{7,14}", compact) else None
    if indicator_type == "email":
        match = EMAIL_RE.fullmatch(raw)
        if not match:
            return None
        local, domain = raw.rsplit("@", 1)
        host = _normalise_host(domain)
        return f"{local}@{host}" if host else None
    if indicator_type == "upi":
        return raw.casefold() if UPI_RE.fullmatch(raw) and not EMAIL_RE.fullmatch(raw) else None
    if indicator_type == "domain":
        return _normalise_host(raw)
    if indicator_type == "url":
        try:
            parsed = urlsplit(raw)
            host = _normalise_host(parsed.hostname or "")
            if parsed.scheme.casefold() not in {"http", "https"} or not host:
                return None
            port = parsed.port
            netloc = host
            if port and not ((parsed.scheme.casefold() == "http" and port == 80) or (parsed.scheme.casefold() == "https" and port == 443)):
                netloc = f"{host}:{port}"
            path = parsed.path or "/"
            normalized = urlunsplit(SplitResult(parsed.scheme.casefold(), netloc, path, parsed.query, ""))
            return normalized if len(normalized) <= 500 else None
        except ValueError:
            return None
    if indicator_type == "social_handle":
        handle = raw if raw.startswith("@") else f"@{raw}"
        if not HANDLE_RE.fullmatch(handle):
            return None
        scope = (platform or "unscoped").strip().casefold()
        return f"{scope}:{handle.casefold()}"
    if indicator_type in {"transaction_id", "bank_account"}:
        return raw
    return None


def extract_text_candidates(
    text: str,
    source_label: str,
    *,
    source_evidence_id: str | None = None,
    platform: str | None = None,
) -> list[IndicatorCandidate]:
    if not text:
        return []
    values: list[tuple[str, str]] = []
    urls = [match.group(0).rstrip(".,;)") for match in URL_RE.finditer(text)]
    emails = [match.group(0) for match in EMAIL_RE.finditer(text)]
    upis = [match.group(0) for match in UPI_RE.finditer(text) if match.group(0) not in emails]
    values.extend(("url", value) for value in urls)
    for value in urls:
        try:
            host = urlsplit(value).hostname
            if host:
                values.append(("domain", host))
        except ValueError:
            pass
    values.extend(("email", value) for value in emails)
    values.extend(("upi", value) for value in upis)
    values.extend(("phone", match.group(0)) for match in PHONE_RE.finditer(text))
    values.extend(("transaction_id", match.group(1)) for match in TRANSACTION_RE.finditer(text))
    address_values = [*emails, *upis]
    values.extend(
        ("social_handle", match.group(0))
        for match in HANDLE_RE.finditer(text)
        if not any(match.group(0) in address for address in address_values)
    )
    values.extend(("domain", match.group(0)) for match in DOMAIN_RE.finditer(text))

    seen: set[tuple[str, str]] = set()
    candidates: list[IndicatorCandidate] = []
    for indicator_type, raw in values:
        normalized = normalize_indicator(indicator_type, raw, platform)
        key = (indicator_type, normalized or "")
        if not normalized or key in seen:
            continue
        seen.add(key)
        candidates.append(IndicatorCandidate(
            indicator_type=indicator_type,
            raw_value=raw,
            source_label=source_label,
            source_evidence_id=source_evidence_id,
            metadata={"platform": platform} if indicator_type == "social_handle" and platform else {},
        ))
    return candidates
