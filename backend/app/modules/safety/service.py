import hashlib
import hmac
import re
from datetime import datetime, timezone
from urllib.parse import urlsplit, urlunsplit

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import SuspectIdentifier

OFFICIAL_LOOKUP_URL = "https://cybercrime.gov.in/Webform/suspect_search_repository.aspx"
OFFICIAL_REPORT_URL = "https://www.cybercrime.gov.in/"

PATTERNS = [
    ("credential", "Requests a secret credential", r"\b(otp|one[ -]?time password|pin|password|cvv|recovery code)\b", "Never share an OTP, PIN, CVV, password, or recovery code."),
    ("pressure", "Uses urgency or pressure", r"\b(urgent|immediately|act now|last chance|within \d+ (?:minutes?|hours?)|account (?:will be )?(?:blocked|closed|suspended))\b", "Pause. Verify the request through an independently found official channel."),
    ("payment", "Asks for payment or transfer", r"\b(upi|bank transfer|send money|pay now|processing fee|registration fee|security deposit|qr code)\b", "Do not pay until the person and purpose have been independently verified."),
    ("remote_access", "Asks for device or screen access", r"\b(anydesk|teamviewer|quick support|screen shar(?:e|ing)|remote access|install (?:this|the) app)\b", "Do not install remote-access software or share your screen for an unsolicited request."),
    ("reward", "Promises an unexpected reward or return", r"\b(lottery|prize|cashback|guaranteed returns?|double your money|earn daily|easy income|job offer)\b", "Treat unexpected rewards, jobs, and guaranteed returns with caution."),
    ("threat", "Contains a threat or coercion", r"\b(arrest warrant|legal action|police case|pay or|leak (?:your|the)|share (?:your|the) photos?|blackmail)\b", "Do not comply under pressure. Preserve the message and seek trusted or official help."),
    ("link", "Contains a link to inspect carefully", r"https?://|\b(?:bit\.ly|tinyurl\.com|t\.co|cutt\.ly)/", "Do not open the link from the message. Navigate to the organisation's official site yourself."),
]

PHONE_RE = re.compile(r"(?<!\w)(?:\+?91[-\s]?)?[6-9]\d{9}(?!\w)")
EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I)
UPI_RE = re.compile(r"\b[A-Z0-9._-]{2,}@[A-Z]{2,}\b", re.I)
URL_RE = re.compile(r"https?://[^\s<>'\"]+", re.I)


def infer_type(value: str) -> str:
    value = value.strip()
    if re.fullmatch(r"(?:\+?91[-\s]?)?[6-9]\d{9}", value):
        return "phone"
    if EMAIL_RE.fullmatch(value):
        return "email"
    if UPI_RE.fullmatch(value):
        return "upi"
    if re.match(r"https?://", value, re.I):
        return "url"
    if value.startswith("@"):
        return "social_handle"
    return "other"


def normalize_identifier(value: str, identifier_type: str | None = None) -> tuple[str, str]:
    kind = identifier_type or infer_type(value)
    clean = value.strip()
    if kind == "phone":
        digits = re.sub(r"\D", "", clean)
        clean = digits[-10:]
    elif kind in {"email", "upi", "social_handle", "sms_header"}:
        clean = clean.lower()
    elif kind == "url":
        parsed = urlsplit(clean if "://" in clean else f"https://{clean}")
        clean = urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), parsed.path.rstrip("/") or "/", parsed.query, ""))
    return kind, clean


def mask_value(value: str, kind: str) -> str:
    if kind == "phone":
        return f"******{value[-4:]}"
    if kind in {"email", "upi"} and "@" in value:
        left, right = value.split("@", 1)
        return f"{left[:2]}***@{right}"
    if kind == "url":
        parsed = urlsplit(value)
        return f"{parsed.netloc}/…"
    return f"{value[:2]}***{value[-2:]}" if len(value) > 5 else "***"


