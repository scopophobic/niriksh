"""Seed or reset the fictional Report → Understand → Connect demo scenario."""

import argparse
import copy
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.config import get_settings
from app.db.models import Complaint, PreventionPattern, Report
from app.db.session import build_database
from app.modules.complaints.service import sync_case


DEMO_IDS = (
    "demo-connect-a", "demo-connect-b", "demo-connect-c", "demo-connect-d",
    "demo-prevention-e", "demo-prevention-f",
    "demo-arrest-g", "demo-arrest-h", "demo-arrest-i", "demo-arrest-j",
    "demo-parcel-k", "demo-parcel-l", "demo-parcel-m", "demo-parcel-n",
)

# Public-source synthesis, not a scraped article corpus. Each fixture paraphrases a
# documented pattern and uses reserved/example identifiers so the graph is useful
# without importing real victims, suspects, accounts, domains, or evidence.
RESEARCH_CLUSTERS = (
    {
        "slug": "ransomware-recovery", "title": "CISA #StopRansomware Guide", "url": "https://www.cisa.gov/stopransomware/ransomware-guide",
        "category": "access", "platform": "Email / Network", "shared": [("Domain", "research-ransomware.example"), ("Email", "restore@research-ransomware.example")],
        "theme": "ransomware response, recovery planning, and lessons learned",
    },
    {
        "slug": "fake-shopping", "title": "Europol fraudulent shopping sites case", "url": "https://www.europol.europa.eu/media-press/newsroom/news/fraudulent-shopping-sites-tied-to-cybercrime-marketplace-taken-offline",
        "category": "financial", "platform": "Web / Search", "shared": [("Domain", "research-shopping.example"), ("UPI ID", "research-shopping@upi")],
        "theme": "fraudulent shopping sites and payment collection",
    },
    {
        "slug": "bill-impersonation", "title": "FTC bill-payment impersonator case", "url": "https://consumer.ftc.gov/consumer-alerts/2024/04/pay-your-bills-not-impersonators",
        "category": "financial", "platform": "Search / Web", "shared": [("Domain", "research-billing.example"), ("UPI ID", "research-billing@upi")],
        "theme": "business impersonation and misleading payment destinations",
    },
    {
        "slug": "business-email", "title": "FBI IC3 2024 Annual Report", "url": "https://www.ic3.gov/AnnualReport/Reports/2024_IC3Report.pdf",
        "category": "financial", "platform": "Email", "shared": [("Email", "accounts@research-vendor.example"), ("Transaction ID / UTR", "DEMO-BEC-2026")],
        "theme": "business email compromise and redirected payments",
    },
    {
        "slug": "investment-scam", "title": "INTERPOL Operation First Light", "url": "https://www.interpol.int/News-and-Events/News/2024/USD-257-million-seized-in-global-police-crackdown-against-online-scams",
        "category": "financial", "platform": "Telegram / Web", "shared": [("Domain", "research-investment.example"), ("UPI ID", "research-investment@upi"), ("Social handle", "@research_invest_demo")],
        "theme": "investment, phishing, and impersonation scam infrastructure",
    },
    {
        "slug": "romance-scam", "title": "INTERPOL Operation Contender 3.0", "url": "https://www.interpol.int/en/News-and-Events/News/2025/260-suspected-scammers-arrested-in-pan-African-cybercrime-operation",
        "category": "social", "platform": "Social media", "shared": [("Social handle", "@research_romance_demo"), ("Domain", "research-romance.example")],
        "theme": "romance approaches and coercive requests for money",
    },
    {
        "slug": "mobile-loan", "title": "INTERPOL Operation Red Card 2.0", "url": "https://www.interpol.int/en/News-and-Events/News/2026/Major-operation-in-Africa-targeting-online-scams-nets-651-arrests-recovers-USD-4.3-million",
        "category": "financial", "platform": "Mobile app / Messaging", "shared": [("Domain", "research-loans.example"), ("UPI ID", "research-loans@upi")],
        "theme": "fraudulent mobile-loan applications, fees, and data harvesting",
    },
    {
        "slug": "call-centre", "title": "Europol online fraud call-centre operation", "url": "https://www.europol.europa.eu/media-press/newsroom/news/call-centres-dismantled-and-ten-arrested-in-eur-50-million-online-fraud-case",
        "category": "financial", "platform": "Phone / Web", "shared": [("Phone", "+12025550101"), ("Domain", "research-callcentre.example")],
        "theme": "call-centre social engineering and fake investment platforms",
    },
    {
        "slug": "authority-scam", "title": "INTERPOL Operation Ramz", "url": "https://www.interpol.int/en/News-and-Events/News/2026/201-arrests-in-first-of-its-kind-cybercrime-operation-in-MENA-region",
        "category": "financial", "platform": "Phone / Web", "shared": [("Phone", "+12025550102"), ("Domain", "research-authority.example")],
        "theme": "authority impersonation, phishing, and fake trading platforms",
    },
    {
        "slug": "council-ransomware", "title": "Tewkesbury Borough Council cyber incident case study", "url": "https://www2.local.gov.uk/case-studies/tewkesbury-borough-council-managing-cyber-incident",
        "category": "access", "platform": "Network / Email", "shared": [("Domain", "research-council.example"), ("Email", "it-response@research-council.example")],
        "theme": "organisational disruption, escalation, and incident recovery",
    },
)

