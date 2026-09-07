from app.modules.connect.normalization import normalize_indicator
from app.demo import DEMO_IDS, RESEARCH_DEMO_IDS, reset_demo, seed_demo
from app.db.models import Complaint, Report


def case_payload(case_id: str, description: str, *, evidence=None, category="financial") -> dict:
    return {
        "id": case_id,
        "reference": "CYB-2026-DEMO",
        "description": description,
        "summary": description,
        "reviewCategory": category,
        "category": "Financial fraud" if category == "financial" else "Social media and identity misuse",
        "severity": "Needs review",
        "severityScore": 0,
        "status": "Awaiting review",
        "completeness": 80,
        "aiSuspected": False,
        "createdAt": "2026-09-06T10:00:00+05:30",
        "createdLabel": "Demo",
        "platform": "Instagram",
        "department": ["Financial complaint review"],
        "entities": [],
        "evidence": evidence or [],
        "missing": [],
        "riskFactors": [],
        "audit": [],
        "confidence": 0,
        "complaintDetails": {"selectedCategory": category, "channel": "Instagram"},
    }


def test_indicator_normalization_is_conservative_and_deterministic():
    assert normalize_indicator("phone", "98765 43210") == "+919876543210"
    assert normalize_indicator("phone", "+91-98765-43210") == "+919876543210"
    assert normalize_indicator("upi", "Demo-Payee@UPI") == "demo-payee@upi"
    assert normalize_indicator("domain", "Demo.Example.Test.") == "demo.example.test"
    assert normalize_indicator("url", "HTTPS://Demo.Example.Test:443/pay?id=2#receipt") == "https://demo.example.test/pay?id=2"
    assert normalize_indicator("url", "not a url") is None
    assert normalize_indicator("transaction_id", "AbC-12345678") == "AbC-12345678"


def test_related_incidents_match_only_explicit_normalized_indicators(client, internal_headers):
    first = case_payload(
        "connect-demo-a",
        "The payment request used demo-connect@upi and https://connect-demo.example.test/pay/a yesterday.",
        evidence=[{
            "name": "payment-request.txt",
            "type": "Document",
            "size": "1 KB",
            "mimeType": "text/plain",
            "extractedText": "Send payment to demo-connect@upi",
        }],
    )
    second = case_payload(
        "connect-demo-b",
        "A different complainant received DEMO-CONNECT@UPI and https://connect-demo.example.test/pay/b today.",
    )
    same_category_only = case_payload(
        "connect-demo-c",
        "A financial complaint contains no submitted account, payment, phone, URL or transaction identifier.",
    )
    for payload in (first, second, same_category_only):
        response = client.post("/api/v1/complaints/import", headers=internal_headers, json=payload)
        assert response.status_code == 201

    response = client.get("/api/v1/complaints/connect-demo-a/related-incidents", headers=internal_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["related_incidents"][0]["complaint_id"] == "connect-demo-b"
    assert body["related_incidents"][0]["matched_indicator_count"] == 2
    assert {item["type"] for item in body["related_incidents"][0]["shared_indicators"]} == {"upi", "domain"}
    assert "do not establish" in body["disclaimer"]

    upi = next(item for item in body["related_incidents"][0]["shared_indicators"] if item["type"] == "upi")
    assert upi["display_value"].casefold() == "demo-connect@upi"
    assert any(source["evidence_name"] == "payment-request.txt" for source in upi["current_sources"])


def test_related_incidents_require_officer_access(client):
    response = client.get("/api/v1/complaints/not-visible/related-incidents")
    assert response.status_code == 401


def test_fictional_demo_seed_is_repeatable_and_reset_is_scoped(client, internal_headers):
    database = client.app.state.database
    with database.session_factory() as db:
        assert seed_demo(db) == len(DEMO_IDS)
        assert seed_demo(db) == len(DEMO_IDS)
        assert len(db.query(Complaint).filter(Complaint.source_channel == "demo_seed").all()) == len(DEMO_IDS) - len(RESEARCH_DEMO_IDS)
        assert len(db.query(Complaint).filter(Complaint.source_channel == "research_fixture").all()) == len(RESEARCH_DEMO_IDS)
        assert len(db.query(Report).join(Complaint).filter(Complaint.source_channel == "demo_seed").all()) == len(DEMO_IDS) - len(RESEARCH_DEMO_IDS)

    response = client.get("/api/v1/complaints/demo-connect-a/related-incidents", headers=internal_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 4
    assert {"demo-connect-b", "demo-connect-c", "demo-prevention-e", "demo-prevention-f"}.issubset({item["complaint_id"] for item in body["related_incidents"]})
    assert {"upi", "domain"}.issubset({shared["type"] for item in body["related_incidents"] for shared in item["shared_indicators"]})

    patterns = client.get("/api/v1/prevention/patterns", headers=internal_headers).json()
    titles = {item["title"] for item in patterns}
    assert len(patterns) >= 3
    assert "Digital arrest and authority-impersonation pattern" in titles
    assert "Parcel-release fee pattern" in titles
    assert any(item["complaint_count"] == 4 for item in patterns if item["title"] == "Parcel-release fee pattern")
    assert all(item["first_seen"] != item["last_seen"] for item in patterns)

    with database.session_factory() as db:
        unrelated = Complaint(
            id="not-demo-data",
            reference="CYB-2026-KEEP",
            description="A non-demo test record that reset must preserve.",
            case_payload={},
        )
        db.add(unrelated)
        db.commit()
        assert reset_demo(db) == len(DEMO_IDS)
        assert db.get(Complaint, "not-demo-data") is not None
        assert not db.query(Complaint).filter(Complaint.source_channel == "demo_seed").all()
        assert not db.query(Complaint).filter(Complaint.source_channel == "research_fixture").all()


def test_verified_pattern_creates_an_explainable_future_case_warning(client, internal_headers):
    with client.app.state.database.session_factory() as db:
        seed_demo(db)
    patterns = client.get("/api/v1/prevention/patterns", headers=internal_headers)
    assert patterns.status_code == 200
    pattern = next(item for item in patterns.json() if item["complaint_count"] >= 5)
    assert pattern["status"] == "UNREVIEWED"
    assert any(item["display_value"] == "demo-invest@upi" for item in pattern["indicators"])
    shared_upi = next(item for item in pattern["indicators"] if item["display_value"] == "demo-invest@upi")
    assert set(shared_upi["case_ids"]) == {item["id"] for item in pattern["supporting_cases"]}
    assert set(shared_upi["case_sources"]) == set(shared_upi["case_ids"])
    review = client.post(f"/api/v1/prevention/patterns/{pattern['id']}/review", headers=internal_headers, json={"status": "VERIFIED", "note": "Fictional fixture reviewed."})
    assert review.status_code == 200
    warning = client.get("/api/v1/prevention/complaints/demo-prevention-f/matches", headers=internal_headers)
    assert warning.status_code == 200
    assert warning.json()["matches"][0]["pattern_id"] == pattern["id"]
    assert "resembles a previously reviewed pattern" in warning.json()["matches"][0]["message"]
