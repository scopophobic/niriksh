import base64
import hashlib
import time
from urllib.parse import parse_qs, urlparse

import pytest

from app.modules.whatsapp.transport import WhatsAppTransport
from app.modules.analysis.provider import ConnectedFinding


def test_login_and_database_health(client):
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["database"] == "connected"
    assert health.json()["bhumika_integration"] == "configured"
    assert health.json()["direct_whatsapp_webhook"] == "disabled"
    assert client.get("/api/v1/channels/whatsapp/webhook").status_code == 404

    login = client.post("/api/v1/auth/login", json={"email": "triage@example.local", "password": "test-password"})
    assert login.status_code == 200
    assert login.json()["role"] == "triage"
    assert login.json()["access_token"]
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"})
    assert me.status_code == 200
    assert me.json()["email"] == "triage@example.local"


def test_message_checker_is_rule_based_private_and_non_judgmental(client):
    checked = client.post("/api/v1/safety/check-message", json={
        "text": "URGENT: Share your OTP and pay a processing fee to unknown-payee@upi now."
    })
    assert checked.status_code == 200
    result = checked.json()
    assert result["signal_count"] >= 3
    assert result["retention"].endswith("not saved by this checker.")
    assert "not a finding" in result["disclaimer"].lower()
    assert result["directory_matches"][0]["found"] is False


def test_identifier_directory_hashes_values_and_requires_officer_to_publish(client, internal_headers):
    unauthorized = client.post("/api/v1/safety/identifiers", json={"value": "review-payee@upi"})
    assert unauthorized.status_code == 401

    recorded = client.post("/api/v1/safety/identifiers", headers=internal_headers, json={
        "value": "review-payee@upi",
        "type": "upi",
        "status": "reviewed_concern",
        "review_note": "Fictional test record reviewed by an officer.",
    })
    assert recorded.status_code == 201
    assert recorded.json()["masked_value"] != "review-payee@upi"

    lookup = client.post("/api/v1/safety/lookup", json={"value": "REVIEW-PAYEE@UPI", "type": "upi"})
    assert lookup.status_code == 200
    assert lookup.json()["found"] is True
    assert lookup.json()["status"] == "reviewed_concern"
    assert "proof" in lookup.json()["meaning"].lower()

    missing = client.post("/api/v1/safety/lookup", json={"value": "unknown-demo@upi", "type": "upi"})
    assert missing.json()["found"] is False
    assert "does not mean" in missing.json()["meaning"].lower()


def test_category_catalog_states_human_decision_policy(client):
    response = client.get("/api/v1/safety/categories")
    assert response.status_code == 200
    assert len(response.json()["categories"]) == 7
    assert "does not assign priority" in response.json()["policy"]


def test_complaint_is_analyzed_persisted_and_versioned(client, internal_headers):
    created = client.post("/api/v1/complaints", json={
        "description": "Yesterday an AI fake video used my identity on Instagram for a scam and a victim transferred money.",
        "complaint_details": {"selectedCategory": "social", "channel": "Instagram", "state": "Delhi", "incidentDate": "2026-09-02"},
        "evidence": [{"name": "screen.png", "type": "Image", "size": "120 KB", "mimeType": "image/png"}],
    })
    assert created.status_code == 201
    case = created.json()
    assert case["reference"].startswith("CYB-")
    assert case["category"] == "Social media and identity misuse"
    assert case["severity"] == "Needs review"
    assert case["severityScore"] == 0
    assert case["confidence"] == 0

    listing = client.get("/api/v1/complaints", headers=internal_headers)
    assert listing.status_code == 200
    assert any(item["id"] == case["id"] for item in listing.json())

    patched = client.patch(
        f"/api/v1/complaints/{case['id']}",
        headers={**internal_headers, "If-Match": '"1"'},
        json={"status": "In review"},
    )
    assert patched.status_code == 200
    assert patched.json()["status"] == "In review"
    stale = client.patch(
        f"/api/v1/complaints/{case['id']}",
        headers={**internal_headers, "If-Match": '"1"'},
        json={"status": "Routed"},
    )
    assert stale.status_code == 409


