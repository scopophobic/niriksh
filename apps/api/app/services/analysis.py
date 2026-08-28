import re

from app.schemas import ComplaintAnalysis, ComplaintAnalysisRequest, Entity

URL_RE = re.compile(r"https?://[^\s]+", re.I)
UPI_RE = re.compile(r"\b[\w.-]{2,256}@[a-zA-Z]{2,64}\b")
USERNAME_RE = re.compile(r"(?<![\w.])@[a-zA-Z0-9._]{3,30}")


class AnalysisService:
    """Deterministic demo provider implementing the same contract as a future LLM adapter."""

    def analyze(self, request: ComplaintAnalysisRequest) -> ComplaintAnalysis:
        text = request.description
        lower = text.lower()
        ai = bool(re.search(r"\b(ai|deepfake|fake video|cloned voice|synthetic|manipulated)\b", lower))
        financial = bool(re.search(r"\b(money|upi|payment|investment|transfer|bank|scam|fraud)\b|₹", lower))
        threat = bool(re.search(r"\b(threat|kill|harm|coming for|stalk)\b", lower))
        intimate = bool(re.search(r"\b(explicit|intimate|nude|sexual)\b", lower))
        child = bool(re.search(r"\b(child|minor|daughter|son|underage)\b", lower))
        active = bool(re.search(r"\b(still live|circulating|being shared|ongoing)\b", lower))
        loss = financial and bool(re.search(r"\b(transferred|debited|paid|lost|already sent)\b", lower))
        impersonation = bool(re.search(r"\b(impersonat|pretending|my face|using my name|fake.*me|cloned voice)\b", lower))

        category, confidence = "unclear_needs_review", .42
        secondary: list[str] = []
        if child and intimate:
            category, confidence = "synthetic_child_safety_risk", .96
            secondary.append("sexual_deepfake")
        elif ai and impersonation:
            category, confidence = "synthetic_media_impersonation", .93
        elif threat:
            category, confidence = "threats", .90
            secondary.append("online_harassment")
        elif re.search(r"phish|kyc|password|otp", lower):
            category, confidence = "phishing", .94
        elif financial:
            category, confidence = "online_financial_fraud", .82
        elif impersonation:
            category, confidence = "social_media_impersonation", .85
        if financial and "financial" not in category and category != "phishing":
            secondary.append("online_financial_fraud")

        score, risks = 0, []
        for present, weight, label in [
            (child, 100, "child_safety_risk"), (threat, 60, "immediate_physical_threat"),
            (intimate, 60, "non_consensual_intimate_content"), (loss, 50, "active_financial_loss"),
            (active, 30, "ongoing_distribution"), (impersonation, 20, "identity_impersonation"),
        ]:
            if present:
                score += weight
                risks.append(label)
        score = min(score, 100)
        severity = "critical" if score >= 80 else "high" if score >= 50 else "medium" if score >= 25 else "low"
        if confidence < .5:
            severity = "needs_review"

        entities: list[Entity] = []
        for platform in ("Instagram", "Facebook", "WhatsApp", "Telegram"):
            if platform.lower() in lower:
                entities.append(Entity(type="platform", value=platform))
        upi_values = UPI_RE.findall(text)
        entities.extend(Entity(type="upi_id", value=value) for value in upi_values)
        entities.extend(Entity(type="username", value=value) for value in USERNAME_RE.findall(text) if value not in upi_values)
        entities.extend(Entity(type="url", value=value.rstrip(".,")) for value in URL_RE.findall(text))

        missing = []
        if not any(entity.type == "platform" for entity in entities): missing.append("source_platform")
        if not any(entity.type in {"url", "username", "upi_id"} for entity in entities): missing.append("source_url_or_account")
        if not re.search(r"\b(today|yesterday|last (night|week|month))\b|\d{1,2}[/-]\d{1,2}", lower): missing.append("approximate_date")
        if request.evidence_count == 0: missing.append("supporting_evidence")
        completeness = max(20, min(96, round(((5 - len(missing) + min(request.evidence_count, 1)) / 5) * 100)))

        departments = ["general_cybercrime"]
        if "synthetic" in category: departments = ["synthetic_media_review"]
        if financial: departments.insert(0, "financial_fraud_unit")
        if child: departments.insert(0, "women_child_safety")
        departments = list(dict.fromkeys(departments))
        summary = ("The report does not contain enough specific information for reliable classification."
                   if confidence < .5 else
                   f"The complaint reports a potential {category.replace('_', ' ')} incident that requires verification.")
        return ComplaintAnalysis(summary=summary, primary_category=category, secondary_categories=secondary,
            confidence=confidence, severity=severity, severity_score=score, risk_factors=risks,
            evidence_completeness=completeness, missing=missing, entities=entities,
            recommended_departments=departments, ai_content_suspected=ai)


analysis_service = AnalysisService()
