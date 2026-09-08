# Bhumika → Niriksh integration contract

Last verified against the repository: 5 September 2026
Contract version: `1.0`
Audience: the developer integrating Bhumika's WhatsApp intake with Niriksh

Deployment status: the Niriksh endpoints, migration, and tracking page are live and production-smoke-tested. The remaining work is inside Bhumika and is specified in `docs/bhumika-agent-handoff.md`.

Decision-policy update (5 September 2026): Bhumika should ask the victim to choose the closest Niriksh subject folder and send its ID in `complaint_details.selectedCategory`. It must not derive priority, severity, or routing. Niriksh no longer returns a severity score. See `docs/human-review-and-safety.md`.

**Ownership-boundary update (8 September 2026, see `docs/whatsapp-cutover.md`): the "Ownership boundary" section immediately below describes the OLD split and is kept for history. Niriksh is now the single point of contact for Meta/WhatsApp — see the corrected boundary underneath it.**

## Ownership boundary (superseded — kept for history)

Bhumika owns Meta/WhatsApp completely: webhook verification, conversation state, questions, language handling, media download, and replies. Niriksh has no Meta callback, access token, phone-number ID, or outbound WhatsApp transport.

Once Bhumika has enough information, it submits a normalized Niriksh complaint. Niriksh owns the canonical case, private evidence, structured extraction, report versions, tracking number, chronological officer inbox, and audit history.

```text
Victim ↔ WhatsApp/Meta ↔ Bhumika
                           |  ^
       curated submission  |  | tracking link, status, questions
       + optional bytes    v  |
                      Niriksh API
                           |-- Supabase PostgreSQL
                           |-- private Supabase Storage
                           |-- extraction-only Gemini + deterministic organiser
                           `-- report + CYB tracking number
```

## Ownership boundary (current, 8 September 2026)

Niriksh owns Meta/WhatsApp directly for this phone number: webhook signature verification, conversation state, questions, language handling (see `lib/whatsapp-i18n.ts`), media download, and replies all run inside Niriksh (`backend/app/modules/whatsapp/` receives the Meta webhook; `lib/whatsapp-chat-engine.ts` is the actual conversation brain, reached over the internal `app/api/internal/whatsapp/turn` route). Required Meta credentials and the internal service key are documented in `.env.example` / `deploy/ec2/api.env.example`.

The Bhumika curated-submission contract below (`POST /api/v1/integrations/bhumika/intakes` and friends) remains live and unchanged — this reversal only concerns who talks to Meta directly for WhatsApp, not Bhumika's own submission API.

```text
Victim ↔ WhatsApp/Meta ↔ Niriksh (backend/app/modules/whatsapp/ → lib/whatsapp-chat-engine.ts)
                           |-- Supabase PostgreSQL
                           |-- private Supabase Storage
                           |-- extraction-only Gemini + deterministic organiser
                           `-- report + CYB tracking number

Bhumika (other intake paths) ↔ curated submission ↔ Niriksh API   [unchanged, see below]
```

## Authentication

Every request must include a dedicated service credential:

```http
X-Niriksh-Integration-Key: <BHUMIKA_INTEGRATION_KEY>
```

This key is separate from officer JWTs and Niriksh's internal BFF key. Store the same value in both deployments' secret managers. Never send it to a browser or place it in a `NEXT_PUBLIC_` variable.

## Simple text/transcript submission

Use this when Bhumika has already collected all details and there are no original binary files still to transfer:

```http
POST /api/v1/integrations/bhumika/intakes
Content-Type: application/json
```

```json
{
  "schema_version": "1.0",
  "submission_id": "bhumika-report-8c9d2",
  "conversation_id": "wa-conversation-0182",
  "reporter": {
    "external_id": "stable-pseudonymous-reporter-id",
    "display_name": "Demo Reporter",
    "preferred_language": "hi-en",
    "consent_to_process": true
  },
  "description": "The complete victim narrative curated by Bhumika...",
  "complaint_details": {
    "incidentDate": "2026-09-04",
    "incidentTime": "10:30",
    "state": "Karnataka",
    "district": "Bengaluru Urban",
    "incidentStatus": "Ongoing",
    "channel": "WhatsApp",
    "accountOrUrl": "@fictional-account",
    "suspectIdentifiers": ["demo@example.test"],
    "financial": {
      "involved": true,
      "lossAmount": 1500,
      "currency": "INR",
      "transactionIds": ["DEMO-UTR-001"],
      "bankOrWallet": "UPI"
    }
  },
  "evidence": [],
  "finalize": true
}
```