def test_guided_form_intake_gets_backend_reference_and_cannot_overwrite(client, internal_headers):
    evidence_bytes = b"browser evidence bytes"
    evidence_sha256 = hashlib.sha256(evidence_bytes).hexdigest()
    raw = {
        "id": "submitted-browser-1",
        "reference": "CLIENT-TEMP",
        "description": "Yesterday a threatening account contacted me repeatedly on Instagram and said they know where I work.",
        "summary": "Reporter received threats.",
        "category": "Threats, stalking or harassment",
        "severity": "High",
        "severityScore": 60,
        "status": "Awaiting review",
        "completeness": 60,
        "aiSuspected": False,
        "createdAt": "2026-09-03T10:00:00Z",
        "createdLabel": "Just now",
        "department": ["General Cybercrime Review"],
        "entities": [],
        "evidence": [{
            "name": "browser-proof.txt",
            "type": "Document",
            "size": "22 bytes",
            "mimeType": "text/plain",
            "sha256": evidence_sha256,
        }],
        "missing": [],
        "riskFactors": ["Threat"],
        "audit": [],
        "confidence": 0.9,
    }
    created = client.post("/api/v1/complaints/intake", json=raw)
    assert created.status_code == 201
    assert created.json()["reference"].startswith("CYB-")
    assert created.json()["reference"] != "CLIENT-TEMP"
    assert created.json()["_uploadToken"]
    uploaded = client.post(
        "/api/v1/complaints/submitted-browser-1/intake-evidence",
        headers={"X-Complaint-Token": created.json()["_uploadToken"]},
        files={"evidence": ("browser-proof.txt", evidence_bytes, "text/plain")},
        data={"evidence_type": "Document", "expected_sha256": evidence_sha256},
    )
    assert uploaded.status_code == 201
    assert len(uploaded.json()["sha256"]) == 64
    downloaded = client.get(uploaded.json()["download_url"], headers=internal_headers)
    assert downloaded.status_code == 200
    assert downloaded.content == evidence_bytes
    repeated_upload = client.post(
        "/api/v1/complaints/submitted-browser-1/intake-evidence",
        headers={"X-Complaint-Token": created.json()["_uploadToken"]},
        files={"evidence": ("browser-proof.txt", evidence_bytes, "text/plain")},
        data={"evidence_type": "Document", "expected_sha256": evidence_sha256},
    )
    assert repeated_upload.status_code == 201
    assert repeated_upload.json()["id"] == uploaded.json()["id"]
    duplicate = client.post("/api/v1/complaints/intake", json={**raw, "summary": "overwrite"})
    assert duplicate.status_code == 409


def test_evidence_hash_report_routing_and_audit(client, internal_headers):
    case = client.post("/api/v1/complaints", json={"description": "A phishing KYC link caused a bank debit yesterday on WhatsApp."}).json()
    uploaded = client.post(
        f"/api/v1/complaints/{case['id']}/evidence",
        headers=internal_headers,
        files={"evidence": ("proof.txt", b"transaction reference 123", "text/plain")},
        data={"evidence_type": "Document", "originality": "Original"},
    )
    assert uploaded.status_code == 201
    assert len(uploaded.json()["sha256"]) == 64

    report = client.post(f"/api/v1/complaints/{case['id']}/reports", headers=internal_headers)
    assert report.status_code == 201
    assert case["reference"] in report.json()["content_text"]

    invalid = client.post(
        f"/api/v1/triage/{case['id']}/decision",
        headers=internal_headers,
        json={"action": "override"},
    )
    assert invalid.status_code == 422
    routed = client.post(
        f"/api/v1/triage/{case['id']}/decision",
        headers=internal_headers,
        json={"action": "approve", "departments": ["Financial complaint review"], "reason": "Officer reviewed the complaint and confirmed the destination."},
    )
    assert routed.status_code == 201
    audit = client.get(f"/api/v1/audit/complaints/{case['id']}", headers=internal_headers)
    assert audit.status_code == 200
    assert {item["event_type"] for item in audit.json()} >= {"complaint.created", "evidence.stored", "report.created", "routing.decision"}