RESEARCH_DEMO_IDS = tuple(
    f"research-{cluster['slug']}-{index:02d}"
    for cluster in RESEARCH_CLUSTERS
    for index in range(1, 5)
)
DEMO_IDS = DEMO_IDS + RESEARCH_DEMO_IDS


def evidence(name: str, extracted_text: str) -> dict:
    return {
        "name": name,
        "type": "Document",
        "size": f"{max(1, len(extracted_text.encode('utf-8')) // 1000 + 1)} KB",
        "mimeType": "text/plain",
        "extractedText": extracted_text,
        "purpose": "Supporting evidence",
        "originality": "Demo",
        "demo": True,
    }


def analysis(
    *,
    summary: str,
    category: str,
    team: str,
    entities: list[dict],
    facts: list[dict],
    timeline: list[dict],
    highlights: list[dict],
    missing: list[str],
    evidence_items: list[dict],
    incident_status: str,
) -> dict:
    checks = [
        {"label": "Incident narrative", "status": "Ready", "detail": "A reporter-supplied narrative is preserved."},
        {"label": "Source identifiers", "status": "Ready" if entities else "Missing", "detail": "Explicit submitted identifiers are available for checking."},
        {"label": "Evidence", "status": "Ready", "detail": f"{len(evidence_items)} fictional evidence records are attached."},
    ]
    ready = sum(item["status"] == "Ready" for item in checks)
    return {
        "summary": summary,
        "category": category,
        "secondary": [],
        "severity": "Needs review",
        "score": 0,
        "completeness": max(40, 96 - len(missing) * 10),
        "departments": [team],
        "entities": entities,
        "missing": missing,
        "questions": [f"Can you provide {item.lower()}?" for item in missing],
        "riskFactors": [item["label"] for item in highlights],
        "confidence": 0,
        "aiSuspected": False,
        "context": {
            "reporterRole": "Person affected",
            "incidentStatus": incident_status,
            "harm": ["Account access", "Identity or reputation", "Possible financial loss"],
            "actionsTaken": ["Changed a recovery password", "Saved copies of messages"],
        },
        "facts": facts,
        "timeline": timeline,
        "evidenceAnalysis": [
            {
                "fileName": item["name"],
                "status": "Content reviewed",
                "observations": ["Text in this fictional fixture was included in the structured case."],
                "limitations": ["Fictional demo material; not a real complaint or forensic finding."],
            }
            for item in evidence_items
        ],
        "concerns": [],
        "reasons": ["The complaint is organised for human review without automated priority scoring."],
        "highlights": highlights,
        "verification": {
            "readiness": round(ready / len(checks) * 100),
            "readyChecks": ready,
            "totalChecks": len(checks),
            "checks": checks,
            "disclaimer": "Readiness means the case is organised for checking; it does not establish truth or authenticity.",
        },
        "routing": {
            "status": "Ready for human routing",
            "jurisdiction": "Demo jurisdiction — requires human confirmation",
            "primaryUnit": team,
            "supportingUnits": [],
            "reasons": ["The subject folder was selected for this fictional fixture; a person confirms the destination."],
        },
        "takedown": {"recommended": False, "title": "Platform guidance not requested", "reasons": [], "preservationSteps": []},
        "engine": {
            "mode": "Local fallback",
            "label": "Fictional demo fixture",
            "mediaReviewed": 0,
            "limitations": ["Seeded output is provided only for a repeatable product demonstration."],
        },
    }


