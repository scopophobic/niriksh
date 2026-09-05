# Bhumika ↔ Niriksh implementation handoff

Last verified against Niriksh: 5 September 2026
Audience: the developer who owns Bhumika, and the Codex/Claude agent working in that repository

## Outcome

Bhumika keeps its existing Meta WhatsApp account, webhook, message handling, language support, and deployment. It gathers the victim's information, downloads WhatsApp media, and submits a normalized complaint to Niriksh. Niriksh creates the canonical case, stores evidence, performs analysis, creates a versioned report, returns a tracking number and secure tracking link, and exposes a protected update feed. If the victim later gives more information, Bhumika adds it to the same case as a supplement.

No Meta credential moves into Niriksh. Do not rebuild the WhatsApp integration.

## Copy-ready instruction for Codex or Claude

Give the following entire prompt to the coding agent while it is opened in the Bhumika repository:

---

You are working in the existing Bhumika codebase. Inspect its framework, persistence layer, WhatsApp webhook/message model, background-job mechanism, tests, and deployment configuration before editing. Preserve the current Meta WhatsApp integration. Your task is to add a production-quality server-side Niriksh client and connect it to Bhumika's completed-report flow.

Architecture boundary:

- Bhumika owns Meta/WhatsApp, conversation state, consent, question asking, media download, and messages to the victim.
- Niriksh owns the canonical complaint, private evidence storage, analysis, versioned report, officer workflow, audit history, tracking ID, and tracking portal.
- Never put the Niriksh integration key in browser/mobile code, a WhatsApp message, logs, or a client-prefixed environment variable.
- Do not call Niriksh directly from frontend code.

Add these server-only environment variables and document them in Bhumika's env example:

~~~env
NIRIKSH_API_URL=https://ni-adada88b582b4d3ea6b21602d2c1abf7.ecs.us-east-1.on.aws/api/v1
NIRIKSH_INTEGRATION_KEY=<shared secret supplied privately>
NIRIKSH_REQUEST_TIMEOUT_SECONDS=30
~~~

All protected requests must send:

~~~http
X-Niriksh-Integration-Key: <NIRIKSH_INTEGRATION_KEY>
Accept: application/json
~~~

Implement one dedicated module/service, for example niriksh_client, with typed methods:

1. create_intake(payload)
2. get_intake(submission_id)
3. upload_intake_evidence(submission_id, external_evidence_id, bytes/stream, filename, MIME type, metadata)
4. finalize_intake(submission_id)
5. get_updates(submission_id, after?)
6. create_supplement(submission_id, payload)
7. get_supplement(submission_id, supplement_id)
8. upload_supplement_evidence(submission_id, supplement_id, external_evidence_id, bytes/stream, filename, MIME type, metadata)
9. finalize_supplement(submission_id, supplement_id)

Use this intake endpoint:

~~~http
POST /integrations/bhumika/intakes
Content-Type: application/json
~~~

Example body:

~~~json
{
  "schema_version": "1.0",
  "submission_id": "stable-one-case-id",
  "conversation_id": "stable-bhumika-conversation-id",
  "reporter": {
    "external_id": "stable-pseudonymous-reporter-id",
    "display_name": "Reporter name if supplied",
    "preferred_language": "hi-en",
    "consent_to_process": true
  },
  "description": "A complete, factual narrative assembled from the conversation.",
  "complaint_details": {
    "selectedCategory": "victim-selected folder ID, or other if unsure",
    "incidentDate": "2026-09-05",
    "incidentTime": "14:20",
    "state": "Karnataka",
    "district": "Bengaluru Urban",
    "policeStation": null,
    "incidentStatus": "Ongoing",
    "channel": "WhatsApp",
    "accountOrUrl": "@reported-account",
    "reporterRole": "Person affected",
    "suspectIdentifiers": ["reported identifier only"],
    "financial": {
      "involved": true,
      "bankOrWallet": "UPI",
      "lossAmount": 1500,
      "currency": "INR",
      "transactionIds": ["reported transaction ID"],
      "transactionDate": "2026-09-05",
      "moneyStatus": "Transferred or debited"
    },
    "declarationConfirmed": true
  },
  "evidence": [],
  "finalize": true
}
~~~

Never invent missing values. Use null/omit when unknown, and keep the factual victim narrative separate from model-derived fields. Obtain consent before submission. Prefer a stable opaque/hash identifier rather than a raw phone number for reporter.external_id.