@pytest.mark.skip(reason="legacy direct Meta adapter is no longer publicly mounted")
def test_whatsapp_webhook_is_idempotent_and_creates_same_complaint_model(client, internal_headers):
    verify = client.get("/api/v1/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify-test&hub.challenge=42")
    assert verify.status_code == 200
    assert verify.text == "42"
    body = {"entry": [{"changes": [{"value": {
        "contacts": [{"wa_id": "919000000001", "profile": {"name": "Demo Reporter"}}],
        "messages": [{"from": "919000000001", "id": "wamid.TEST1", "type": "text", "text": {"body": "Someone is using an AI fake video of me for an investment scam on Instagram."}}],
    }}]}]}
    accepted = client.post("/api/v1/channels/whatsapp/webhook", json=body)
    assert accepted.status_code == 202
    duplicate = client.post("/api/v1/channels/whatsapp/webhook", json=body)
    assert duplicate.status_code == 202
    assert duplicate.json()["duplicate"] is True

    for _ in range(20):
        cases = client.get("/api/v1/complaints", headers=internal_headers).json()
        whatsapp = [case for case in cases if case.get("platform") == "WhatsApp"]
        if whatsapp:
            break
        time.sleep(0.01)
    assert len(whatsapp) == 1
    assert whatsapp[0]["status"] == "Needs information"


@pytest.mark.skip(reason="legacy direct Meta adapter is no longer publicly mounted")
def test_whatsapp_media_reuses_bhumika_transport_and_is_stored(client, internal_headers, monkeypatch):
    content = b"fictional whatsapp image bytes"
    meta_digest = base64.b64encode(hashlib.sha256(content).digest()).decode()
    monkeypatch.setattr(WhatsAppTransport, "configured", property(lambda _: True))
    monkeypatch.setattr(WhatsAppTransport, "download_media", lambda self, media_id, maximum=None: (content, "image/png"))
    monkeypatch.setattr(WhatsAppTransport, "_post", lambda self, body: {"messages": [{"id": "wamid.OUT"}]})
    body = {"entry": [{"changes": [{"value": {"messages": [{
        "from": "919000000002",
        "id": "wamid.MEDIA1",
        "type": "image",
        "image": {"id": "media-existing-meta-account", "mime_type": "image/png", "sha256": meta_digest, "caption": "This fake profile is threatening me repeatedly."},
    }]}}]}]}
    accepted = client.post("/api/v1/channels/whatsapp/webhook", json=body)
    assert accepted.status_code == 202
    cases = client.get("/api/v1/complaints", headers=internal_headers).json()
    complaint = next(case for case in cases if case.get("platform") == "WhatsApp")
    evidence = client.get(f"/api/v1/complaints/{complaint['id']}/evidence", headers=internal_headers).json()
    assert len(evidence) == 1
    assert evidence[0]["status"] == "stored"
    assert evidence[0]["sha256"] == hashlib.sha256(content).hexdigest()


