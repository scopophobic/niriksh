from app.modules.connect.normalization import normalize_indicator


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