Stable idempotency IDs are mandatory:

- submission_id: one permanent ID per Bhumika case, generated once and stored in Bhumika's database.
- conversation_id: the existing stable Bhumika conversation/session ID.
- external_evidence_id: use the WhatsApp message/media ID, or another permanent database ID, never a random ID generated per retry.
- supplement_id: one permanent ID per later information batch, ideally derived from the inbound message/batch and stored before calling Niriksh.

Text-only flow:

1. Build the normalized payload with finalize=true.
2. Persist submission_id and an outgoing state before the HTTP call.
3. POST intake.
4. On HTTP 201 or 200, persist tracking_number, tracking_url, status_path, updates_path, supplements_path, case_status, and the latest update cursor.
5. Send only response.message_for_victim to the victim, or render an equivalent approved message containing tracking_number and tracking_url.

Media flow:

1. Download media from Meta using Bhumika's existing authenticated server code.
2. Build evidence metadata and POST intake with finalize=false.
3. For each original file, POST multipart data to response.evidence_upload_path. Fields:
   - external_evidence_id: required and stable
   - evidence: required file bytes/stream
   - evidence_type: Image, Audio, Video, or Document
   - purpose, originality, context_note: optional
   - expected_sha256: recommended lowercase hex digest
4. Upload sequentially or with small bounded concurrency. Never buffer unbounded files. Niriksh currently accepts at most 10 MB per file.
5. Only after every required upload succeeds, POST response.finalize_path with an empty body.
6. Persist the returned values and send response.message_for_victim.

If Bhumika transcribed audio, put the transcript in the factual narrative or context_note, but still upload the original audio when retention/analysis is expected. Niriksh stores and hashes the original bytes in its private bucket. Bhumika may retain a temporary copy only as required by its own retention policy.

Expected successful response shape:

~~~json
{
  "accepted": true,
  "duplicate": false,
  "submission_id": "stable-one-case-id",
  "processing_status": "completed",
  "tracking_number": "CYB-20260905-ABC123",
  "tracking_url": "https://niriksh.scopophobic.xyz/track?token=<signed-token>",
  "case_status": "Awaiting review",
  "last_updated_at": "2026-09-05T10:30:00Z",
  "requested_information": [],
  "message_for_victim": "Victim-safe acknowledgement with tracking number and link",
  "status_path": "/api/v1/integrations/bhumika/intakes/stable-one-case-id",
  "updates_path": "/api/v1/integrations/bhumika/intakes/stable-one-case-id/updates",
  "supplements_path": "/api/v1/integrations/bhumika/intakes/stable-one-case-id/supplements",
  "report": {
    "version": 1
  }
}
~~~

Do not send complaint_id, report.content_text, analysis provider/model, private URLs, or integration internals to the victim.

Recovery and retry behavior:

- Network timeout/connection failure: GET /integrations/bhumika/intakes/{submission_id} before creating anything again.
- Same submission ID + identical JSON: safe retry, HTTP 200 with duplicate=true.
- Same ID + different JSON: HTTP 409; treat as a programming/data consistency error and alert an operator.
- HTTP 401: configuration error; do not keep retrying.
- HTTP 422: schema/mapping error; record a redacted error and send the case to a human retry queue.
- HTTP 429 or 5xx: retry with exponential backoff and jitter; cap attempts and preserve the job for manual replay.
- Never generate a fresh idempotency ID merely because a request timed out.

Ongoing two-way behavior:

- When the victim asks for “status”, call GET on the stored updates_path and send message_for_victim.
- Add a background job that polls open submissions at a modest interval. Call updates_path?after=<latest ISO timestamp>, persist the newest cursor transactionally, and send only new, victim-safe events.
- Deduplicate outbound notifications using the returned update.id before sending WhatsApp messages.
- If case_status is Needs information, send requested_information as clear questions. Do not ask for passwords, PINs, OTPs, or recovery codes.
- The first version can use polling; do not add an outbound webhook to Niriksh. The protected update feed is the supported channel.

Additional-information flow:

When the victim replies after filing, attach the data to the existing case:

~~~http
POST /integrations/bhumika/intakes/{submission_id}/supplements
Content-Type: application/json
~~~

~~~json
{
  "schema_version": "1.0",
  "supplement_id": "stable-message-or-batch-id",
  "description_addendum": "Factual new information from the victim.",
  "complaint_details": {
    "incidentTime": "14:20",
    "financial": {
      "beneficiary": "reported-payee@upi"
    }
  },
  "evidence": [],
  "finalize": true
}
~~~