Niriksh returns HTTP `201` with `complaint_id`, `tracking_number`, a signed `tracking_url`, a victim-ready message, analysis category/severity/questions, report version/text, the current case status, and URLs for recovery, updates, and supplements. Repeating the same payload with the same `submission_id` returns HTTP `200`, `duplicate: true`, and the original case/report. Reusing that ID with different data returns `409`.

Important response fields:

    {
      "accepted": true,
      "duplicate": false,
      "submission_id": "bhumika-report-8c9d2",
      "tracking_number": "CYB-20260905-ABC123",
      "tracking_url": "https://niriksh.scopophobic.xyz/track?token=<signed-token>",
      "case_status": "Awaiting review",
      "message_for_victim": "Your complaint has been registered ...",
      "status_path": "/api/v1/integrations/bhumika/intakes/bhumika-report-8c9d2",
      "updates_path": "/api/v1/integrations/bhumika/intakes/bhumika-report-8c9d2/updates",
      "supplements_path": "/api/v1/integrations/bhumika/intakes/bhumika-report-8c9d2/supplements"
    }

Bhumika should persist these fields against its conversation and send `message_for_victim` as the acknowledgement. The signed tracking URL is safe for the victim portal and does not reveal the complaint narrative, evidence, identity fields, report body, provider data, or internal complaint ID.

## Submission with original media

For image/audio/video/document bytes, use three steps so retries do not duplicate the complaint.

1. Send the JSON above with `finalize: false` and evidence metadata.
2. Upload each file to the returned `evidence_upload_path` as multipart form data. Required fields are `external_evidence_id` and `evidence`; optional fields are `evidence_type`, `purpose`, `originality`, `context_note`, and `expected_sha256`.
3. POST the returned `finalize_path` with the integration header and an empty body.

The upload is idempotent by `external_evidence_id`. Niriksh bounds the size, verifies the optional digest, stores the file privately, computes SHA-256, and records an audit event. Finalize reads the stored evidence, performs multimodal analysis/transcription, creates report version 1, and returns the tracking number. Repeating finalize returns the same report.

## Status/recovery

```http
GET /api/v1/integrations/bhumika/intakes/{submission_id}
```

Bhumika can use this after a timeout before retrying. Valid processing states are `evidence_pending`, `received`, and `completed`. A successful Niriksh response means prepared for Niriksh human review; it does not mean an FIR or government complaint was filed.

For ongoing, victim-safe updates use:

    GET /api/v1/integrations/bhumika/intakes/{submission_id}/updates
    GET /api/v1/integrations/bhumika/intakes/{submission_id}/updates?after=2026-09-05T10:30:00Z

The response contains the current `case_status`, `requested_information`, `message_for_victim`, tracking values, and an allow-listed event feed. Bhumika can call it when the victim types “status” and from a small background poller. Store the latest event time and pass it as `after` so old messages are not sent twice.

## Adding information after the case was filed

Do not create another intake. Add a supplement to the original `submission_id`:

    POST /api/v1/integrations/bhumika/intakes/{submission_id}/supplements
    Content-Type: application/json

    {
      "schema_version": "1.0",
      "supplement_id": "wa-message-or-batch-id-002",
      "description_addendum": "The victim supplied the receiving UPI ID and clarified the time.",
      "complaint_details": {
        "incidentTime": "14:20",
        "financial": {
          "bankOrWallet": "UPI",
          "beneficiary": "example@upi"
        }
      },
      "evidence": [],
      "finalize": true
    }

This updates the same complaint, preserves its tracking number/link, reruns analysis, and creates report version 2 or later. `supplement_id` is an idempotency key: the same request is safe to retry; different content under the same ID returns `409`.

For a supplement containing original media:

1. Create it with `finalize: false` and evidence metadata.
2. Upload every file to the returned `supplement.evidence_upload_path` using the same multipart fields as the original evidence endpoint.
3. POST the returned `supplement.finalize_path`.

The returned report version advances once. A repeated finalize call returns the existing version.

## What Bhumika should relay to the victim

- `tracking_number`
- `tracking_url`
- `case_status`
- `message_for_victim`
- high-priority `analysis.missing_questions`, if Bhumika chooses to collect another detail before finalization
- confirmation that the report is prepared for Niriksh review
- emergency/financial safety guidance owned by the Bhumika conversation flow

Bhumika should not expose provider/model names, internal complaint IDs, integration credentials, report internals, or private evidence URLs.

## Base URLs

Production API base:

```text
https://ni-adada88b582b4d3ea6b21602d2c1abf7.ecs.us-east-1.on.aws/api/v1
```

Local Docker Compose API base:

```text
http://localhost:8000/api/v1
```

The public health route is outside `/api/v1`:

```http
GET https://ni-adada88b582b4d3ea6b21602d2c1abf7.ecs.us-east-1.on.aws/health
```