@pytest.mark.skip(reason="legacy direct Meta adapter is no longer publicly mounted")
def test_whatsapp_audio_is_transcribed_and_submit_creates_report(client, internal_headers, monkeypatch):
    audio = b"fictional opus voice note"
    monkeypatch.setattr(WhatsAppTransport, "configured", property(lambda _: True))
    monkeypatch.setattr(WhatsAppTransport, "download_media", lambda self, media_id, maximum=None: (audio, "audio/ogg"))
    monkeypatch.setattr(WhatsAppTransport, "_post", lambda self, body: {"messages": [{"id": "wamid.OUT"}]})

    class FakeAnalyzer:
        configured = True

        def analyze(self, narrative, details, media):
            assert media[0].mime_type == "audio/ogg"
            return ConnectedFinding("Gemini", "test-model", {
                "situation_summary": "The reporter describes a fraudulent payment request received by voice note.",
                "category": "Online financial fraud",
                "severity": "High",
                "confidence": 0.9,
                "suspected_ai_manipulation": False,
                "extracted_details": {
                    "incidentDate": "2026-09-03", "incidentTime": None, "state": "Karnataka",
                    "district": "Bengaluru", "incidentStatus": "Ongoing", "channel": "WhatsApp",
                    "accountOrUrl": None, "suspectIdentifiers": ["+91 90000 00000"],
                    "financialInvolved": True, "lossAmount": 5000, "currency": "INR",
                    "transactionIds": ["UTR123"], "bankOrWallet": "UPI",
                },
                "important_indicators": [],
                "evidence_findings": [{
                    "file_name": "whatsapp-audio-audio-demo", "transcript": "I sent five thousand rupees using UPI.",
                    "observations": ["A payment is described."], "visible_text": [], "limitations": [],
                }],
                "timeline": [],
                "missing_questions": ["What UPI ID received the payment?"],
                "limitations": [],
            })

    client.app.state.complaint_analyzer = FakeAnalyzer()
    first = {"entry": [{"changes": [{"value": {"messages": [{
        "from": "919000000003", "id": "wamid.AUDIO1", "type": "audio",
        "audio": {"id": "audio-demo", "mime_type": "audio/ogg"},
    }]}}]}]}
    assert client.post("/api/v1/channels/whatsapp/webhook", json=first).status_code == 202

    cases = client.get("/api/v1/complaints", headers=internal_headers).json()
    complaint = next(case for case in cases if case.get("reference") and case.get("summary", "").startswith("The reporter describes"))
    assert complaint["complaintDetails"]["financial"]["lossAmount"] == 5000
    evidence = client.get(f"/api/v1/complaints/{complaint['id']}/evidence", headers=internal_headers).json()
    assert evidence[0]["extracted_text"] == "I sent five thousand rupees using UPI."

    submit = {"entry": [{"changes": [{"value": {"messages": [{
        "from": "919000000003", "id": "wamid.SUBMIT1", "type": "interactive",
        "interactive": {"button_reply": {"id": "send_now", "title": "Submit report"}},
    }]}}]}]}
    assert client.post("/api/v1/channels/whatsapp/webhook", json=submit).status_code == 202
    reports = client.get(f"/api/v1/complaints/{complaint['id']}/reports", headers=internal_headers)
    assert reports.status_code == 200
    assert len(reports.json()) == 1
    assert complaint["reference"] in reports.json()[0]["content_text"]

    status = {"entry": [{"changes": [{"value": {"messages": [{
        "from": "919000000003", "id": "wamid.STATUS1", "type": "text",
        "text": {"body": "status"},
    }]}}]}]}
    assert client.post("/api/v1/channels/whatsapp/webhook", json=status).status_code == 202
    cases_after_status = client.get("/api/v1/complaints", headers=internal_headers).json()
    assert len(cases_after_status) == len(cases)


def bhumika_headers():
    return {"X-Niriksh-Integration-Key": "test-bhumika-key"}


def bhumika_payload(submission_id="submission-demo-1", finalize=True):
    return {
        "schema_version": "1.0",
        "submission_id": submission_id,
        "conversation_id": "conversation-demo-1",
        "reporter": {
            "external_id": "reporter-hash-1",
            "display_name": "Demo Reporter",
            "preferred_language": "en",
            "consent_to_process": True,
        },
        "description": "Yesterday a fake marketplace account requested a UPI transfer and sent repeated threatening messages.",
        "complaint_details": {
            "incidentDate": "2026-09-03",
            "state": "Karnataka",
            "district": "Bengaluru",
            "channel": "WhatsApp",
            "accountOrUrl": "@fictional-marketplace",
            "financial": {"involved": True, "lossAmount": 1500, "currency": "INR", "transactionIds": ["DEMO-UTR-1"]},
        },
        "evidence": [],
        "finalize": finalize,
    }


def test_bhumika_curated_intake_is_authenticated_idempotent_and_creates_report(client):
    unauthorized = client.post("/api/v1/integrations/bhumika/intakes", json=bhumika_payload())
    assert unauthorized.status_code == 401

    created = client.post("/api/v1/integrations/bhumika/intakes", headers=bhumika_headers(), json=bhumika_payload())
    assert created.status_code == 201
    result = created.json()
    assert result["tracking_number"].startswith("CYB-")
    assert result["case_status"] == "Awaiting review"
    assert result["report"]["version"] == 1
    assert result["analysis"]["category"]
    assert result["tracking_url"].startswith("http://localhost:3000/track?token=")
    assert result["tracking_number"] in result["message_for_victim"]
    assert result["tracking_url"] in result["message_for_victim"]
    assert result["updates_path"].endswith("/updates")
    assert result["supplements_path"].endswith("/supplements")

    duplicate = client.post("/api/v1/integrations/bhumika/intakes", headers=bhumika_headers(), json=bhumika_payload())
    assert duplicate.status_code == 200
    assert duplicate.json()["duplicate"] is True
    assert duplicate.json()["complaint_id"] == result["complaint_id"]
    assert duplicate.json()["report"]["version"] == 1

    conflict_payload = bhumika_payload()
    conflict_payload["description"] += " This payload is different."
    conflict = client.post("/api/v1/integrations/bhumika/intakes", headers=bhumika_headers(), json=conflict_payload)
    assert conflict.status_code == 409


