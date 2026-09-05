import re
from dataclasses import dataclass

from app.modules.review.policy import category_for

URL_RE = re.compile(r"https?://[^\s]+", re.I)
UPI_RE = re.compile(r"\b[\w.-]{2,256}@[a-zA-Z]{2,64}\b")
USERNAME_RE = re.compile(r"(?<![\w.])@[a-zA-Z0-9._]{3,30}")


@dataclass(frozen=True)
class Finding:
    result: dict


class PolicyAnalysisEngine:
    """Deterministic intake organiser. It never scores, prioritises, or routes cases."""

    provider = "local-structure-engine"

    def analyze(self, description: str, evidence_count: int = 0, details: dict | None = None) -> Finding:
        details = details or {}
        text = description.strip()
        lower = text.lower()
        financial = bool(re.search(r"\b(money|upi|payment|investment|transfer|bank|scam|fraud|debit)\b|₹", lower)) or bool(details.get("financial", {}).get("involved"))
        threat = bool(re.search(r"\b(threat|kill|harm|coming for|stalk|blackmail|extort)\b", lower))
        intimate = bool(re.search(r"\b(explicit|intimate|nude|sexual|private photos?)\b", lower))
        child = bool(re.search(r"\b(child|minor|daughter|son|underage)\b", lower))
        active = bool(re.search(r"\b(still live|circulating|being shared|ongoing|spreading)\b", lower))
        loss = financial and bool(re.search(r"\b(transferred|debited|paid|lost|already sent|transaction successful)\b", lower))
        impersonation = bool(re.search(r"\b(?:impersonat\w*|pretending|my face|(?:using|used) my (?:name|identity)|fake.*me|cloned voice|likeness)\b", lower))

        folder = category_for(details.get("selectedCategory"))
        category = folder["label"]
        confidence = 0
        secondary: list[str] = []

        # These are literal context markers for a reviewer, never a priority score.
        risks: list[str] = []
        for present, label in [
            (child, "Reporter mentions a child or minor"),
            (threat, "Reporter mentions threatening or coercive language"),
            (intimate, "Reporter mentions intimate material"),
            (loss, "Reporter says money was transferred or debited"),
            (active, "Reporter says the activity may be continuing"),
            (impersonation, "Reporter mentions possible identity misuse"),
        ]:
            if present:
                risks.append(label)
        score = 0
        severity = "Needs review"

        entities: list[dict] = []
        for platform in ("Instagram", "Facebook", "WhatsApp", "Telegram", "YouTube"):
            if platform.lower() in lower:
                entities.append({"type": "Platform", "value": platform})
        upis = UPI_RE.findall(text)
        entities.extend({"type": "UPI ID", "value": value} for value in upis)
        entities.extend({"type": "Username", "value": value} for value in USERNAME_RE.findall(text) if value not in upis)
        entities.extend({"type": "URL", "value": value.rstrip(".,") } for value in URL_RE.findall(text))

        missing: list[str] = []
        if not any(item["type"] == "Platform" for item in entities) and not details.get("channel"):
            missing.append("Source platform or channel")
        if not any(item["type"] in {"URL", "Username", "UPI ID"} for item in entities) and not details.get("accountOrUrl"):
            missing.append("Source URL, account, phone number, or payment identifier")
        if not re.search(r"\b(today|yesterday|last (night|week|month))\b|\d{1,2}[/-]\d{1,2}|\d{4}-\d{2}-\d{2}", lower) and not details.get("incidentDate"):
            missing.append("Approximate incident date")
        if evidence_count == 0:
            missing.append("Supporting evidence, if safely available")
        completeness = max(20, min(96, round(((5 - len(missing) + min(evidence_count, 1)) / 5) * 100)))

        departments = [folder["team"]]
        summary = f"The reporter submitted information for the {category.lower()} subject folder. A reviewer must verify the details."
        primary = departments[0]
        jurisdiction = ", ".join(filter(None, [details.get("district"), details.get("state")])) or "Jurisdiction requires confirmation"
        checks = [
            {"label": "Incident narrative", "status": "Ready" if len(text) >= 60 else "Needs review", "detail": "A reporter-supplied narrative is preserved."},
            {"label": "Source identifiers", "status": "Ready" if entities else "Missing", "detail": "Account, link, platform, or transaction identifiers help verification."},
            {"label": "Evidence", "status": "Ready" if evidence_count else "Missing", "detail": "Original files should be preserved where safely available."},
        ]
        ready = sum(check["status"] == "Ready" for check in checks)
        result = {
            "summary": summary,
            "category": category,
            "secondary": secondary,
            "severity": severity,
            "score": score,
            "completeness": completeness,
            "departments": departments,
            "entities": entities,
            "missing": missing,
            "questions": [f"Can you provide {item.lower()}?" for item in missing[:3]],
            "riskFactors": risks,
            "confidence": confidence,
            "aiSuspected": bool(details.get("aiMisuse", {}).get("suspected")),
            "context": {
                "reporterRole": details.get("reporterRole", "Person affected"),
                "incidentStatus": details.get("incidentStatus", "Not sure"),
                "harm": details.get("aiMisuse", {}).get("harmfulNature", []) or risks,
                "actionsTaken": [],
            },
            "facts": [{"label": item["type"], "value": item["value"], "source": "Reporter narrative"} for item in entities],
            "timeline": [],
            "evidenceAnalysis": [],
            "concerns": [],
            "reasons": risks or ["No listed context marker was found; a human reviewer reads the full complaint."],
            "highlights": [
                {"label": label, "detail": label, "source": "Reporter narrative", "level": "Context"}
                for label in risks[:4]
            ],
            "verification": {
                "readiness": round(ready / len(checks) * 100),
                "readyChecks": ready,
                "totalChecks": len(checks),
                "checks": checks,
                "disclaimer": "Automated output organises allegations; an authorised human must verify evidence and routing.",
            },
            "routing": {
                "status": "Ready for human routing" if completeness >= 60 else "Needs information before routing",
                "jurisdiction": jurisdiction,
                "primaryUnit": primary,
                "supportingUnits": departments[1:],
                "reasons": [f"The reporter selected the {category} subject folder.", "An officer confirms or changes the folder and destination team."],
            },
            "takedown": {
                "recommended": bool(details.get("aiMisuse", {}).get("takedownWanted")),
                "title": "Preserve evidence before requesting platform action",
                "reasons": ["The harmful content may still be available."] if active else [],
                "preservationSteps": ["Save the URL and account identifier.", "Capture timestamps and unedited screenshots.", "Do not redistribute harmful content."],
            },
            "engine": {
                "mode": "Local fallback",
                "label": "Niriksh structured intake",
                "mediaReviewed": 0,
                "limitations": ["This baseline analyses structured fields and available text; it does not establish guilt or authenticity."],
            },
        }
        return Finding(result=result)


analysis_engine = PolicyAnalysisEngine()