A healthy configured response contains values similar to:

```json
{
  "status": "healthy",
  "service": "niriksh-api",
  "version": "2.0.0",
  "database": "connected",
  "bhumika_integration": "configured",
  "direct_whatsapp_webhook": "disabled",
  "connected_analysis": "configured",
  "evidence_storage": "s3"
}
```

## Endpoint summary

All four integration endpoints require the Bhumika integration header.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/integrations/bhumika/intakes` | Create a case idempotently; optionally analyze and finalize immediately |
| `GET` | `/integrations/bhumika/intakes/{submission_id}` | Recover the result or current state after a timeout |
| `POST` | `/integrations/bhumika/intakes/{submission_id}/evidence` | Upload one original evidence file idempotently |
| `POST` | `/integrations/bhumika/intakes/{submission_id}/finalize` | Analyze stored evidence and create report version 1 |
| `GET` | `/integrations/bhumika/intakes/{submission_id}/updates` | Poll victim-safe status/events; optionally filter with `after` |
| `POST` | `/integrations/bhumika/intakes/{submission_id}/supplements` | Add more text/details/media metadata to the same case idempotently |
| `GET` | `/integrations/bhumika/intakes/{submission_id}/supplements/{supplement_id}` | Recover a supplement after a timeout |
| `POST` | `/integrations/bhumika/intakes/{submission_id}/supplements/{supplement_id}/evidence` | Upload one supplement file idempotently |
| `POST` | `/integrations/bhumika/intakes/{submission_id}/supplements/{supplement_id}/finalize` | Analyze supplement media and create the next report version |

The paths above are relative to the `/api/v1` base URL.

The public victim endpoint `GET /public/tracking/{signed-token}` does not require the integration key. The token must come from `tracking_url`; tracking numbers alone are intentionally not accepted because they are guessable.

## Server configuration

Configure the same random secret in both server environments:

```text
# Bhumika server
NIRIKSH_API_URL=https://ni-adada88b582b4d3ea6b21602d2c1abf7.ecs.us-east-1.on.aws/api/v1
NIRIKSH_INTEGRATION_KEY=<shared-random-secret>

# Niriksh API server
BHUMIKA_INTEGRATION_KEY=<the-same-shared-random-secret>
```

Rules:

- Use the key only in Bhumika server-side code.
- Store it in a secret manager or protected environment variable.
- Never send it to browser JavaScript or WhatsApp.
- Never put it in a `NEXT_PUBLIC_`, `VITE_`, or other client-exposed variable.
- Never log request headers containing the key.
- Use HTTPS outside local development.

If Niriksh has no `BHUMIKA_INTEGRATION_KEY` configured, the endpoint returns `503`. A missing or incorrect request key returns `401`.

## Which submission workflow to use

### Text/transcript only

Use one request with `finalize: true` when Bhumika is sending only a curated narrative, structured fields, evidence metadata, or already-extracted text.

```text
POST intake(finalize=true)
  -> validate key/schema/idempotency
  -> create canonical complaint
  -> analyze text and structured context
  -> create report version 1
  -> return completed + tracking_number
```

### Original images, documents, audio, or video

Use the three-stage workflow when Niriksh must retain or analyze the original bytes:

```text
1. POST intake(finalize=false)
      -> create case in Evidence pending state

2. POST evidence once for each file
      -> private storage + SHA-256

3. POST finalize
      -> analyze text and stored media
      -> transcribe/extract where supported
      -> create report version 1
      -> return completed + tracking_number
