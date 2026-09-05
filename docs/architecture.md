# Niriksh backend architecture

Last updated: 5 September 2026

## System boundary

```text
Citizen web form ──> Next.js BFF ────────────────┐
                                                  v
Victim <─> WhatsApp/Meta <─> Bhumika ──HTTPS──> FastAPI modular monolith
                                                  |-- auth/RBAC
                                                  |-- Bhumika integration
                                                  |-- complaints
                                                  |-- evidence
                                                  |-- analysis
                                                  |-- reports
                                                  |-- routing
                                                  `-- audit
                                                    |-- Supabase PostgreSQL
                                                    |-- private Supabase Storage
                                                    `-- Gemini
```

Bhumika owns the entire WhatsApp product surface: Meta webhook, session, language, questions, media download, and outbound responses. It sends Niriksh one curated form submission plus optional original file bytes. Niriksh owns case creation, evidence preservation, analysis, reports, tracking numbers, officer workflow, and audit records.

The direct Niriksh Meta webhook is deliberately not mounted. Niriksh therefore needs no Meta credentials and cannot interfere with Bhumika's live callback.

## Why a modular monolith

The domain needs clear code and data ownership but does not yet need distributed transactions or independently operated microservices. One FastAPI deployment and PostgreSQL database provide transactional complaint/report creation, simpler deployment, and faster iteration. Domain modules remain isolated so a high-load analysis worker or integration gateway can be extracted later without redesigning the contracts.

## Module ownership

| Module | Owns | Invariant |
|---|---|---|
| `auth` | users, password verification, JWTs, roles | Protected routes require an officer/admin token or narrowly scoped service credential |
| `bhumika` | external submission/supplement contract, idempotency, finalize orchestration, safe update feed | One Bhumika `submission_id` creates at most one complaint; retries never create extra report versions |
| `tracking` | signed victim links and allow-listed public status projection | A tracking link exposes status only, never complaint/evidence/report internals |
| `complaints` | canonical case and compatibility payload | Every complaint has one unique `CYB-YYYY-NNNNNN` reference and increasing version |
| `evidence` | metadata, private bytes, hashes | Files are size-bounded, path-safe, private, and SHA-256 hashed during ingestion |
| `analysis` | deterministic policy, connected provider, immutable runs | Provider failure never discards the complaint; automated output remains advisory |
| `reports` | immutable report versions | Re-finalization of one completed integration submission returns the existing report |
| `routing` | human approval/override | Overrides require a reason and append an audit event |
| `audit` | cross-module event history | Ordinary APIs append events rather than rewriting history |

The old `whatsapp` parser/transport code remains in the repository only as inactive rollback/reference code; it is absent from the public API router and deployment configuration.

## Data model

```text
integration_submissions
  ├── complaint_id
  └── integration_supplements

complaints
  ├── evidence_items
  ├── analysis_runs
  ├── reports
  ├── routing_decisions
  └── audit_events

users
  └── complaints.reporter_id
```

`integration_submissions` stores the Bhumika submission/conversation IDs, original normalized request, processing state, complaint link, and completion time. A unique `(source, external_submission_id)` constraint is the final duplicate barrier even if Bhumika retries after a network timeout.

`integration_supplements` stores idempotent later-information batches. Each completed supplement updates the same complaint and creates the next immutable report version; it never changes the public tracking number.

`complaints.case_payload` is a compatibility bridge for the current frontend; searchable/security-relevant fields also have relational columns. Binary evidence never enters that JSON document.

## Bhumika intake lifecycle

```text
Text/transcript only:
  POST intake(finalize=true)
    -> validate key/schema/idempotency
    -> create complaint
    -> deterministic + connected text analysis
    -> report v1
    -> completed + tracking number

Original media:
  POST intake(finalize=false)
    -> evidence_pending + tracking number
  POST evidence (once per stable external_evidence_id)
    -> private storage + SHA-256
  POST finalize
    -> multimodal analysis/transcription
    -> report v1
    -> completed
```

`GET /integrations/bhumika/intakes/{submission_id}` is the recovery check after timeouts. Identical retries return the original result. A different payload under an existing ID returns `409 Conflict`. Evidence uploads are independently idempotent by Bhumika's stable external evidence ID.

The response also supplies a signed tracking URL, victim-ready message, protected update-feed path, and supplement path. Bhumika can relay new officer-safe events by polling the update feed with an `after` cursor. Later victim details use an idempotent supplement, with the same three-stage flow when it contains media. This creates report v2+ on the same case.

## Analysis boundary

The deterministic engine runs first and supplies transparent safety/category/completeness behavior. Gemini receives the curated narrative, structured fields, transcripts, and up to eight stored evidence items. It can add source-labelled observations, transcription, extracted details, questions, and a situation summary.

Three distinct model pools are tried within a bounded request budget. Gemini 2.5 uses `thinkingBudget`; Gemini 3.x uses `thinkingLevel`. If every provider attempt fails, the deterministic result is retained, the failure is recorded, and report creation continues.

Automated analysis does not determine guilt, prove authenticity, identify an unknown offender, create an FIR, or confirm a government filing.

## Evidence boundary

The storage adapter supports private local disk for development and S3-compatible storage in deployment. Supabase Storage is the current private demo bucket. PostgreSQL stores the object key, byte size, MIME type, SHA-256, provenance, transcript/extracted text, and analysis metadata.

The 10 MB application cap bounds memory and provider latency. Supabase Storage is not immutable forensic storage: a later production tier needs object lock/versioning, KMS, quarantine/malware scanning, legal-hold/retention rules, access logs, derivative separation, and recovery tests.

## Authentication boundary

- Browser officer flows use an HTTP-only secure session whose JWT is validated by FastAPI.
- The Next.js BFF uses `INTERNAL_API_KEY`; it is never sent to browser JavaScript.
- Bhumika uses a different `BHUMIKA_INTEGRATION_KEY` accepted only by `/integrations/bhumika/*`.
- Victims use a signed, expiring tracking token with a distinct issuer/audience/type. The public projection contains no narrative, evidence, identities, internal complaint ID, or report body.
- Public citizen intake cannot call officer or Bhumika integration routes.
- Production rejects known development JWT/internal-key defaults.

The Bhumika key is a demo-ready shared secret. A production integration should add secret rotation, IP/network controls or workload identity, request timestamps/signatures, rate limiting, metrics, and alerting.

## Deployment

The existing `niriksh` Next.js ECS Express service calls the separate `niriksh-api` FastAPI ECS Express service. Supabase provides PostgreSQL and private object storage. AWS Secrets Manager injects database, storage, Gemini, authentication, and Bhumika integration credentials. Bhumika remains independently deployed and keeps its Meta configuration unchanged.

The tracking/supplement revision is deployed to those same services. `PUBLIC_APP_URL` is a non-secret API task variable; the existing `JWT_SECRET` signs scoped tracking tokens. The application startup runs Alembic revision `20260905_0003`, which adds `integration_supplements`.