For supplement media, use finalize=false, upload files to supplement.evidence_upload_path, then POST supplement.finalize_path. This keeps the original tracking number, reruns analysis, and creates report version 2 or later. Persist that result and acknowledge the update to the victim. A changed retry under the same supplement_id must never silently overwrite the first payload.

Persistence fields to add to Bhumika if equivalents do not exist:

- niriksh_submission_id
- niriksh_tracking_number
- niriksh_tracking_url
- niriksh_case_status
- niriksh_status_path
- niriksh_updates_path
- niriksh_supplements_path
- niriksh_last_update_at
- niriksh_sync_state: not_started, creating, evidence_uploading, finalizing, completed, retryable_error, permanent_error
- niriksh_last_error_code and a redacted message
- a notification-dedup table keyed by Niriksh update ID
- a supplement table keyed by conversation/case and supplement_id

Security and privacy requirements:

- HTTPS only outside local development.
- Redact phone numbers, tokens, headers, narratives, and evidence from logs.
- Do not log raw API response report text.
- Validate MIME type, filename, size, and SHA-256; do not trust WhatsApp filenames.
- Escape all victim-facing dynamic text.
- Keep tracking_url private like a bearer link. Do not post it publicly.
- Add request metrics without sensitive labels: endpoint, status class, latency, retry count.
- Never claim that Niriksh created an FIR or submitted to a government portal.

Required tests:

1. Text-only intake returns and stores tracking number/link.
2. Identical retry does not create another Bhumika/Niriksh case.
3. Conflicting retry produces an operator-visible permanent error.
4. Media bytes upload with a stable ID; retry is accepted as duplicate.
5. Finalize occurs only after all uploads and is retry-safe.
6. Timeout recovery performs GET using the original submission ID.
7. “status” returns the latest victim-safe message.
8. Polling cursor and update-ID dedup prevent duplicate WhatsApp notices.
9. Needs-information updates produce safe questions.
10. Text supplement updates the same case.
11. Media supplement uploads then finalizes.
12. Secrets and raw complaint/evidence never appear in logs or client bundles.

After implementing, run the Bhumika project's existing formatter, type checker, unit/integration tests, and a local end-to-end test against Niriksh at http://localhost:8000/api/v1. Show the exact files changed, configuration required, and test evidence. Do not deploy until the owner confirms the deployment environment contains NIRIKSH_API_URL and NIRIKSH_INTEGRATION_KEY.

---

## What the Niriksh side already provides

The Niriksh implementation includes:

- authenticated, versioned Bhumika intake
- database-enforced submission and supplement idempotency
- private streaming evidence upload and SHA-256
- deterministic analysis plus configured Gemini multimodal analysis/fallback
- report version 1 on initial finalize and later versions for supplements
- one stable CYB tracking number
- signed, time-limited tracking portal links
- a public tracking response containing only allow-listed status fields/events
- a protected Bhumika update feed with an optional after cursor
- victim-ready messages and requested-information fields
- officer workflow, routing decisions, and audit history

## Niriksh configuration

The Niriksh API deployment needs:

~~~env
BHUMIKA_INTEGRATION_KEY=<same shared secret>
PUBLIC_APP_URL=https://niriksh.scopophobic.xyz
TRACKING_TOKEN_DAYS=180
~~~

PUBLIC_APP_URL and TRACKING_TOKEN_DAYS are non-secret ECS environment values. JWT_SECRET signs the tracking link and already exists in Niriksh's AWS secret. The public portal URL is generated server-side.

## Acceptance checklist for the joint demo

- Bhumika submits one fictional text complaint.
- The victim receives a CYB number and clickable niriksh.scopophobic.xyz tracking link.
- The link opens without officer login and shows status but no narrative/evidence/internal identifiers.
- The case appears in the Niriksh officer dashboard.
- Original image/audio upload appears in the same case and analysis/report.
- Replaying the same WhatsApp event creates no duplicate.
- Officer status/routing activity appears through Bhumika's updates call.
- A fictional follow-up detail creates report version 2 without changing the tracking number.
- Both sides clearly say Niriksh is a triage/review system, not an FIR filing system.

For the full field reference and raw endpoint contract, also give the agent [bhumika-integration.md](./bhumika-integration.md).