```

Do not set `finalize: true` before all required media uploads finish. The current API does not block finalization merely because a declared metadata item has not received file bytes.

## Complete request schema

Top-level intake fields:

| Field | Type | Required | Constraints and meaning |
|---|---|---:|---|
| `schema_version` | string | Yes | Must be exactly `"1.0"` |
| `submission_id` | string | Yes | 1–250 characters; stable unique ID for one submitted case |
| `conversation_id` | string | Yes | 1–250 characters; stable Bhumika/WhatsApp session identifier |
| `reporter` | object | Yes | Reporter identity metadata described below |
| `description` | string | Yes | 20–100,000 characters; complete curated victim narrative/context |
| `complaint_details` | object | No | Structured case fields; defaults to `{}` |
| `evidence` | array | No | Up to 20 evidence metadata records; defaults to `[]` |
| `finalize` | boolean | No | Defaults to `true`; use `false` before binary uploads |

Reporter fields:

| Field | Type | Required | Constraints and meaning |
|---|---|---:|---|
| `external_id` | string | Yes | 1–150 characters; stable pseudonymous reporter/contact ID |
| `display_name` | string/null | No | Maximum 200 characters |
| `preferred_language` | string/null | No | Maximum 40 characters, for example `en`, `hi`, or `hi-en` |
| `consent_to_process` | boolean | No | Defaults to `true`; Bhumika should submit only after obtaining the required consent |

Do not use a phone number as `external_id` unless the agreed privacy design explicitly requires it. A stable hash or Bhumika-owned opaque contact ID is preferred.

### Recommended `complaint_details` mapping

The object is extensible, but these names match Niriksh's current analysis and report generation:

| Field | Suggested format | Meaning |
|---|---|---|
| `selectedCategory` | string | Victim-selected Niriksh subject-folder ID; use `other` if unsure. Never derive priority from it. |
| `incidentDate` | `YYYY-MM-DD` | Exact or best-known incident date |
| `incidentTime` | `HH:MM` | Exact or approximate local incident time |
| `delayReason` | string | Reason for delayed reporting, if relevant |
| `state` | string | Indian State or UT |
| `district` | string | District or city |
| `policeStation` | string | Police station, if known |
| `channel` | string | Platform where the incident happened, such as Instagram, Telegram, SMS, or WhatsApp |
| `accountOrUrl` | string | Suspicious account, phone, handle, website, or content URL |
| `incidentStatus` | string | Prefer `Ongoing`, `Still available or happening`, `Stopped or removed`, or `Not sure` |
| `reporterRole` | string | `Person affected`, `Parent or guardian`, or `Reporting for someone else` |
| `suspectIdentifiers` | string[] | Known suspect identifiers; do not guess |
| `declarationConfirmed` | boolean | Whether the reporter confirmed accuracy to the best of their knowledge |
| `financial` | object | Financial details described below |
| `aiMisuse` | object | Synthetic/manipulated-content details described below |
| `suspect` | object | Optional structured suspect fields described below |

Recommended financial object:

```json
{
  "involved": true,
  "bankOrWallet": "Example Bank / UPI",
  "lossAmount": 1500,
  "currency": "INR",
  "transactionIds": ["UTR-001"],
  "transactionDate": "2026-09-04",
  "moneyStatus": "Transferred or debited"
}
```

For the integration contract, use `lossAmount` and `transactionIds`. If Bhumika internally uses `amount` or a singular `transactionId`, normalize them before sending.

Recommended AI-misuse object:

```json
{
  "suspected": true,
  "mediaType": "Video",
  "identityUsed": "My identity",
  "permission": "No permission",
  "harmfulNature": ["Fraud or scam", "Impersonation"],
  "contentUrl": "https://example.invalid/post/123",
  "distribution": "Still online or spreading",
  "takedownWanted": true
}
```

Recommended suspect object:

```json
{
  "nameOrAlias": "Known alias if reported",
  "phone": "+91...",
  "email": "reported-address@example.test",
  "bankAccount": "Reported account identifier",
  "profileOrWebsite": "https://example.invalid/profile",
  "address": "Reported address if known"
}
```

Important mapping rule: `channel` is the platform where the cyber incident occurred. It is **not** automatically WhatsApp merely because WhatsApp was used to report the incident. Niriksh separately records the intake source as `bhumika_whatsapp`. Likewise, `accountOrUrl` must describe the suspicious account or content, not the reporter's WhatsApp number.

### Evidence metadata fields

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `name` | string | Yes | Original/display filename, 1–500 characters |
| `type` | string | No | For example `Image`, `Screenshot`, `Audio`, `Video`, or `Document` |
| `size` | string | No | Display value such as `184 KB` or the byte count as text |
| `mimeType` | string/null | No | For example `image/png` or `audio/ogg` |
| `sha256` | string/null | No | Lowercase 64-character SHA-256 hex digest if known |
| `contextNote` | string/null | No | What this evidence shows or why it matters |
| `extractedText` | string/null | No | Bhumika-provided OCR, transcript, or readable text |
| `purpose` | string/null | No | For example `Supporting evidence` or `Voice description` |
| `originality` | string/null | No | For example `Original`, `Screenshot`, `Forwarded`, or `Unknown` |
| `verified` | boolean/null | No | Bhumika-side preparation indicator; not forensic proof |

For multiple files, use unique filenames where possible and include SHA-256. This helps Niriksh match uploaded bytes to their metadata placeholders.

## Full text-only example

```json
{
  "schema_version": "1.0",
  "submission_id": "bhumika-case-8c9d2",
  "conversation_id": "wa-conversation-0182",
  "reporter": {
    "external_id": "reporter-opaque-7a91",
    "display_name": "Demo Reporter",
    "preferred_language": "hi-en",
    "consent_to_process": true
  },
  "description": "On 4 September 2026, the reporter received a fake marketplace message asking for a UPI payment. The reporter says INR 1,500 was transferred and threatening follow-up messages were received. This is the complete curated narrative assembled from the WhatsApp session.",
  "complaint_details": {
    "incidentDate": "2026-09-04",
    "incidentTime": "10:30",
    "state": "Karnataka",
    "district": "Bengaluru Urban",
    "incidentStatus": "Ongoing",
    "channel": "WhatsApp",
    "accountOrUrl": "@fictional-marketplace",
    "reporterRole": "Person affected",
    "suspectIdentifiers": ["demo@example.test"],
    "declarationConfirmed": true,
    "financial": {
      "involved": true,
      "lossAmount": 1500,
      "currency": "INR",
      "transactionIds": ["DEMO-UTR-001"],
      "bankOrWallet": "UPI",
      "transactionDate": "2026-09-04",
      "moneyStatus": "Transferred or debited"
    }
  },
  "evidence": [],
  "finalize": true
}
```

Example request:

```bash
curl --fail-with-body \
  --request POST \
  "$NIRIKSH_API_URL/integrations/bhumika/intakes" \
  --header "X-Niriksh-Integration-Key: $NIRIKSH_INTEGRATION_KEY" \
  --header "Content-Type: application/json" \
  --data-binary @bhumika-intake.json
