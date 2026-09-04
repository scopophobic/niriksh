# Niriksh technical reference

Last verified against the repository: 4 September 2026

## What the project is now

Niriksh is a working Next.js cybercrime complaint and evidence-triage application backed by a modular FastAPI service. The backend is no longer a placeholder: it persists complaint state, evidence records, analysis runs, report versions, routing decisions, users, idempotent Bhumika submissions, and audit events in a real SQL database.

The product remains a triage aid. It does not prove authenticity, identify offenders, determine guilt, create an FIR, submit to a government portal, or replace an authorised human decision.

## Technology

| Layer | Technology | Responsibility |
|---|---|---|
| Web | Next.js 16, React 19, TypeScript | Citizen/officer experience and server-side BFF |
| Local analysis | TypeScript policy/context engine | Rich source-aware analysis and offline fallback |
| Connected analysis | backend Gemini REST adapter; existing web adapter retained | Structured extraction, image/document observations, and audio transcription |
| API | FastAPI, Pydantic | Typed HTTP boundary and modular domain routers |
| Persistence | SQLAlchemy 2 | Repositories/unit-of-work through scoped sessions |
| Database | Supabase PostgreSQL in production; PostgreSQL in Compose; SQLite test fallback | Canonical structured records |
| Migrations | Alembic | Reproducible schema baseline and future revisions |
| Authentication | salted scrypt + signed JWT | Officer/admin identities and server-to-server access |
| Integration | Protected Bhumika service API | Curated WhatsApp-form intake, evidence transfer, idempotency, finalize/recovery |
| Evidence | private filesystem or S3 adapter | Streaming storage, SHA-256, and authenticated download |
| Tests | Node test runner + Pytest | Analysis regression and backend integration coverage |

## Repository map

```text
app/
  api/analyze/                 existing connected Gemini endpoint
  api/cases/                   server-only backend proxy
  report/, dashboard/, ...    product routes

backend/
  app/main.py                  application factory, health, middleware
  app/core/                    configuration and cryptography
  app/db/                      SQLAlchemy base, session, models
  app/api/                     shared dependencies and root router
  app/modules/
    auth/                      login/JWT
    complaints/                create/import/list/read/update
    evidence/                  private upload/list/download
    analysis/                  policy engine and immutable runs
    reports/                   versioned snapshots
    routing/                   human decisions
    audit/                     event history
    bhumika/                   curated intake contract and finalize orchestration
    whatsapp/                  inactive legacy direct-Meta adapter (not mounted)
  migrations/                  Alembic schema history
  tests/                       API/database/channel integration tests

lib/
  analyzer.ts                  detailed frontend policy/context engine
  multimodal.ts                local/connected result merge
  backend.ts                   server-only FastAPI client
  case-store.tsx               backend-backed UI repository + offline cache
  types.ts                     frontend domain contracts

docker-compose.yml             web + API + PostgreSQL
docs/                          architecture and decision history
```

The retired demo service under `apps/api` was removed to prevent two FastAPI implementations from drifting.

## Runtime data flow

### Web submission

1. `ReportFlow` collects narrative, structured details, and up to six evidence items.
2. Browser Web Crypto computes evidence hashes; readable text remains source-labelled.
3. The TypeScript policy engine runs. If configured, the Next.js Gemini route adds structured media observations. Attachments up to 8 MB are sent inline to avoid a second provider-processing round trip; larger files use the provider file API. Model attempts have a bounded `25s + 18s + 10s` budget so the request remains inside the ECS load-balancer window.
4. The reporter reviews and confirms the output.
5. `CaseStoreProvider.addCase` updates the local UI immediately and POSTs the case to `/api/cases`.
6. The Next.js route forwards it to `/api/v1/complaints/import` with the internal service key.
7. FastAPI stores searchable complaint columns, the compatibility payload, evidence metadata, an analysis run, and an audit event in one transaction.
8. The response includes a short-lived token scoped only to that complaint's evidence ingestion; `ReportFlow` then streams the original selected files through the BFF to private backend storage.

If the backend is temporarily unavailable, the local browser cache keeps the demo usable. The failed write is not currently queued in the browser, so production should add a visible sync state and retry/outbox mechanism rather than silently relying on the cache.

### Officer update

1. A dashboard action patches the React case store.
2. The browser sends the patch to the same-origin `/api/cases/{id}` route.
3. FastAPI updates allowed fields, increments `complaints.version`, and appends an audit event.
4. API clients may pass `If-Match: "<version>"`; stale updates receive `409 Conflict`.

### Bhumika-curated WhatsApp intake