def value_hash(value: str, kind: str, secret: str) -> str:
    key = (secret or "change-this-directory-secret").encode()
    return hmac.new(key, f"{kind}:{value}".encode(), hashlib.sha256).hexdigest()


def lookup_identifier(db: Session, raw_value: str, identifier_type: str | None, secret: str) -> dict:
    kind, normalized = normalize_identifier(raw_value, identifier_type)
    digest = value_hash(normalized, kind, secret)
    record = db.scalar(select(SuspectIdentifier).where(
        SuspectIdentifier.identifier_type == kind,
        SuspectIdentifier.value_hash == digest,
    ))
    return {
        "type": kind,
        "masked_value": mask_value(normalized, kind),
        "found": record is not None,
        "status": record.status if record else "no_published_record",
        "report_count": record.report_count if record else 0,
        "last_reported_at": record.last_reported_at if record else None,
        "review_note": record.review_note if record and record.status != "reported" else None,
        "meaning": (
            "A matching identifier appears in Niriksh's privacy-preserving directory. This is a lead, not proof of wrongdoing."
            if record else
            "No matching Niriksh directory record was found. This does not mean the identifier is safe."
        ),
        "official_lookup_url": OFFICIAL_LOOKUP_URL,
    }


def record_identifier(db: Session, raw_value: str, identifier_type: str | None, status: str, note: str | None, secret: str) -> SuspectIdentifier:
    kind, normalized = normalize_identifier(raw_value, identifier_type)
    digest = value_hash(normalized, kind, secret)
    record = db.scalar(select(SuspectIdentifier).where(
        SuspectIdentifier.identifier_type == kind,
        SuspectIdentifier.value_hash == digest,
    ))
    timestamp = datetime.now(timezone.utc)
    if record:
        record.report_count += 1
        record.last_reported_at = timestamp
    else:
        record = SuspectIdentifier(
            identifier_type=kind,
            value_hash=digest,
            masked_value=mask_value(normalized, kind),
            status=status,
            report_count=1,
            first_reported_at=timestamp,
            last_reported_at=timestamp,
        )
        db.add(record)
    if status != "reported":
        record.status = status
        record.review_note = note
        record.reviewed_at = timestamp
    return record


def identifiers_in(text: str) -> list[tuple[str, str]]:
    found: list[tuple[str, str]] = []
    occupied: set[str] = set()
    for kind, regex in (("url", URL_RE), ("email", EMAIL_RE), ("phone", PHONE_RE), ("upi", UPI_RE)):
        for value in regex.findall(text):
            normalized = value.rstrip(".,);]")
            if normalized.lower() in occupied:
                continue
            occupied.add(normalized.lower())
            found.append((kind, normalized))
    return found[:10]


def check_message(db: Session, text: str, secret: str) -> dict:
    signals = []
    actions = []
    for code, title, pattern, action in PATTERNS:
        if re.search(pattern, text, re.I):
            signals.append({"code": code, "title": title, "explanation": action})
            actions.append(action)
    actions.extend([
        "Preserve the original message, sender details, timestamps, and payment references.",
        "If money was transferred, contact your bank immediately and call India's cyber-fraud helpline 1930.",
    ])
    directory = [lookup_identifier(db, value, kind, secret) for kind, value in identifiers_in(text)]
    if len(signals) >= 3:
        assessment = "Several common warning signs found"
    elif signals:
        assessment = "Some common warning signs found"
    else:
        assessment = "No common warning signs found in this text"
    return {
        "assessment": assessment,
        "signal_count": len(signals),
        "signals": signals,
        "actions": list(dict.fromkeys(actions)),
        "directory_matches": directory,
        "disclaimer": "This is rule-based guidance, not a finding that a sender committed a crime. Absence of warning signs or records does not mean a message or identifier is safe.",
        "retention": "The message is analysed in memory and is not saved by this checker.",
        "official_report_url": OFFICIAL_REPORT_URL,
        "official_lookup_url": OFFICIAL_LOOKUP_URL,
    }