```

## Full intake response

A new submission returns `201 Created`. An identical logical retry using the same JSON values returns `200 OK` with `duplicate: true`.

```json
{
  "accepted": true,
  "duplicate": false,
  "submission_id": "bhumika-case-8c9d2",
  "conversation_id": "wa-conversation-0182",
  "processing_status": "completed",
  "complaint_id": "submitted-7af87b164540ab87112f08cd",
  "tracking_number": "CYB-2026-483921",
  "case_status": "Awaiting review",
  "analysis": {
    "mode": "Connected multimodal",
    "provider": "Gemini",
    "model": "configured-model-name",
    "category": "Financial fraud",
    "completeness": 88,
    "missing_questions": [
      "What UPI ID or account received the payment?"
    ]
  },
  "report": {
    "id": "report-uuid",
    "version": 1,
    "content_text": "NIRIKSH — STRUCTURED CYBERCRIME COMPLAINT REPORT...",
    "created_at": "2026-09-04T10:35:00Z"
  },
  "evidence_upload_path": "/api/v1/integrations/bhumika/intakes/bhumika-case-8c9d2/evidence",
  "finalize_path": "/api/v1/integrations/bhumika/intakes/bhumika-case-8c9d2/finalize"
}
```

The analysis may use the deterministic fallback when Gemini is unavailable. That is still a successful completed submission and report.

## Uploading original evidence

### Step 1: create the pending intake

Send the intake request with `finalize: false` and describe the expected evidence in the metadata array:

```json
{
  "schema_version": "1.0",
  "submission_id": "bhumika-media-case-1042",
  "conversation_id": "wa-conversation-1042",
  "reporter": {
    "external_id": "reporter-opaque-1042",
    "preferred_language": "en",
    "consent_to_process": true
  },
  "description": "The reporter describes a fraudulent payment request and has supplied the original voice note received during the incident.",
  "complaint_details": {
    "incidentDate": "2026-09-04",
    "state": "Karnataka",
    "district": "Bengaluru Urban",
    "channel": "WhatsApp",
    "financial": {
      "involved": true,
      "lossAmount": 1500,
      "currency": "INR"
    }
  },
  "evidence": [
    {
      "name": "voice-note-1042.ogg",
      "type": "Audio",
      "size": "284 KB",
      "mimeType": "audio/ogg",
      "sha256": "<64-character-lowercase-sha256>",
      "contextNote": "Original voice note supplied by the reporter.",
      "purpose": "Supporting evidence",
      "originality": "Original"
    }
  ],
  "finalize": false
}
```

The response has `processing_status: "evidence_pending"`, `case_status: "Evidence pending"`, a tracking number, `report: null`, and the upload/finalize paths.

### Step 2: upload every file

```http
POST /api/v1/integrations/bhumika/intakes/{submission_id}/evidence
Content-Type: multipart/form-data
X-Niriksh-Integration-Key: <shared-secret>
```

Multipart fields:

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `external_evidence_id` | text | Yes | 1–250 characters; stable unique ID for this file within Bhumika |
| `evidence` | file | Yes | Original file bytes |
| `evidence_type` | text | No | Defaults to `Document` |
| `purpose` | text | No | Evidence purpose |
| `originality` | text | No | Original, screenshot, forwarded, etc. |
| `context_note` | text | No | Reporter/Bhumika context for the file |
| `expected_sha256` | text | No | 64-character SHA-256 hex digest |

Recommended `external_evidence_id`:

```text
<WhatsApp-message-id>:<attachment-index>
```

Example:

```bash
curl --fail-with-body \
  --request POST \
  "$NIRIKSH_API_URL/integrations/bhumika/intakes/bhumika-media-case-1042/evidence" \
  --header "X-Niriksh-Integration-Key: $NIRIKSH_INTEGRATION_KEY" \
  --form "external_evidence_id=wamid.ABC123:0" \
  --form "evidence_type=Audio" \
  --form "purpose=Supporting evidence" \
  --form "originality=Original" \
  --form "context_note=Original voice note supplied by the reporter" \
  --form "expected_sha256=<64-character-lowercase-sha256>" \
  --form "evidence=@./voice-note-1042.ogg;type=audio/ogg"