1. Bhumika owns Meta, the conversation, questions, media download, and victim replies.
2. It POSTs the completed form to `/api/v1/integrations/bhumika/intakes` with a dedicated service key and stable submission/conversation IDs.
3. Niriksh validates the versioned schema and unique idempotency key, then creates the canonical complaint and tracking number.
4. A text/transcript-only submission can finalize immediately. If original media must be transferred, Bhumika creates with `finalize: false`, uploads each file using a stable external evidence ID, then calls finalize.
5. Niriksh privately stores and hashes bytes, combines the narrative/fields/transcripts/media, runs deterministic and connected analysis, and persists source-specific findings.
6. Finalize creates report version 1, moves the case to `Awaiting review`, appends audit events, and returns the tracking/report data for Bhumika to relay.
7. Identical retries return the same case/report; payload reuse under the same ID returns `409`.

## Database tables

| Table | Important fields |
|---|---|
| `users` | email/phone, password hash, role, active flag |
| `complaints` | reference, source, status, description, classification, version, compatibility payload |
| `evidence_items` | filename, MIME type, size, digest, storage key, provenance, extracted text, status |
| `analysis_runs` | provider/model, input version, result, status/error, timestamps |
| `reports` | complaint/version uniqueness, rendered text, immutable snapshot, creator |
| `routing_decisions` | action, recommendation, override reason, actor |
| `audit_events` | complaint, actor/type, event, detail, structured data, time |
| `channel_contacts` | channel + external identity uniqueness, locale, consent |
| `channel_sessions` | contact, complaint, conversation state/context |
| `channel_messages` | direction, external ID, type, text, raw/response payload |
| `webhook_events` | idempotency ID, payload, processing state, attempts, retry time/error |
| `integration_submissions` | source submission/conversation IDs, request snapshot, complaint link, state, completion time |

Supabase PostgreSQL is the deployed shared database. SQLite is a zero-setup local/test fallback, not the multi-user production store.

## Live environment

As verified on 4 September 2026, the existing `niriksh` ECS Express website was updated in place and a separate `niriksh-api` ECS Express service was added. The custom domain serves the new web image over HTTPS, and HTTP redirects permanently to HTTPS. The API is reachable at `https://ni-adada88b582b4d3ea6b21602d2c1abf7.ecs.us-east-1.on.aws`; the web BFF uses its `/api/v1` prefix.

Alembic has migrated the Supabase schema. The API health probe successfully executes `SELECT 1`. A private `niriksh-bucket` object was written, hashed, and deleted during the storage smoke test. A fictional Bhumika text submission created a case, connected analysis, tracking number, and report; an identical retry returned the same tracking number as a duplicate. A second fictional submission uploaded and retried screenshot evidence, then finalized successfully. The public web form also returned HTTP 200 with source-specific screenshot findings and a timeline after the inline-media change.

The direct Meta plan was superseded. Bhumika keeps its callback and Meta credentials; Niriksh's direct WhatsApp route is disabled. The only cross-service requirement is a dedicated `BHUMIKA_INTEGRATION_KEY` shared by the two server deployments.

## API surface

All routes below are prefixed by `/api/v1` except health.

| Method and route | Access | Function |
|---|---|---|
| `GET /health` | public | API/database/channel health |
| `POST /auth/login` | public | officer/admin JWT |
| `POST /complaints` | public intake | create and baseline-analyse a complaint |
| `POST /complaints/intake` | public intake | persist a new guided-form case; cannot update existing IDs |
| `POST /complaints/import` | protected | internal/import persistence for the frontend case contract |
| `GET /complaints` | protected | filterable case list |
| `GET /complaints/{id}` | protected | case detail |
| `PATCH /complaints/{id}` | protected | allowed state/classification updates |
| `GET/POST /complaints/{id}/evidence` | protected | list or stream evidence |
| `GET /complaints/{id}/evidence/{evidence_id}/content` | protected | private evidence download |
| `POST /complaints/{id}/intake-evidence` | complaint token | stream files immediately after public intake |
| `POST /complaints/{id}/analysis-runs` | protected | new persisted policy run |
| `GET/POST /complaints/{id}/reports` | protected | versioned reports |
| `POST /triage/{id}/decision` | protected | approve/override/request information |
| `GET /audit/complaints/{id}` | protected | audit history |
| `POST /integrations/bhumika/intakes` | Bhumika key | create/idempotently recover a curated complaint and optionally finalize |
| `GET /integrations/bhumika/intakes/{submission_id}` | Bhumika key | recover state after a timeout |
| `POST /integrations/bhumika/intakes/{submission_id}/evidence` | Bhumika key | idempotent private evidence upload |
| `POST /integrations/bhumika/intakes/{submission_id}/finalize` | Bhumika key | run analysis and create the report exactly once |

Protected means a valid officer/admin bearer token or the internal server key. Override decisions require a non-empty reason.

The Next.js `/login` route creates an HTTP-only officer session. `/dashboard`, `/routing`, `/admin`, and `/cases/*` require the session cookie. The BFF forwards the bearer credential to FastAPI; it does not expose the token to client JavaScript.

Interactive API documentation is available at `/docs` when the API runs locally.

## Security properties and remaining work

Implemented now:

- backend secrets stay on the server
- salted memory-hard password hashes
- expiring signed JWTs
- officer/admin role checks
- production rejection of known development secrets
- restricted CORS methods/origins/headers
- dedicated Bhumika credential with route-level scope
- database-enforced submission idempotency and file-level external IDs
- bounded upload sizes and sanitized storage names
- streaming SHA-256 calculation
- authenticated evidence reads
- non-root backend container user
- explicit human-review boundaries
- versioned analysis/report records and audit events

Required before handling real sensitive complaints:

- citizen OTP/session authentication and per-case authorization
- replace the shared BFF key with workload identity or rotated secret management
- request/login rate limiting and abuse controls
- S3/KMS private storage, presigned upload, quarantine, malware scanning, derivatives, retention, and legal hold
- audit read/export controls and tamper-evident retention
- row-level tenancy/jurisdiction rules if multiple agencies share the system
- data-subject access/deletion and evidence-retention policy
- backups, point-in-time recovery, alerts, traces, metrics, and incident response
- legal/privacy/security review, including handling of child-sensitive material

## Analysis boundaries

The detailed TypeScript engine remains the richer current policy implementation. It preserves sources, handles negation and contradictions, calculates urgency separately from completeness, and enforces child-safety escalation. The backend engine implements a smaller deterministic baseline behind a replaceable interface.

This duplication is transitional. The recommended consolidation is to move the authoritative policy package and connected provider adapters behind the backend analysis interface, then expose a versioned schema to the UI. Until then, imported frontend analysis is stored as an immutable `analysis_runs` result so reviewers can see what produced the case at that time.

Neither engine's confidence number is an empirically calibrated probability. Neither binary hashes nor multimodal observations prove authenticity.

## Configuration

Start the complete local system. Keep local secrets in the repository-root `.env`; the backend loads that file directly and Docker Compose uses it for interpolation. A second `backend/.env` is optional and overrides the root file, but should normally be avoided:

```bash
cp backend/.env.example .env
docker compose up --build
```

Or run processes separately:

```bash
# Terminal 1
cd backend
alembic upgrade head
uvicorn app.main:app --reload

# Terminal 2
npm install
BACKEND_API_URL=http://127.0.0.1:8000/api/v1 npm run dev
```

Important variables:

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | SQLAlchemy PostgreSQL/SQLite connection |
| `JWT_SECRET` | token-signing secret; must change outside local dev |
| `INTERNAL_API_KEY` / `BACKEND_INTERNAL_API_KEY` | matching API and BFF credentials |
| `EVIDENCE_STORAGE_PATH` | private local evidence root |
| `EVIDENCE_STORAGE_BACKEND` | `local` or `s3` |
| `EVIDENCE_S3_BUCKET`, `EVIDENCE_S3_REGION`, `EVIDENCE_S3_PREFIX` | S3 bucket and key namespace |
| `EVIDENCE_S3_ENDPOINT_URL` | custom S3 endpoint, including Supabase Storage |
| `EVIDENCE_S3_ACCESS_KEY_ID`, `EVIDENCE_S3_SECRET_ACCESS_KEY` | server-only storage credentials |
| `EVIDENCE_S3_FORCE_PATH_STYLE` | required for the Supabase S3 endpoint |
| `BHUMIKA_INTEGRATION_KEY` | dedicated server credential for curated Bhumika submissions |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `GEMINI_RESERVE_MODEL` | backend and web connected-analysis configuration |
| `SESSION_COOKIE_SECURE` | set `true` behind production HTTPS |

Do not commit real `.env` files or expose these values with `NEXT_PUBLIC_` prefixes.

## Verification

```bash
cd backend && pytest -q
cd .. && npm test
npm run lint
npm run build
docker compose config --quiet
```

Backend tests cover login/database health, complaint analysis and persistence, optimistic version conflicts, streamed evidence hashing, report snapshots, routing validation, audit events, authenticated/idempotent Bhumika intake, evidence-transfer idempotency, multimodal finalize, and one-report semantics. Frontend tests cover sixteen deterministic analysis and multimodal-merge behaviours.

## Honest current limitations

- Existing UI updates use optimistic fire-and-forget sync; it needs visible pending/failed state for production.
- Browser-selected binary evidence is uploaded after complaint creation; failed file uploads need a visible retry state in the UI.
- Bhumika must map its final conversation state into the versioned Niriksh schema and transfer original file bytes before finalize when Niriksh should analyze those bytes.
- The web path and WhatsApp path still have two connected-analysis adapters; their output contracts should be consolidated after the demo.
- Seed cases and several admin/citizen operational values remain fictional demo data.
- No official portal submission, platform takedown, notification SLA, or government integration occurs.
- Supabase Storage is suitable for the demo but is not immutable evidence storage; versioning, legal hold, quarantine, and recovery controls remain production work.
- The database migration, Bhumika intake API, updated web service, custom HTTPS domain, and HTTP redirect are deployed and live-smoke-tested. Bhumika still needs the Niriksh URL/key and schema mapping; Meta itself remains unchanged.