def test_bhumika_tracking_link_is_public_but_exposes_only_safe_status(client):
    created = client.post(
        "/api/v1/integrations/bhumika/intakes",
        headers=bhumika_headers(),
        json=bhumika_payload("submission-tracking-1"),
    )
    assert created.status_code == 201
    result = created.json()
    token = parse_qs(urlparse(result["tracking_url"]).query)["token"][0]

    tracked = client.get(f"/api/v1/public/tracking/{token}")
    assert tracked.status_code == 200
    public = tracked.json()
    assert public["tracking_number"] == result["tracking_number"]
    assert public["case_status"] == "Awaiting review"
    assert public["report_prepared"] is True
    assert public["report_version"] == 1
    assert public["updates"]
    assert "complaint_id" not in public
    assert "description" not in public
    assert "evidence" not in public
    assert "report" not in public
    assert client.get("/api/v1/public/tracking/not-a-token").status_code == 401

    updates = client.get(result["updates_path"], headers=bhumika_headers())
    assert updates.status_code == 200
    assert updates.json()["tracking_url"] == result["tracking_url"]
    assert updates.json()["updates"]


def test_bhumika_supplement_updates_same_case_and_versions_report(client):
    created = client.post(
        "/api/v1/integrations/bhumika/intakes",
        headers=bhumika_headers(),
        json=bhumika_payload("submission-supplement-1"),
    )
    assert created.status_code == 201
    original = created.json()

    supplement_payload = {
        "schema_version": "1.0",
        "supplement_id": "supplement-message-1",
        "description_addendum": "The victim later supplied the receiving UPI ID demo-payee@example.",
        "complaint_details": {
            "financial": {"bankOrWallet": "UPI", "beneficiary": "demo-payee@example"},
        },
        "evidence": [],
        "finalize": True,
    }
    supplemented = client.post(
        original["supplements_path"],
        headers=bhumika_headers(),
        json=supplement_payload,
    )
    assert supplemented.status_code == 201
    result = supplemented.json()
    assert result["complaint_id"] == original["complaint_id"]
    assert result["tracking_number"] == original["tracking_number"]
    assert result["tracking_url"] == original["tracking_url"]
    assert result["report"]["version"] == 2
    assert result["supplement"]["processing_status"] == "completed"

    duplicate = client.post(
        original["supplements_path"],
        headers=bhumika_headers(),
        json=supplement_payload,
    )
    assert duplicate.status_code == 200
    assert duplicate.json()["duplicate"] is True
    assert duplicate.json()["report"]["version"] == 2

    changed = {
        **supplement_payload,
        "description_addendum": "A different retry must not overwrite the accepted supplement.",
    }
    conflict = client.post(original["supplements_path"], headers=bhumika_headers(), json=changed)
    assert conflict.status_code == 409


def test_bhumika_media_supplement_upload_is_idempotent_and_finalizes_once(client):
    original = client.post(
        "/api/v1/integrations/bhumika/intakes",
        headers=bhumika_headers(),
        json=bhumika_payload("submission-media-supplement-1"),
    ).json()
    supplement = client.post(
        original["supplements_path"],
        headers=bhumika_headers(),
        json={
            "schema_version": "1.0",
            "supplement_id": "supplement-media-1",
            "evidence": [{
                "name": "follow-up.txt",
                "type": "Document",
                "size": "23 bytes",
                "mimeType": "text/plain",
            }],
            "finalize": False,
        },
    )
    assert supplement.status_code == 201
    paths = supplement.json()["supplement"]

    upload = client.post(
        paths["evidence_upload_path"],
        headers=bhumika_headers(),
        files={"evidence": ("follow-up.txt", b"fictional follow-up data", "text/plain")},
        data={"external_evidence_id": "wa-media-follow-up-1", "evidence_type": "Document"},
    )
    assert upload.status_code == 201
    assert upload.json()["evidence"]["status"] == "stored"

    duplicate_upload = client.post(
        paths["evidence_upload_path"],
        headers=bhumika_headers(),
        files={"evidence": ("follow-up.txt", b"fictional follow-up data", "text/plain")},
        data={"external_evidence_id": "wa-media-follow-up-1", "evidence_type": "Document"},
    )
    assert duplicate_upload.status_code == 200
    assert duplicate_upload.json()["duplicate"] is True

    finalized = client.post(paths["finalize_path"], headers=bhumika_headers())
    assert finalized.status_code == 200
    assert finalized.json()["report"]["version"] == 2
    finalized_again = client.post(paths["finalize_path"], headers=bhumika_headers())
    assert finalized_again.status_code == 200
    assert finalized_again.json()["duplicate"] is True
    assert finalized_again.json()["report"]["version"] == 2


