"""Subject folders are explicit human choices, never model decisions."""
import json
from copy import deepcopy
from pathlib import Path

CATEGORIES = json.loads(Path(__file__).with_name("categories.json").read_text())

ALIASES = {
    "financial fraud or phishing": "financial",
    "online financial fraud": "financial",
    "social media harassment or impersonation": "social",
    "threatening messages, stalking or blackmail": "harassment",
    "non-consensual intimate content": "sensitive",
    "account compromise or unauthorised access": "access",
    "malware, ransomware or data theft": "systems",
    "other or not sure": "other",
    "not selected — analyse from context": "other",
    "online threats, stalking or harassment": "harassment",
    "ai-generated harmful or deceptive content": "social",
}


def category_for(value=None):
    normalized = str(value or "").strip().lower()
    category_id = ALIASES.get(normalized, normalized)
    return next(
        (c for c in CATEGORIES if category_id in (c["id"], c["label"].lower())),
        CATEGORIES[-1],
    )


def review_case(raw: dict) -> dict:
    case = deepcopy(raw)
    folder = category_for(case.get("reviewCategory") or (case.get("complaintDetails") or {}).get("selectedCategory"))
    case.update(severity="Needs review", severityScore=0, confidence=0, reviewCategory=folder["id"], category=folder["label"], secondary=[])
    # Keep legacy fields neutral for old API clients. No ranking is computed.
    case["department"] = [folder["team"]]
    analysis = case.get("analysisDetails")
    if analysis:
        analysis.update(severity="Needs review", score=0, confidence=0, category=folder["label"], secondary=[], departments=[folder["team"]])
        analysis["highlights"] = [{**h, "level": "Context"} for h in analysis.get("highlights", [])]
        analysis["routing"] = {**analysis.get("routing", {}), "primaryUnit": folder["team"], "supportingUnits": [], "reasons": ["Subject folder selected by a person; reviewer confirms the destination."]}
        for key in ("connected", "multimodal"):
            if isinstance(analysis.get(key), dict):
                for field in ("severity", "score", "confidence", "category", "suspected_ai_manipulation"):
                    analysis[key].pop(field, None)
    return case