```

A new file returns `201`:

```json
{
  "accepted": true,
  "duplicate": false,
  "evidence": {
    "id": "evidence-uuid",
    "complaint_id": "submitted-7af87b164540ab87112f08cd",
    "name": "voice-note-1042.ogg",
    "type": "Audio",
    "mime_type": "audio/ogg",
    "size_bytes": 290816,
    "sha256": "computed-sha256",
    "status": "stored",
    "purpose": "Supporting evidence",
    "originality": "Original",
    "context_note": "Original voice note supplied by the reporter",
    "extracted_text": null,
    "analysis": null,
    "created_at": "2026-09-04T10:34:00Z",
    "download_url": "/api/v1/complaints/.../evidence/.../content"
  }
}
```

Repeating an upload with the same `external_evidence_id` returns `200`, `duplicate: true`, and the original evidence record. It does not store a second copy.

The default maximum is 10,000,000 bytes per file and is controlled by Niriksh's `MAX_EVIDENCE_BYTES`. Niriksh computes SHA-256 while storing the bytes. If `expected_sha256` is supplied and does not match, the request fails and the mismatching object is not retained.

Bhumika should download WhatsApp media while its Meta access is valid, then upload the original bytes to Niriksh. Niriksh deliberately has no Meta access token.

### Step 3: finalize

Call finalize only after every required upload succeeds:

```bash
curl --fail-with-body \
  --request POST \
  "$NIRIKSH_API_URL/integrations/bhumika/intakes/bhumika-media-case-1042/finalize" \
  --header "X-Niriksh-Integration-Key: $NIRIKSH_INTEGRATION_KEY" \
  --header "Content-Type: application/json" \
  --data '{}'
```

Finalize returns `200`. It performs baseline analysis, attempts connected multimodal analysis/transcription when configured, creates report version 1, changes the case to `Awaiting review`, and returns `processing_status: "completed"`.

Repeating finalize is safe. It returns the same existing report with `duplicate: true`; it does not create report version 2.

After finalization, evidence upload returns `409`. Additional evidence for a finalized case is not part of contract `1.0`; that requires a future addendum/versioning workflow.

## Status and timeout recovery

```http
GET /api/v1/integrations/bhumika/intakes/{submission_id}
X-Niriksh-Integration-Key: <shared-secret>
```

Example:

```bash
curl --fail-with-body \
  "$NIRIKSH_API_URL/integrations/bhumika/intakes/bhumika-case-8c9d2" \
  --header "X-Niriksh-Integration-Key: $NIRIKSH_INTEGRATION_KEY"