def test_bhumika_evidence_upload_then_finalize_runs_media_analysis(client):
    class FakeAnalyzer:
        configured = True

        def analyze(self, narrative, details, media):
            assert media[0].file_name == "voice-note.ogg"
            assert media[0].content == b"fictional voice bytes"
            return ConnectedFinding("Gemini", "test-model", {
                "situation_summary": "The curated complaint and voice note describe a fraudulent UPI request.",
                "category": "Online financial fraud",
                "severity": "High",
                "confidence": 0.9,
                "suspected_ai_manipulation": False,
                "extracted_details": {
                    "incidentDate": "2026-09-03", "incidentTime": None, "state": "Karnataka",
                    "district": "Bengaluru", "incidentStatus": "Ongoing", "channel": "WhatsApp",
                    "accountOrUrl": "@fictional-marketplace", "suspectIdentifiers": [],
                    "financialInvolved": True, "lossAmount": 1500, "currency": "INR",
                    "transactionIds": ["DEMO-UTR-1"], "bankOrWallet": "UPI",
                },
                "important_indicators": [],
                "evidence_findings": [{
                    "file_name": "voice-note.ogg", "transcript": "I was asked to transfer one thousand five hundred rupees.",
                    "observations": ["The speaker describes a payment request."], "visible_text": [], "limitations": [],
                }],
                "timeline": [], "missing_questions": [], "limitations": [],
            })

    client.app.state.complaint_analyzer = FakeAnalyzer()
    payload = bhumika_payload("submission-media-1", finalize=False)
    payload["evidence"] = [{"name": "voice-note.ogg", "type": "Audio", "size": "22 bytes", "mimeType": "audio/ogg"}]
    created = client.post("/api/v1/integrations/bhumika/intakes", headers=bhumika_headers(), json=payload)
    assert created.status_code == 201
    assert created.json()["processing_status"] == "evidence_pending"

    uploaded = client.post(
        "/api/v1/integrations/bhumika/intakes/submission-media-1/evidence",
        headers=bhumika_headers(),
        files={"evidence": ("voice-note.ogg", b"fictional voice bytes", "audio/ogg")},
        data={"external_evidence_id": "bhumika-media-1", "evidence_type": "Audio"},
    )
    assert uploaded.status_code == 201
    assert uploaded.json()["evidence"]["status"] == "stored"

    duplicate_upload = client.post(
        "/api/v1/integrations/bhumika/intakes/submission-media-1/evidence",
        headers=bhumika_headers(),
        files={"evidence": ("voice-note.ogg", b"fictional voice bytes", "audio/ogg")},
        data={"external_evidence_id": "bhumika-media-1", "evidence_type": "Audio"},
    )
    assert duplicate_upload.status_code == 200
    assert duplicate_upload.json()["duplicate"] is True

    finalized = client.post("/api/v1/integrations/bhumika/intakes/submission-media-1/finalize", headers=bhumika_headers())
    assert finalized.status_code == 200
    result = finalized.json()
    assert result["case_status"] == "Awaiting review"
    assert result["analysis"]["mode"] == "Connected multimodal"
    assert result["report"]["version"] == 1

    finalized_again = client.post("/api/v1/integrations/bhumika/intakes/submission-media-1/finalize", headers=bhumika_headers())
    assert finalized_again.status_code == 200
    assert finalized_again.json()["duplicate"] is True
    assert finalized_again.json()["report"]["version"] == 1