def compact_demo_case(
    *,
    case_id: str,
    reference: str,
    description: str,
    summary: str,
    review_category: str,
    category: str,
    status: str,
    created_at: str,
    created_label: str,
    platform: str,
    state: str,
    team: str,
    entities: list[dict],
    evidence_name: str,
    evidence_text: str,
) -> dict:
    evidence_items = [evidence(evidence_name, evidence_text)]
    facts = [
        {"label": item["type"], "value": item["value"], "source": f"Evidence: {evidence_name}"}
        for item in entities
    ]
    return {
        "id": case_id,
        "reference": reference,
        "description": description,
        "summary": summary,
        "reviewCategory": review_category,
        "category": category,
        "secondary": [],
        "severity": "Needs review",
        "severityScore": 0,
        "status": status,
        "completeness": 88,
        "aiSuspected": False,
        "createdAt": created_at,
        "createdLabel": created_label,
        "platform": platform,
        "location": f"Demo district, {state}",
        "department": [team],
        "entities": entities,
        "evidence": evidence_items,
        "missing": [],
        "riskFactors": [],
        "confidence": 0,
        "analysisDetails": analysis(
            summary=summary,
            category=category,
            team=team,
            entities=entities,
            facts=facts,
            timeline=[{
                "when": created_label.replace("Demo · ", ""),
                "what": "Fictional suspicious contact received",
                "source": f"Evidence: {evidence_name}",
                "precision": "Approximate",
            }],
            highlights=[],
            missing=[],
            evidence_items=evidence_items,
            incident_status="Not sure",
        ),
        "complaintDetails": {
            "selectedCategory": review_category,
            "state": state,
            "channel": platform,
            "incidentStatus": "Not sure",
            "reporterRole": "Person affected",
            "declarationConfirmed": True,
        },
    }


def build_research_cases() -> list[dict]:
    """Create fictional, source-attributed case-study syntheses.

    Only short paraphrased themes are retained. Source URLs live in metadata,
    while all indicators use reserved/example values that cannot point to a real
    account or infrastructure.
    """
    cases: list[dict] = []
    for cluster_index, cluster in enumerate(RESEARCH_CLUSTERS):
        for case_index in range(1, 5):
            case_id = f"research-{cluster['slug']}-{case_index:02d}"
            reference = f"CYB-2026-R{cluster_index * 4 + case_index:03d}"
            entities = [{"type": kind, "value": value} for kind, value in cluster["shared"]]
            # Vary the path while keeping the domain and the other explicit
            # identifiers exact, producing explainable multi-case clusters.
            path = f"/fixture/{case_index}"
            if any(kind == "Domain" for kind, _ in cluster["shared"]):
                domain = next(value for kind, value in cluster["shared"] if kind == "Domain")
                entities.append({"type": "URL", "value": f"https://{domain}{path}"})
            indicator_text = ", ".join(value for _, value in cluster["shared"])
            description = (
                f"This fictional research fixture synthesises the documented theme of {cluster['theme']}. "
                f"A reporter describes a simulated {cluster['platform'].lower()} approach that used the reserved "
                f"identifiers {indicator_text}. No real person, account, payment, domain, or incident is represented. "
                f"The message was retained as a research-style demonstration record for human review."
            )
            evidence_text = (
                f"Fictional evidence note: a simulated {cluster['theme']} scenario was organised from a public case-study theme. "
                "This note contains no copied article text and no real-world identifier."
            )
            case = compact_demo_case(
                case_id=case_id,
                reference=reference,
                description=description,
                summary=f"Fictional synthesis of a public case-study theme: {cluster['theme']}; exact demo indicators are shown for connection testing.",
                review_category=cluster["category"],
                category="Financial fraud" if cluster["category"] == "financial" else "Account access and phishing",
                status=("In review" if case_index == 2 else "Awaiting review"),
                created_at=f"2026-08-{10 + cluster_index:02d}T{8 + case_index:02d}:15:00+05:30",
                created_label=f"Research fixture · source theme {cluster_index + 1}, case {case_index}",
                platform=cluster["platform"],
                state=("Research fixture"),
                team="Cybercrime research review",
                entities=entities,
                evidence_name=f"research-{cluster['slug']}-{case_index:02d}.txt",
                evidence_text=evidence_text,
            )
            case["researchSource"] = {
                "kind": "Public-source synthesis",
                "title": cluster["title"],
                "url": cluster["url"],
                "note": "Paraphrased theme only; not a copied article, real complaint, or model-training record.",
            }
            case["corpusLabel"] = "Niriksh research-informed fictional fixture"
            cases.append(case)
    return cases


