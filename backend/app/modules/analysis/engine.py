import re
from dataclasses import dataclass

URL_RE = re.compile(r"https?://[^\s]+", re.I)
UPI_RE = re.compile(r"\b[\w.-]{2,256}@[a-zA-Z]{2,64}\b")
USERNAME_RE = re.compile(r"(?<![\w.])@[a-zA-Z0-9._]{3,30}")


@dataclass(frozen=True)
class Finding:
    result: dict


class PolicyAnalysisEngine:
    """Deterministic safety-first baseline behind a replaceable analysis interface."""

    provider = "local-policy-engine"

    def analyze(self, description: str, evidence_count: int = 0, details: dict | None = None) -> Finding:
        details = details or {}
        text = description.strip()
        lower = text.lower()
        ai = bool(re.search(r"\b(ai|deepfake|fake (video|image|audio)|cloned voice|synthetic|manipulated)\b", lower)) or bool(details.get("aiMisuse", {}).get("suspected"))
        financial = bool(re.search(r"\b(money|upi|payment|investment|transfer|bank|scam|fraud|debit)\b|₹", lower)) or bool(details.get("financial", {}).get("involved"))
        threat = bool(re.search(r"\b(threat|kill|harm|coming for|stalk|blackmail|extort)\b", lower))
        intimate = bool(re.search(r"\b(explicit|intimate|nude|sexual|private photos?)\b", lower))
        child = bool(re.search(r"\b(child|minor|daughter|son|underage)\b", lower))
        active = bool(re.search(r"\b(still live|circulating|being shared|ongoing|spreading)\b", lower))
        loss = financial and bool(re.search(r"\b(transferred|debited|paid|lost|already sent|transaction successful)\b", lower))
        impersonation = bool(re.search(r"\b(?:impersonat\w*|pretending|my face|(?:using|used) my (?:name|identity)|fake.*me|cloned voice|likeness)\b", lower))
        phishing = bool(re.search(r"\b(phish|kyc|password|otp|verification link)\b", lower))

        category, confidence = "Needs review", 0.42
        secondary: list[str] = []
        if child and intimate:
            category, confidence = "Synthetic child-safety risk", 0.96
            secondary.append("Non-consensual intimate content")
        elif ai and impersonation:
            category, confidence = "Synthetic media impersonation", 0.93
        elif threat:
            category, confidence = "Threats, stalking or harassment", 0.90
        elif phishing:
            category, confidence = "Phishing and credential theft", 0.94
        elif financial:
            category, confidence = "Online financial fraud", 0.82
        elif impersonation:
            category, confidence = "Social media impersonation", 0.85
        if financial and category not in {"Online financial fraud", "Phishing and credential theft"}:
            secondary.append("Online financial fraud")

        score = 0
        risks: list[str] = []
        for present, weight, label in [
            (child, 100, "Child safety risk"),
            (threat, 60, "Threat of physical harm or coercion"),
            (intimate, 60, "Possible non-consensual intimate content"),
            (loss, 50, "Reported financial loss"),
            (active, 30, "Content or conduct may still be active"),
            (impersonation, 20, "Identity impersonation"),
        ]:
            if present:
                score += weight
                risks.append(label)
        score = min(score, 100)
        severity = "Critical" if score >= 80 else "High" if score >= 50 else "Medium" if score >= 25 else "Low"
        if confidence < 0.5:
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

        departments = ["General Cybercrime Review"]
        if "Synthetic" in category:
            departments = ["Synthetic Media Review"]
        if financial:
            departments.insert(0, "Financial Fraud Unit")
        if child:
            departments.insert(0, "Women and Child Safety Unit")
        departments = list(dict.fromkeys(departments))
        summary = (
            "The report does not yet contain enough specific information for reliable classification."
            if confidence < 0.5
            else f"The complaint reports a possible {category.lower()} incident that requires human verification."
        )
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
            "aiSuspected": ai,
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
            "reasons": risks or ["Human review is required because automated classification is uncertain."],
            "highlights": [
                {"label": label, "detail": label, "source": "Reporter narrative", "level": "Critical" if severity == "Critical" else "Warning"}
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
                "reasons": [f"The working category is {category}.", "Routing remains subject to officer confirmation."],
            },
            "takedown": {
                "recommended": active and (intimate or impersonation or threat),
                "title": "Preserve evidence before requesting platform action",
                "reasons": ["The harmful content may still be available."] if active else [],
                "preservationSteps": ["Save the URL and account identifier.", "Capture timestamps and unedited screenshots.", "Do not redistribute harmful content."],
            },
            "engine": {
                "mode": "Local fallback",
                "label": "Niriksh policy analysis",
                "mediaReviewed": 0,
                "limitations": ["This baseline analyses structured fields and available text; it does not establish guilt or authenticity."],
            },
        }
        return Finding(result=result)


analysis_engine = PolicyAnalysisEngine()