```

Processing states:

| State | Meaning |
|---|---|
| `evidence_pending` | Case exists and Bhumika may upload original evidence |
| `received` | Intake was accepted and finalization is beginning |
| `completed` | Analysis/report creation completed; tracking number is ready |

Recommended recovery behaviour:

1. Give every case one stable `submission_id` before the first network attempt.
2. If create times out, call `GET` with that ID before sending another create.
3. If `GET` returns `200`, continue from the returned state.
4. If `GET` returns `404`, retry the original create request with the exact same JSON values.
5. If an evidence upload times out, repeat it with the same `external_evidence_id`.
6. If finalize times out, repeat finalize; do not create a new submission.
7. Do not send concurrent create requests using the same `submission_id`; serialize retries for each case.

## Idempotency rules

`submission_id` is the idempotency key for case creation.

- First use with a valid payload: `201`, one complaint created.
- Same ID and exactly the same normalized payload: `200`, `duplicate: true`, original complaint/report returned.
- Same ID with any changed request value: `409 Conflict`.
- A changed `finalize` value also makes the payload different. Create with `finalize: false`, upload files, then use the dedicated finalize endpoint. Do not resend the create body with `finalize: true`.

`external_evidence_id` is the idempotency key for each evidence file.

- First upload: `201`.
- Retry using the same ID: `200`, `duplicate: true`.
- Choose the ID before uploading and persist it in Bhumika's job state.

## Preserving the complete WhatsApp context

Contract `1.0` accepts a curated narrative rather than an array of individual WhatsApp messages. Bhumika should construct `description` from all relevant victim messages in chronological order, including corrections and important captions. Do not include routine bot prompts unless they are needed to interpret an answer.

Suggested format:

```text
[2026-09-04 10:21 IST] Victim: I received a fake KYC link yesterday.
[2026-09-04 10:23 IST] Victim: INR 12,600 was debited after I opened it.
[2026-09-04 10:25 IST] Victim correction: The transaction ID is UTR123, not UTR132.
[2026-09-04 10:27 IST] Evidence caption: Screenshot of the KYC message.
```

Also map the latest confirmed values into `complaint_details`. Use evidence `contextNote` and `extractedText` for source-specific OCR or transcripts.

If an exact full transcript must be retained as evidence, upload a UTF-8 `.txt` or `.json` transcript as a `Document` in addition to the curated `description`. Unknown extra top-level request fields are not part of contract `1.0` and must not be relied upon for storage.

## Bhumika-side processing pattern

Do not wait for Niriksh analysis inside the Meta webhook request. Bhumika should persist or queue the work, acknowledge Meta promptly, and call Niriksh from a background job.

```text
Meta webhook
  -> validate and persist incoming message in Bhumika
  -> return success to Meta
  -> continue Bhumika conversation/session
  -> when Review/Submit or the configured collection checkpoint occurs:
       1. freeze a normalized submission snapshot
       2. allocate stable submission/evidence IDs
       3. call Niriksh from a retryable background job
       4. upload original files if needed
       5. finalize
       6. save Niriksh complaint_id + tracking_number in Bhumika
       7. send the tracking number to the victim
```

The four-minute collection idea belongs in Bhumika's session logic, not in the Niriksh API. Treat it as a review checkpoint, not automatic submission or deletion. Bhumika should submit only the frozen case snapshot approved by its flow.

## Minimal TypeScript client

This example assumes Node.js 20+ and server-side execution.

```ts
type Intake = {
  schema_version: "1.0";
  submission_id: string;
  conversation_id: string;
  reporter: {
    external_id: string;
    display_name?: string;
    preferred_language?: string;
    consent_to_process?: boolean;
  };
  description: string;
  complaint_details?: Record<string, unknown>;
  evidence?: Array<Record<string, unknown>>;
  finalize?: boolean;
};

const baseUrl = process.env.NIRIKSH_API_URL!;
const integrationKey = process.env.NIRIKSH_INTEGRATION_KEY!;

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("X-Niriksh-Integration-Key", integrationKey);
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(90_000),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Niriksh ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