def build_cases() -> list[dict]:
    case_a_evidence = [
        evidence("login-notification.txt", "09:12 — New login notification received for the social account."),
        evidence("account-change.txt", "09:18 — Recovery email changed without the account holder's permission."),
        evidence("impersonation-chat.txt", "09:24 — Contacts received messages from @anaya_case_demo while the account holder was locked out."),
        evidence("payment-request.txt", "09:31 — Message requested payment to niriksh-demo@upi and linked to https://case-link.example/pay."),
    ]
    case_a_summary = "The reporter describes a social account takeover followed by impersonation messages and payment requests to contacts. The account and messages may still be active."
    case_a_entities = [
        {"type": "Username", "value": "@anaya_case_demo"},
        {"type": "UPI ID", "value": "niriksh-demo@upi"},
        {"type": "URL", "value": "https://case-link.example/pay"},
    ]
    case_a_facts = [
        {"label": "Social handle", "value": "@anaya_case_demo", "source": "Evidence: impersonation-chat.txt"},
        {"label": "UPI ID", "value": "niriksh-demo@upi", "source": "Evidence: payment-request.txt"},
        {"label": "URL", "value": "https://case-link.example/pay", "source": "Evidence: payment-request.txt"},
    ]
    case_a_timeline = [
        {"when": "09:12", "what": "Suspicious login notification observed", "source": "Evidence: login-notification.txt", "precision": "Exact"},
        {"when": "09:18", "what": "Account recovery email reported changed", "source": "Evidence: account-change.txt", "precision": "Exact"},
        {"when": "09:24", "what": "Impersonation messages reported by contacts", "source": "Evidence: impersonation-chat.txt", "precision": "Exact"},
        {"when": "09:31", "what": "Payment requested from contacts", "source": "Evidence: payment-request.txt", "precision": "Exact"},
    ]
    case_a_highlights = [
        {"label": "Account access may still be compromised", "detail": "The reporter says they remain locked out of the account.", "source": "Reporter narrative", "level": "Context"},
        {"label": "Impersonation appears to remain active", "detail": "Contacts reportedly continue to receive messages from the account.", "source": "Evidence: impersonation-chat.txt", "level": "Context"},
        {"label": "Payment requests were sent to contacts", "detail": "A submitted message contains a payment identifier and request.", "source": "Evidence: payment-request.txt", "level": "Context"},
    ]

    cases = [
        {
            "id": "demo-connect-a", "reference": "CYB-2026-D001", "description": "On 6 September 2026 I received a new-login alert for my social account. Minutes later the recovery email changed and I was locked out. Friends then told me the account @anaya_case_demo was messaging them for money using niriksh-demo@upi and https://case-link.example/pay. The account and messages are still active.",
            "summary": case_a_summary, "reviewCategory": "social", "category": "Social media and identity misuse", "secondary": [], "severity": "Needs review", "severityScore": 0, "status": "Awaiting review", "completeness": 86, "aiSuspected": False,
            "createdAt": "2026-09-06T09:40:00+05:30", "createdLabel": "Demo · today, 09:40", "platform": "Instagram", "location": "Demo district, Maharashtra", "department": ["Social media and identity review"], "entities": case_a_entities, "evidence": case_a_evidence, "missing": ["Original profile URL"], "riskFactors": [item["label"] for item in case_a_highlights], "confidence": 0,
            "analysisDetails": analysis(summary=case_a_summary, category="Social media and identity misuse", team="Social media and identity review", entities=case_a_entities, facts=case_a_facts, timeline=case_a_timeline, highlights=case_a_highlights, missing=["Original profile URL"], evidence_items=case_a_evidence, incident_status="Still happening"),
            "complaintDetails": {"selectedCategory": "social", "incidentDate": "2026-09-06", "incidentTime": "09:12", "state": "Maharashtra", "district": "Demo district", "channel": "Instagram", "incidentStatus": "Still available or happening", "reporterRole": "Person affected", "declarationConfirmed": True},
        },
        {
            "id": "demo-connect-b", "reference": "CYB-2026-D002", "description": "A caller offered a fictional investment and asked me to transfer ₹5,000 to NIRIKSH-DEMO@UPI. I stopped before paying and saved the payment request.",
            "summary": "The reporter describes a fictional investment approach containing the same submitted UPI identifier as another complaint.", "reviewCategory": "financial", "category": "Financial fraud", "secondary": [], "severity": "Needs review", "severityScore": 0, "status": "In review", "completeness": 82, "aiSuspected": False,
            "createdAt": "2026-09-05T16:20:00+05:30", "createdLabel": "Demo · yesterday", "platform": "Phone", "location": "Demo district, Karnataka", "department": ["Financial complaint review"], "entities": [{"type": "UPI ID", "value": "NIRIKSH-DEMO@UPI"}], "evidence": [evidence("investment-payment.txt", "Payment requested to NIRIKSH-DEMO@UPI for a fictional investment offer.")], "missing": ["Caller phone number"], "riskFactors": [], "confidence": 0,
            "analysisDetails": analysis(summary="The reporter describes a fictional investment approach containing the same submitted UPI identifier as another complaint.", category="Financial fraud", team="Financial complaint review", entities=[{"type": "UPI ID", "value": "NIRIKSH-DEMO@UPI"}], facts=[{"label": "UPI ID", "value": "NIRIKSH-DEMO@UPI", "source": "Evidence: investment-payment.txt"}], timeline=[{"when": "Yesterday", "what": "Investment payment request received", "source": "Reporter narrative", "precision": "Approximate"}], highlights=[], missing=["Caller phone number"], evidence_items=[evidence("investment-payment.txt", "Payment requested to NIRIKSH-DEMO@UPI for a fictional investment offer.")], incident_status="Not sure"),
            "complaintDetails": {"selectedCategory": "financial", "state": "Karnataka", "channel": "Phone", "incidentStatus": "Not sure", "reporterRole": "Person affected", "declarationConfirmed": True},
        },
        {
            "id": "demo-connect-c", "reference": "CYB-2026-D003", "description": "I received a fictional account verification message linking to https://case-link.example/verify. I did not enter any password.",
            "summary": "The reporter submitted a fictional account-verification message whose domain also appears in another complaint.", "reviewCategory": "access", "category": "Account access and phishing", "secondary": [], "severity": "Needs review", "severityScore": 0, "status": "Awaiting review", "completeness": 88, "aiSuspected": False,
            "createdAt": "2026-09-04T12:15:00+05:30", "createdLabel": "Demo · 2 days ago", "platform": "SMS", "location": "Demo district, Delhi", "department": ["Account and phishing review"], "entities": [{"type": "URL", "value": "https://case-link.example/verify"}], "evidence": [evidence("verification-message.txt", "Verify the account at https://case-link.example/verify")], "missing": [], "riskFactors": [], "confidence": 0,
            "analysisDetails": analysis(summary="The reporter submitted a fictional account-verification message whose domain also appears in another complaint.", category="Account access and phishing", team="Account and phishing review", entities=[{"type": "URL", "value": "https://case-link.example/verify"}], facts=[{"label": "URL", "value": "https://case-link.example/verify", "source": "Evidence: verification-message.txt"}], timeline=[{"when": "2 days ago", "what": "Account verification message received", "source": "Reporter narrative", "precision": "Approximate"}], highlights=[], missing=[], evidence_items=[evidence("verification-message.txt", "Verify the account at https://case-link.example/verify")], incident_status="Stopped"),
            "complaintDetails": {"selectedCategory": "access", "state": "Delhi", "channel": "SMS", "incidentStatus": "Stopped or removed", "reporterRole": "Person affected", "declarationConfirmed": True},
        },
        {
            "id": "demo-connect-d", "reference": "CYB-2026-D004", "description": "An unrelated fictional marketplace seller stopped responding after a purchase. The listing used https://unrelated-shop.example/item and no shared payment identifier.",
            "summary": "An unrelated fictional marketplace complaint demonstrates that category similarity alone does not create a connection.", "reviewCategory": "financial", "category": "Financial fraud", "secondary": [], "severity": "Needs review", "severityScore": 0, "status": "Awaiting review", "completeness": 74, "aiSuspected": False,
            "createdAt": "2026-09-03T11:00:00+05:30", "createdLabel": "Demo · 3 days ago", "platform": "Web", "location": "Demo district, Kerala", "department": ["Financial complaint review"], "entities": [{"type": "URL", "value": "https://unrelated-shop.example/item"}], "evidence": [evidence("marketplace-listing.txt", "Fictional listing: https://unrelated-shop.example/item")], "missing": ["Transaction ID or UTR"], "riskFactors": [], "confidence": 0,
            "analysisDetails": analysis(summary="An unrelated fictional marketplace complaint demonstrates that category similarity alone does not create a connection.", category="Financial fraud", team="Financial complaint review", entities=[{"type": "URL", "value": "https://unrelated-shop.example/item"}], facts=[{"label": "URL", "value": "https://unrelated-shop.example/item", "source": "Evidence: marketplace-listing.txt"}], timeline=[], highlights=[], missing=["Transaction ID or UTR"], evidence_items=[evidence("marketplace-listing.txt", "Fictional listing: https://unrelated-shop.example/item")], incident_status="Not sure"),
            "complaintDetails": {"selectedCategory": "financial", "state": "Kerala", "channel": "Web", "incidentStatus": "Not sure", "reporterRole": "Person affected", "declarationConfirmed": True},
        },
    ]
    # The prevention demo remains fictional. Five reports share exact reserved identifiers;
    # the sixth deliberately does not, proving category similarity is not enough.
    shared_sentence = " This fictional high-return investment message directed the reporter to Telegram and requested payment to demo-invest@upi through https://wealth-demo.example/join."
    for case in cases[:3]:
        case["description"] += shared_sentence
        case["entities"].extend([{"type": "UPI ID", "value": "demo-invest@upi"}, {"type": "URL", "value": "https://wealth-demo.example/join"}])
    case_e = copy.deepcopy(cases[1])
    case_e.update({
        "id": "demo-prevention-e", "reference": "CYB-2026-D005", "createdAt": "2026-09-02T10:00:00+05:30", "createdLabel": "Demo · 4 days ago",
        "description": "A fictional recruiter promised guaranteed training returns, moved the conversation to Telegram, and requested a fee at demo-invest@upi using https://wealth-demo.example/join.",
        "summary": "A fictional recruitment-style investment offer contains recurring payment and domain identifiers.",
        "category": "Financial fraud", "platform": "Telegram",
    })
    case_f = copy.deepcopy(cases[1])
    case_f.update({
        "id": "demo-prevention-f", "reference": "CYB-2026-D006", "createdAt": "2026-09-06T17:10:00+05:30", "createdLabel": "Demo · today, 17:10",
        "description": "A fictional investment dashboard offered high returns and asked for payment to demo-invest@upi after a Telegram conversation. The link shown was https://wealth-demo.example/join.",
        "summary": "A fictional recent report can demonstrate a future match once the recurring pattern is verified.",
        "category": "Financial fraud", "platform": "Telegram",
    })
    cases.extend([case_e, case_f])

    cases.extend([
        compact_demo_case(
            case_id="demo-arrest-g", reference="CYB-2026-D007",
            description="A caller claiming to be from a court said my identity was linked to a crime. They called from +91 91111 12222 and directed me to https://secure-court-demo.example/notice before demanding a verification payment.",
            summary="A fictional authority-impersonation call used a recurring phone number and court-lookalike domain.",
            review_category="financial", category="Financial fraud", status="In review",
            created_at="2026-09-01T14:30:00+05:30", created_label="Demo · 5 days ago",
            platform="Phone / Web", state="Tamil Nadu", team="Financial complaint review",
            entities=[{"type": "Phone", "value": "+91 91111 12222"}, {"type": "URL", "value": "https://secure-court-demo.example/notice"}],
            evidence_name="court-call-note.txt", evidence_text="Caller +91 91111 12222 directed the reporter to https://secure-court-demo.example/notice and requested a verification fee.",
        ),
        compact_demo_case(
            case_id="demo-arrest-h", reference="CYB-2026-D008",
            description="A fictional police officer called from +91-91111-12222, claimed a parcel contained illegal documents, and pressured me to remain on a video call.",
            summary="A second fictional authority-pressure report contains the same normalized caller number.",
            review_category="financial", category="Financial fraud", status="Awaiting review",
            created_at="2026-08-31T11:05:00+05:30", created_label="Demo · 6 days ago",
            platform="Phone", state="Telangana", team="Financial complaint review",
            entities=[{"type": "Phone", "value": "+91-91111-12222"}],
            evidence_name="caller-number.txt", evidence_text="Incoming caller shown as +91-91111-12222 during the fictional authority-pressure call.",
        ),
        compact_demo_case(
            case_id="demo-arrest-i", reference="CYB-2026-D009",
            description="A message containing a fake legal notice asked me to upload identity documents at https://secure-court-demo.example/upload. I closed the page without uploading anything.",
            summary="A fictional legal-notice message shares the court-lookalike domain but not the recurring caller number.",
            review_category="access", category="Account access and phishing", status="Routed",
            created_at="2026-08-30T18:45:00+05:30", created_label="Demo · 7 days ago",
            platform="SMS / Web", state="Gujarat", team="Account and phishing review",
            entities=[{"type": "URL", "value": "https://secure-court-demo.example/upload"}],
            evidence_name="legal-notice-link.txt", evidence_text="The fictional notice displayed https://secure-court-demo.example/upload as an identity-verification portal.",
        ),
        compact_demo_case(
            case_id="demo-arrest-j", reference="CYB-2026-D010",
            description="A caller using +919111112222 claimed to be an investigator and sent https://secure-court-demo.example/hearing during the call. They requested a refundable security deposit.",
            summary="A fictional recent report bridges the recurring phone number and court-lookalike domain.",
            review_category="financial", category="Financial fraud", status="Awaiting review",
            created_at="2026-09-06T19:20:00+05:30", created_label="Demo · today, 19:20",
            platform="Phone / WhatsApp", state="Delhi", team="Financial complaint review",
            entities=[{"type": "Phone", "value": "+919111112222"}, {"type": "URL", "value": "https://secure-court-demo.example/hearing"}],
            evidence_name="hearing-message.txt", evidence_text="Caller +919111112222 shared https://secure-court-demo.example/hearing and requested a fictional security deposit.",
        ),
        compact_demo_case(
            case_id="demo-parcel-k", reference="CYB-2026-D011",
            description="A courier caller from +91 93333 34444 said my parcel was held and sent https://parcel-release-demo.example/track for a small release fee.",
            summary="A fictional parcel-release approach contains a recurring phone number and delivery-lookalike domain.",
            review_category="financial", category="Financial fraud", status="Awaiting review",
            created_at="2026-08-29T09:10:00+05:30", created_label="Demo · 8 days ago",
            platform="Phone / SMS", state="West Bengal", team="Financial complaint review",
            entities=[{"type": "Phone", "value": "+91 93333 34444"}, {"type": "URL", "value": "https://parcel-release-demo.example/track"}],
            evidence_name="parcel-tracking-message.txt", evidence_text="Call from +91 93333 34444 was followed by https://parcel-release-demo.example/track.",
        ),
        compact_demo_case(
            case_id="demo-parcel-l", reference="CYB-2026-D012",
            description="A caller using +919333334444 requested a customs charge through parcel-release@upi. I saved the payment message and did not pay.",
            summary="A fictional customs-fee report shares the parcel caller and a recurring payment identifier.",
            review_category="financial", category="Financial fraud", status="In review",
            created_at="2026-08-28T13:55:00+05:30", created_label="Demo · 9 days ago",
            platform="Phone", state="Rajasthan", team="Financial complaint review",
            entities=[{"type": "Phone", "value": "+919333334444"}, {"type": "UPI ID", "value": "parcel-release@upi"}],
            evidence_name="customs-payment.txt", evidence_text="Caller +919333334444 requested the fictional customs charge at parcel-release@upi.",
        ),
        compact_demo_case(
            case_id="demo-parcel-m", reference="CYB-2026-D013",
            description="An SMS linked to https://parcel-release-demo.example/fee and asked for payment to PARCEL-RELEASE@UPI to avoid returning a delivery.",
            summary="A fictional delivery-fee message shares the recurring domain and payment identifier.",
            review_category="financial", category="Financial fraud", status="Routed",
            created_at="2026-08-27T16:25:00+05:30", created_label="Demo · 10 days ago",
            platform="SMS / Web", state="Maharashtra", team="Financial complaint review",
            entities=[{"type": "URL", "value": "https://parcel-release-demo.example/fee"}, {"type": "UPI ID", "value": "PARCEL-RELEASE@UPI"}],
            evidence_name="delivery-fee.txt", evidence_text="The message used https://parcel-release-demo.example/fee and requested PARCEL-RELEASE@UPI.",
        ),
        compact_demo_case(
            case_id="demo-parcel-n", reference="CYB-2026-D014",
            description="A caller from +91-93333-34444 sent https://parcel-release-demo.example/pay and asked for parcel-release@upi after claiming a shipment required clearance.",
            summary="A fictional report bridges all three recurring parcel-release identifiers.",
            review_category="financial", category="Financial fraud", status="Awaiting review",
            created_at="2026-09-05T08:35:00+05:30", created_label="Demo · yesterday, 08:35",
            platform="WhatsApp", state="Karnataka", team="Financial complaint review",
            entities=[{"type": "Phone", "value": "+91-93333-34444"}, {"type": "URL", "value": "https://parcel-release-demo.example/pay"}, {"type": "UPI ID", "value": "parcel-release@upi"}],
            evidence_name="parcel-clearance-chat.txt", evidence_text="Chat from +91-93333-34444 linked to https://parcel-release-demo.example/pay and requested parcel-release@upi.",
        ),
    ])
    for case in cases:
        case["audit"] = [
            {"label": "Fictional demo complaint loaded", "detail": "Safe fixture data was loaded for the Report → Understand → Connect walkthrough.", "time": "Demo seed", "actor": "Demo utility"},
            {"label": "Structured case prepared", "detail": "Timeline, sources, indicators and gaps were prepared without priority scoring.", "time": "Demo seed", "actor": "Niriksh Analysis"},
        ]
        case["citizenVerification"] = {"status": "Confirmed", "summaryConfirmed": True, "confirmedEntities": len(case["entities"]), "totalEntities": len(case["entities"]), "confirmedAt": "Demo seed"}
    return cases + build_research_cases()


