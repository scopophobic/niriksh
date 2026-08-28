from app.schemas import ComplaintAnalysisRequest
from app.services.analysis import analysis_service


def test_featured_scenario_is_critical_and_routed_to_both_teams():
    result = analysis_service.analyze(ComplaintAnalysisRequest(
        description="Someone made a fake AI video of me for an investment scam. It is still live on Instagram at https://instagram.com/demo and my colleague transferred money to returnsfast@upi yesterday.",
        evidence_count=2,
    ))
    assert result.primary_category == "synthetic_media_impersonation"
    assert result.severity == "critical"
    assert "financial_fraud_unit" in result.recommended_departments
    assert "synthetic_media_review" in result.recommended_departments
    assert result.requires_human_review is True


def test_ambiguous_report_admits_uncertainty():
    result = analysis_service.analyze(ComplaintAnalysisRequest(
        description="There are strange things happening to my accounts and videos. Please check.",
    ))
    assert result.primary_category == "unclear_needs_review"
    assert result.severity == "needs_review"
    assert result.confidence < .5


def test_child_safety_hard_escalation():
    result = analysis_service.analyze(ComplaintAnalysisRequest(
        description="A fake explicit image of my minor daughter is circulating online.",
        evidence_count=1,
    ))
    assert result.severity == "critical"
    assert result.severity_score == 100
    assert result.recommended_departments[0] == "women_child_safety"