export function createIntake(payload: Intake) {
  return request("/integrations/bhumika/intakes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function getIntake(submissionId: string) {
  return request(`/integrations/bhumika/intakes/${encodeURIComponent(submissionId)}`);
}

export function finalizeIntake(submissionId: string) {
  return request(`/integrations/bhumika/intakes/${encodeURIComponent(submissionId)}/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

export async function uploadEvidence(args: {
  submissionId: string;
  externalEvidenceId: string;
  content: Blob;
  filename: string;
  mimeType: string;
  sha256?: string;
  evidenceType?: string;
  contextNote?: string;
}) {
  const form = new FormData();
  form.set("external_evidence_id", args.externalEvidenceId);
  form.set("evidence_type", args.evidenceType ?? "Document");
  if (args.contextNote) form.set("context_note", args.contextNote);
  if (args.sha256) form.set("expected_sha256", args.sha256);
  form.set("evidence", args.content, args.filename);

  return request(
    `/integrations/bhumika/intakes/${encodeURIComponent(args.submissionId)}/evidence`,
    { method: "POST", body: form },
  );
}
```

Persist the frozen request snapshot, `submission_id`, evidence IDs, upload completion flags, `complaint_id`, and `tracking_number` in Bhumika. Do not rely only on in-memory job state.

## Error responses and retry decisions

FastAPI errors normally use:

```json
{
  "detail": "Human-readable error"
}
```

| Status | Typical cause | Bhumika action |
|---:|---|---|
| `200` | Successful lookup/finalize or idempotent duplicate | Continue using the returned canonical result |
| `201` | New intake or evidence created | Persist returned IDs and state |
| `401` | Missing or incorrect integration key | Stop retries and fix secret/configuration |
| `404` | Unknown `submission_id` | During timeout recovery, retry original create; otherwise inspect the ID |
| `409` | Reused ID with changed payload, upload after finalize, or invalid finalize state | Do not blind-retry; correct the workflow or allocate a new case ID |
| `413` | File exceeds `MAX_EVIDENCE_BYTES` | Use an approved smaller or alternative transfer strategy |
| `422` | Invalid JSON/schema/multipart fields or SHA-256 mismatch | Correct the request; do not retry unchanged |
| `503` | Niriksh has no Bhumika key configured | Fix Niriksh deployment configuration |
| `5xx` | Temporary server/dependency failure | Back off, then recover by `submission_id` before retrying |

Suggested retry policy for network errors, `429`, and retryable `5xx`: bounded exponential backoff with jitter, for example 2 s, 5 s, 15 s, 30 s, then queued/manual recovery. Never generate a new `submission_id` merely because a response was lost.

## Data created in Niriksh

A successful intake creates these Niriksh-owned records:

- One `integration_submissions` row keyed by `source=bhumika` and `submission_id`
- One canonical `complaints` row with `source_channel=bhumika_whatsapp`
- Evidence metadata and privately stored file objects
- SHA-256 fingerprints for uploaded files
- Immutable analysis runs
- Report version 1 after finalization
- Audit events for receipt, evidence storage, analysis or fallback, and completion

The complaint becomes available to the Niriksh officer portal. The returned `tracking_number`, not the internal `complaint_id`, is the victim-facing reference for later helpline lookup.

## Local test

Start the stack:

```bash
docker compose up --build
```

Docker Compose defaults the local integration key to:

```text
local-bhumika-integration-key
```

Then configure a local client:

```bash
export NIRIKSH_API_URL=http://localhost:8000/api/v1
export NIRIKSH_INTEGRATION_KEY=local-bhumika-integration-key
curl --fail-with-body http://localhost:8000/health
```

Interactive FastAPI documentation is available at:

```text
http://localhost:8000/docs
```

Repository verification:

```bash
cd backend
pytest -q
```

The backend suite covers authenticated and idempotent Bhumika intake, conflicting payload rejection, evidence upload idempotency, multimodal finalization, and one-report semantics.

## Deployment smoke test

Niriksh includes a fictional-data smoke test that reads the shared key from AWS Secrets Manager without printing it:

```bash
python3 scripts/smoke-bhumika-integration.py \
  --api-url "https://ni-adada88b582b4d3ea6b21602d2c1abf7.ecs.us-east-1.on.aws/api/v1" \
  --secret-arn "<niriksh-api-secret-arn>" \
  --evidence-file public/demo-evidence/fictional-threatening-chat.png
```

Do not use real victim data for smoke tests.

## Integration acceptance checklist

- [ ] Bhumika's existing Meta webhook remains unchanged.
- [ ] `GET /health` reports database connected and Bhumika integration configured.
- [ ] Missing or incorrect integration keys return `401`.
- [ ] A fictional text submission returns `201`, a `CYB-...` tracking number, and report version 1.
- [ ] Repeating the exact intake returns `200`, `duplicate: true`, and the same complaint, tracking number, and report.
- [ ] Reusing the same submission ID with different data returns `409`.
- [ ] A `finalize: false` intake returns `evidence_pending`.
- [ ] Every declared original file is downloaded from Meta and uploaded successfully before finalize.
- [ ] Repeating an evidence ID returns one stored record with `duplicate: true`.
- [ ] Incorrect SHA-256 bytes are rejected.
- [ ] Finalize returns `completed`, `Awaiting review`, and report version 1.
- [ ] Repeating finalize does not create another report.
- [ ] The case and evidence appear in the Niriksh officer portal.
- [ ] Bhumika sends the returned tracking number to the approved test phone.
- [ ] No integration secrets, private storage URLs, provider names, or internal IDs are sent to the victim.

## Current boundaries and future versions

- Contract `1.0` creates one finalized Niriksh case from one frozen Bhumika submission.
- It does not currently append new evidence after finalization.
- It does not store individual WhatsApp messages as first-class Niriksh message rows; use the curated description and optional transcript evidence.
- It does not submit an FIR, file with a government portal, or prove that an allegation or evidence item is authentic.
- The shared integration key is suitable for the current controlled integration. Production hardening should later add rotation, rate limiting, network or workload identity controls, request signing/timestamps, monitoring, retention policy, and reviewed access controls.
- Any incompatible field or workflow change must use a new `schema_version`; do not silently change the meaning of version `1.0`.

## Source locations

- API routes: `backend/app/modules/bhumika/router.py`
- Request schema: `backend/app/modules/bhumika/schemas.py`
- Idempotency and finalization: `backend/app/modules/bhumika/service.py`
- Evidence storage: `backend/app/modules/evidence/router.py`
- Integration authentication: `backend/app/api/deps.py`
- Integration tests: `backend/tests/test_api.py`
- Deployment smoke test: `scripts/smoke-bhumika-integration.py`
- Deployment runbook: `docs/deployment.md`