def reset_demo(db) -> int:
    # Remove only patterns whose supporting cases are part of this fictional fixture.
    for pattern in db.scalars(select(PreventionPattern)).all():
        if set(pattern.supporting_complaints or []).intersection(DEMO_IDS):
            db.delete(pattern)
    rows = db.scalars(select(Complaint).where(Complaint.id.in_(DEMO_IDS))).all()
    for row in rows:
        db.delete(row)
    db.commit()
    return len(rows)


def seed_demo(db) -> int:
    reset_demo(db)
    for case in build_cases():
        is_research = bool(case.get("researchSource"))
        complaint = sync_case(
            db,
            case,
            source_channel="research_fixture" if is_research else "demo_seed",
            event_type="research.fixture_seeded" if is_research else "demo.seeded",
        )
        complaint.created_at = datetime.fromisoformat(case["createdAt"])
        db.flush()
        source_note = case.get("researchSource", {}).get("title") if is_research else "Fictional Niriksh demo scenario"
        db.add(Report(
            complaint_id=complaint.id,
            version=1,
            content_text=f"FICTIONAL DEMO REPORT\n\n{case['reference']}\n{case['summary']}\n\nResearch basis: {source_note}",
            snapshot={"demo_only": True, "case": complaint.case_payload},
            created_at=datetime.now(timezone.utc),
        ))
    db.commit()
    return len(DEMO_IDS)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("seed", "reset"))
    args = parser.parse_args()
    settings = get_settings()
    database = build_database(settings.database_url)
    try:
        with database.session_factory() as db:
            count = seed_demo(db) if args.action == "seed" else reset_demo(db)
        print(f"{args.action}: {count} fictional Niriksh demo cases")
    finally:
        database.engine.dispose()


if __name__ == "__main__":
    main()
