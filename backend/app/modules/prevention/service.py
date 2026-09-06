from collections import defaultdict
from datetime import datetime, timezone
from hashlib import sha256

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import CaseIndicator, Complaint, PreventionPattern, PreventionPatternReview, User
from app.modules.audit.service import record_event
from app.modules.connect.service import DISPLAY_TYPES

VALID_STATUSES = {"UNREVIEWED", "VERIFIED", "DISMISSED", "NEEDS_MORE_EVIDENCE"}
DISCLAIMER = "Patterns are advisory clusters of reports. They do not establish a shared offender, identity, guilt, legal responsibility, or coordinated activity."


def _id(value: str) -> str:
    return sha256(value.encode()).hexdigest()[:32]


def _behaviour(cases: list[Complaint]) -> str | None:
    text = " ".join(f"{case.description} {case.summary}".casefold() for case in cases)
    if "investment" in text or "high return" in text or "trading" in text:
        return "Investment or high-return wording → contact or messaging channel → payment request"
    if "impersonat" in text and ("payment" in text or "money" in text):
        return "Impersonation report → contacts approached → payment request"
    if ("urgent" in text or "threat" in text) and ("payment" in text or "upi" in text):
        return "Urgency or authority-style pressure → payment request"
    return None


def _title(cases: list[Complaint], behaviour: str | None) -> str:
    text = " ".join(f"{case.category} {case.description}".casefold() for case in cases)
    if "investment" in text or "high return" in text or "trading" in text:
        return "Investment impersonation / high-return pattern"
    if "impersonat" in text:
        return "Impersonation and payment-request pattern"
    return "Recurring indicator pattern"


def _serialize(pattern: PreventionPattern, cases: dict[str, Complaint]) -> dict:
    support = [cases[item] for item in pattern.supporting_complaints if item in cases]
    first = min((case.created_at for case in support), default=pattern.created_at)
    last = max((case.created_at for case in support), default=pattern.updated_at)
    indicators = pattern.shared_indicators or []
    reasons = [f"{item['type_label']} appears in {item['case_count']} reports" for item in indicators]
    if pattern.behavioural_pattern:
        reasons.append(f"Recurring behavioural context: {pattern.behavioural_pattern}")
    return {
        "id": pattern.id, "title": pattern.title, "status": pattern.status,
        "behavioural_pattern": pattern.behavioural_pattern, "review_note": pattern.review_note,
        "reviewed_at": pattern.reviewed_at, "complaint_count": len(support),
        "first_seen": first, "last_seen": last, "indicators": indicators,
        "supporting_cases": [{"id": case.id, "reference": case.reference, "summary": case.summary, "category": case.category, "status": case.status, "created_at": case.created_at} for case in sorted(support, key=lambda row: row.created_at)],
        "reasons": reasons, "disclaimer": DISCLAIMER,
        "strength": "Strongly supported" if len(indicators) >= 2 and len(support) >= 3 else "Moderately supported",
    }


