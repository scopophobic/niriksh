from collections import defaultdict

from sqlalchemy import and_, delete, or_, select
from sqlalchemy.orm import Session

from app.db.models import CaseIndicator, Complaint, EvidenceItem
from app.modules.connect.normalization import (
    IndicatorCandidate,
    classify_value,
    extract_text_candidates,
    normalize_indicator,
)


DISCLAIMER = "Shared identifiers indicate a potential connection only and do not establish common ownership, identity, guilt or offender."
DISPLAY_TYPES = {
    "phone": "Phone",
    "email": "Email",
    "upi": "UPI ID",
    "transaction_id": "Transaction ID / UTR",
    "url": "URL",
    "domain": "Domain",
    "social_handle": "Social handle",
    "bank_account": "Bank / account identifier",
}


def _source_label(value: str | None) -> str:
    if not value or value == "User description":
        return "Reporter narrative"
    return value


def _candidate(
    value: str | None,
    hinted_type: str,
    source: str,
    platform: str | None,
    extraction_source: str = "structured",
) -> IndicatorCandidate | None:
    if not value:
        return None
    indicator_type = classify_value(value, hinted_type)
    if not indicator_type:
        return None
    normalized = normalize_indicator(indicator_type, value, platform)
    if not normalized:
        return None
    return IndicatorCandidate(indicator_type, value.strip(), _source_label(source), extraction_source, metadata={"platform": platform} if platform else {})


def extract_case_candidates(db: Session, complaint: Complaint) -> list[IndicatorCandidate]:
    case = complaint.case_payload or {}
    details = case.get("complaintDetails") or {}
    analysis = case.get("analysisDetails") or {}
    platform = case.get("platform") or details.get("channel")
    candidates = extract_text_candidates(case.get("description", ""), "Reporter narrative", platform=platform)

    facts = analysis.get("facts") or []
    sources_by_value: dict[str, str] = {}
    for fact in facts:
        value = str(fact.get("value") or "").strip()
        if value:
            sources_by_value.setdefault(value.casefold(), _source_label(fact.get("source")))
        candidate = _candidate(value, str(fact.get("label") or ""), fact.get("source") or "Complaint analysis", platform, "analysis_extraction")
        if candidate:
            candidates.append(candidate)

    for entity in case.get("entities") or []:
        value = str(entity.get("value") or "").strip()
        candidate = _candidate(value, str(entity.get("type") or ""), sources_by_value.get(value.casefold(), "Complaint record"), platform, "analysis_extraction")
        if candidate:
            candidates.append(candidate)

    for value, hinted_type, source in [
        (details.get("accountOrUrl"), "reported account", "Form: incident details"),
        ((details.get("financial") or {}).get("transactionId"), "transaction id", "Form: financial details"),
        ((details.get("suspect") or {}).get("phone"), "phone", "Form: submitted identifiers"),
        ((details.get("suspect") or {}).get("email"), "email", "Form: submitted identifiers"),
        ((details.get("suspect") or {}).get("bankAccount"), "bank account", "Form: submitted identifiers"),
        ((details.get("suspect") or {}).get("profileOrWebsite"), "reported account", "Form: submitted identifiers"),
    ]:
        candidate = _candidate(value, hinted_type, source, platform)
        if candidate:
            candidates.append(candidate)
    for transaction_id in (details.get("financial") or {}).get("transactionIds") or []:
        candidate = _candidate(str(transaction_id), "transaction id", "Form: financial details", platform)
        if candidate:
            candidates.append(candidate)
    for value in details.get("suspectIdentifiers") or []:
        candidate = _candidate(str(value), "reported account", "Form: submitted identifiers", platform)
        if candidate:
            candidates.append(candidate)

    evidence = db.scalars(select(EvidenceItem).where(EvidenceItem.complaint_id == complaint.id)).all()
    for item in evidence:
        text = "\n".join(filter(None, [item.extracted_text, item.context_note]))
        candidates.extend(extract_text_candidates(
            text,
            f"Evidence: {item.original_name}",
            source_evidence_id=item.id,
            platform=platform,
        ))
    return candidates


def sync_case_indicators(db: Session, complaint: Complaint) -> list[CaseIndicator]:
    db.execute(delete(CaseIndicator).where(CaseIndicator.complaint_id == complaint.id))
    rows: list[CaseIndicator] = []
    seen: set[tuple[str, str, str]] = set()
    for candidate in extract_case_candidates(db, complaint):
        platform = candidate.metadata.get("platform") if candidate.metadata else None
        normalized = normalize_indicator(candidate.indicator_type, candidate.raw_value, platform)
        key = (candidate.indicator_type, normalized or "", candidate.source_label)
        if not normalized or key in seen:
            continue
        seen.add(key)
        row = CaseIndicator(
            complaint_id=complaint.id,
            indicator_type=candidate.indicator_type,
            raw_value=candidate.raw_value,
            normalized_value=normalized,
            source_evidence_id=candidate.source_evidence_id,
            extraction_source=candidate.extraction_source,
            source_label=candidate.source_label,
            metadata_json=candidate.metadata,
        )
        db.add(row)
        rows.append(row)
    db.flush()
    return rows


def backfill_case_indicators(db: Session) -> int:
    complaints = db.scalars(
        select(Complaint).where(~Complaint.indicators.any()).order_by(Complaint.created_at)
    ).all()
    for complaint in complaints:
        sync_case_indicators(db, complaint)
    return len(complaints)


def _source(row: CaseIndicator, evidence_names: dict[str, str]) -> dict:
    return {
        "label": row.source_label,
        "evidence_id": row.source_evidence_id,
        "evidence_name": evidence_names.get(row.source_evidence_id or ""),
    }


def find_related_incidents(db: Session, complaint_id: str) -> dict:
    complaint = db.get(Complaint, complaint_id)
    if not complaint:
        raise LookupError("Complaint not found")
    current = db.scalars(select(CaseIndicator).where(CaseIndicator.complaint_id == complaint_id)).all()
    keys = {(row.indicator_type, row.normalized_value) for row in current}
    if not keys:
        return {"complaint_id": complaint_id, "reference": complaint.reference, "total": 0, "related_incidents": [], "disclaimer": DISCLAIMER}

    conditions = [and_(CaseIndicator.indicator_type == item_type, CaseIndicator.normalized_value == value) for item_type, value in keys]
    matches = db.execute(
        select(CaseIndicator, Complaint)
        .join(Complaint, Complaint.id == CaseIndicator.complaint_id)
        .where(CaseIndicator.complaint_id != complaint_id, or_(*conditions))
    ).all()
    evidence_ids = {row.source_evidence_id for row in [*current, *(match[0] for match in matches)] if row.source_evidence_id}
    evidence_names = {
        row.id: row.original_name
        for row in db.scalars(select(EvidenceItem).where(EvidenceItem.id.in_(evidence_ids))).all()
    } if evidence_ids else {}
    current_by_key: dict[tuple[str, str], list[CaseIndicator]] = defaultdict(list)
    for row in current:
        current_by_key[(row.indicator_type, row.normalized_value)].append(row)
    related_by_case: dict[str, dict] = {}
    for row, related in matches:
        group = related_by_case.setdefault(related.id, {
            "complaint_id": related.id,
            "reference": related.reference,
            "summary": related.summary,
            "category": related.category,
            "status": related.status,
            "created_at": related.created_at,
            "shared": defaultdict(lambda: {"current": [], "related": []}),
        })
        key = (row.indicator_type, row.normalized_value)
        group["shared"][key]["related"].append(row)
        group["shared"][key]["current"] = current_by_key[key]

    response = []
    for group in related_by_case.values():
        shared_indicators = []
        for (indicator_type, normalized), source_rows in group.pop("shared").items():
            current_rows = source_rows["current"]
            related_rows = source_rows["related"]
            shared_indicators.append({
                "type": indicator_type,
                "type_label": DISPLAY_TYPES[indicator_type],
                "display_value": current_rows[0].raw_value,
                "normalized_value": normalized,
                "current_sources": list({(source["label"], source["evidence_id"], source["evidence_name"]): source for source in (_source(item, evidence_names) for item in current_rows)}.values()),
                "related_sources": list({(source["label"], source["evidence_id"], source["evidence_name"]): source for source in (_source(item, evidence_names) for item in related_rows)}.values()),
            })
        shared_indicators.sort(key=lambda item: (item["type_label"], item["normalized_value"]))
        response.append({**group, "matched_indicator_count": len(shared_indicators), "shared_indicators": shared_indicators})
    response.sort(key=lambda item: (-item["matched_indicator_count"], item["created_at"], item["reference"]))
    return {"complaint_id": complaint_id, "reference": complaint.reference, "total": len(response), "related_incidents": response, "disclaimer": DISCLAIMER}