def aggregate_patterns(db: Session) -> list[PreventionPattern]:
    rows = db.execute(select(CaseIndicator, Complaint).join(Complaint)).all()
    by_key: dict[tuple[str, str], list[tuple[CaseIndicator, Complaint]]] = defaultdict(list)
    for indicator, complaint in rows:
        by_key[(indicator.indicator_type, indicator.normalized_value)].append((indicator, complaint))
    shared = {key: values for key, values in by_key.items() if len({case.id for _, case in values}) >= 2}
    # Union case IDs connected by exact shared indicators. Behaviour only describes an already-exact cluster.
    parent: dict[str, str] = {}
    def find(value: str) -> str:
        parent.setdefault(value, value)
        if parent[value] != value: parent[value] = find(parent[value])
        return parent[value]
    def join(a: str, b: str) -> None:
        a, b = find(a), find(b)
        if a != b: parent[b] = a
    for values in shared.values():
        ids = sorted({case.id for _, case in values})
        for case_id in ids[1:]: join(ids[0], case_id)
    groups: dict[str, set[str]] = defaultdict(set)
    for case_id in parent: groups[find(case_id)].add(case_id)
    created: list[PreventionPattern] = []
    for ids in groups.values():
        cases = {case.id: case for _, case in rows if case.id in ids}
        indicator_items = []
        for (kind, normalized), values in shared.items():
            matching_ids = {case.id for _, case in values}
            if len(matching_ids & ids) >= 2:
                sample = next(row for row, case in values if case.id in ids)
                indicator_items.append({"type": kind, "type_label": DISPLAY_TYPES[kind], "display_value": sample.raw_value, "normalized_value": normalized, "case_count": len(matching_ids & ids), "sources": sorted({row.source_label for row, case in values if case.id in ids})})
        indicator_items.sort(key=lambda item: (-item["case_count"], item["type_label"], item["normalized_value"]))
        cluster_key = sha256("|".join(f"{item['type']}:{item['normalized_value']}" for item in indicator_items).encode()).hexdigest()
        pattern = db.scalar(select(PreventionPattern).where(PreventionPattern.cluster_key == cluster_key))
        behaviour = _behaviour(list(cases.values()))
        if not pattern:
            pattern = PreventionPattern(id=_id(cluster_key), cluster_key=cluster_key, title=_title(list(cases.values()), behaviour))
            db.add(pattern)
            created.append(pattern)
        pattern.shared_indicators = indicator_items
        pattern.supporting_complaints = sorted(ids)
        pattern.behavioural_pattern = behaviour
    db.flush()
    return created


def list_patterns(db: Session) -> list[dict]:
    aggregate_patterns(db)
    # Candidates are durable so a later human review addresses the same explainable cluster.
    db.commit()
    cases = {item.id: item for item in db.scalars(select(Complaint)).all()}
    patterns = db.scalars(select(PreventionPattern).order_by(PreventionPattern.updated_at.desc())).all()
    return [_serialize(pattern, cases) for pattern in patterns]


def get_pattern(db: Session, pattern_id: str) -> dict:
    aggregate_patterns(db)
    db.commit()
    pattern = db.get(PreventionPattern, pattern_id)
    if not pattern: raise LookupError("Pattern not found")
    cases = {item.id: item for item in db.scalars(select(Complaint)).all()}
    result = _serialize(pattern, cases)
    reviews = db.scalars(select(PreventionPatternReview).where(PreventionPatternReview.pattern_id == pattern.id).order_by(PreventionPatternReview.created_at.desc())).all()
    result["review_history"] = [{"status": item.status, "note": item.note, "reviewer": "Authenticated officer" if item.reviewer_id else "System", "created_at": item.created_at} for item in reviews]
    return result


def review_pattern(db: Session, pattern_id: str, status: str, note: str | None, reviewer: User | None) -> dict:
    if status not in VALID_STATUSES: raise ValueError("Invalid pattern review status")
    pattern = db.get(PreventionPattern, pattern_id)
    if not pattern: raise LookupError("Pattern not found")
    pattern.status, pattern.review_note, pattern.reviewed_by = status, (note or None), reviewer.id if reviewer else None
    pattern.reviewed_at = datetime.now(timezone.utc)
    db.add(PreventionPatternReview(pattern_id=pattern.id, status=status, note=note or None, reviewer_id=reviewer.id if reviewer else None))
    record_event(db, "prevention.pattern_reviewed", f"Pattern marked {status.replace('_', ' ').lower()} by human review.", actor=reviewer, data={"pattern_id": pattern.id, "status": status, "note": note or None})
    db.commit()
    return get_pattern(db, pattern_id)


def case_verified_matches(db: Session, complaint_id: str) -> list[dict]:
    indicators = db.scalars(select(CaseIndicator).where(CaseIndicator.complaint_id == complaint_id)).all()
    keys = {(item.indicator_type, item.normalized_value) for item in indicators}
    matches = []
    for pattern in db.scalars(select(PreventionPattern).where(PreventionPattern.status == "VERIFIED")).all():
        shared = [item for item in pattern.shared_indicators if (item["type"], item["normalized_value"]) in keys]
        if shared:
            matches.append({"pattern_id": pattern.id, "pattern_name": pattern.title, "previous_case_count": len(pattern.supporting_complaints), "matched_indicators": shared, "message": "This resembles a previously reviewed pattern. Exercise caution and review the supporting information."})
    return matches
