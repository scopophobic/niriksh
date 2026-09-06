# Niriksh technical reference

Last verified against the repository: 6 September 2026

## Current product

Niriksh is a working Next.js application backed by a modular FastAPI service. PostgreSQL is the canonical store for complaints, evidence metadata, structured analysis, reports, routing decisions, audit events, tracking state, and exact cross-case indicators.

The product is organised around:

- **Report:** collect a complaint and supporting evidence without overwhelming the reporter.
- **Understand:** reconstruct a source-backed case with chronology, indicators, uncertainty, active signals, and missing information.
- **Connect:** show when the same explicit normalized identifier occurs in another complaint.

Niriksh is not an autonomous investigator or government filing system. It does not determine guilt, authenticity, priority, an FIR decision, final classification, routing, or enforcement.

## Implementation audit

| Area | Current state | Notes |
|---|---|---|
| Complaint intake | Implemented | Guided web form, narrative, structured fields, evidence selection, review, and report preparation |
| Canonical backend | Implemented | FastAPI, SQLAlchemy, PostgreSQL, migrations, authentication, audit, reports, routing, tracking, and safety APIs |
| Evidence bytes | Implemented with environment dependency | Private local/S3 storage and hashes; connected interpretation requires configuration and supported media |
| Case reconstruction | Implemented | Summary, source-backed timeline, facts, provenance, indicators, active signals, missing information, evidence ledger, and status |
| Connect | Implemented | Persisted normalized indicators and deterministic related-incident endpoint/UI |
| Officer authentication | Implemented | JWT backend plus HTTP-only BFF session; local bypass is development-only |
| Browser cache | Demo fallback | Useful offline copy, but not canonical and not a production submission guarantee |
| Seeded cases | Demo-only | Clearly fictional, isolated, resettable, and not required by the app |
| Admin staffing/service controls | Illustrative | Case counts are derived; staffing and integration controls are not live telemetry |
| Connected analysis | Optional | Bounded provider attempt with visible deterministic fallback |
| Government integration | Not implemented | Niriksh is positioned as a complementary preparation layer only |
| Bhumika/WhatsApp | Excluded from this release | Historical code may remain, but it is not required or advertised |

## Stack

| Layer | Technology | Responsibility |
|---|---|---|
| Web | Next.js 16, React 19, TypeScript | Public/officer UI and server-only BFF |
| Local analysis | TypeScript deterministic organiser | Immediate source-aware fallback |
| Connected analysis | Gemini adapter with structured output | Optional extraction, media understanding, transcription, and supported reconstruction |
| API | FastAPI and Pydantic | Typed domain boundary |
| Persistence | SQLAlchemy 2 | Transactional ORM and repositories/services |
| Database | PostgreSQL/Supabase PostgreSQL | Canonical structured state and exact indicator matching |
| Migrations | Alembic | Reproducible schema history |
| Evidence | private local or S3-compatible adapter | Streamed objects and SHA-256 hashes |
| Authentication | salted scrypt, JWT, HTTP-only cookies | Officer/admin and internal service access |
| Tests | Node test runner and Pytest | Frontend analysis and backend integration regressions |

SQLite is supported for isolated tests. It is not the multi-user production store.

## Repository map

```text
app/
  api/                            same-origin BFF routes
  report/                         reporter intake
  dashboard/, routing/, admin/    authorised workspaces
  cases/[id]/                     case reconstruction
  track/, safety/                 victim/public tools

components/
  CaseReview.tsx                  reconstruction and evidence experience
  RelatedIncidents.tsx            Connect experience
  ReportFlow.tsx                  guided reporting

lib/
  analyzer.ts                     deterministic case preparation
  case-intelligence.ts            indicator display and provenance helpers
  case-store.tsx                  backend-backed UI store + browser fallback
  backend.ts                      server-only API client
  types.ts                        frontend contracts

backend/
  app/main.py                     app lifecycle, middleware, health
  app/api/                        dependency and root-router composition
  app/core/                       configuration and cryptography
  app/db/                         SQLAlchemy models/session
  app/modules/
    auth/                         officer/admin identity
    complaints/                   canonical case lifecycle
    evidence/                     private evidence
    analysis/                     policy and connected analysis runs
    connect/                      normalization, indicators, related cases
    reports/                      immutable report versions
    routing/                      human decisions
    tracking/                     victim-safe status
    safety/                       deterministic public safety checks
    audit/                        activity history
  app/demo.py                     fictional seed/reset utility
  migrations/                    Alembic revisions
  tests/                         backend tests

scripts/demo-data.sh              Docker demo helper
```

Historical Bhumika/WhatsApp modules are outside this release. They are not mounted into the current product story, required by the demo, or modified by this work.

## Web complaint persistence

1. `ReportFlow` gathers structured details, narrative, and up to the configured evidence count.
2. Browser Web Crypto calculates evidence digests. Readable evidence text and reporter notes stay source-labelled.
3. The deterministic organiser prepares the immediate result. When configured, connected analysis may add supported observations.
4. The reporter reviews/corrects the prepared result.
5. `CaseStoreProvider.addCase` updates the browser view and POSTs to `/api/cases`.
6. The BFF forwards to FastAPI `/api/v1/complaints/import` using a server-only credential.
7. `sync_case` persists the complaint and compatibility payload, evidence metadata, analysis state, audit event, and normalized indicators.
8. The evidence-ingestion token allows original bytes to be streamed to private storage.

The browser fallback is useful for local demos; it does not establish that a complaint reached the canonical database.

## Case reconstruction contract

The frontend consumes the existing `TriageCase` compatibility payload. The main reconstructed sections use:

- `analysisDetails.summary`
- `analysisDetails.timeline[]` with `when`, `what`, `source`, and optional `precision`
- `analysisDetails.facts[]` with label/value/source
- `analysisDetails.highlights[]` for factual active signals
- `analysisDetails.concerns[]` for conflicts/uncertainty
- `missing[]` and `questions[]`
- `entities[]`
- `evidence[]`
- `status`, `audit[]`, and routing fields

`lib/case-intelligence.ts` filters the broad entity/fact set into explicit cyber indicators, creates evidence anchors, labels narrative sources, and explains common missing fields. It does not invent a missing item, source, or event.

## Connect data model

Alembic revision `20260906_0005` adds:

```text
case_indicators
  id
  complaint_id                FK complaints, CASCADE
  indicator_type
  raw_value
  normalized_value
  source_evidence_id          nullable FK evidence_items, SET NULL
  extraction_source
  source_label
  metadata_json
  created_at
```

Indexes:

- `ix_case_indicators_complaint_id`
- `ix_case_indicators_source_evidence_id`
- `ix_case_indicators_match(indicator_type, normalized_value)`

Rows are rebuilt idempotently when the complaint compatibility record is synchronized. At application startup, complaints with no indicator rows are backfilled.

## Indicator extraction and normalization

Supported types:

| Type | Conservative normalization |
|---|---|
| Phone | remove formatting; safely add India prefix for valid ten-digit mobile numbers; require E.164-shaped result |
| Email | trim; preserve local-part case; IDNA-normalize/lowercase the domain |
| UPI ID | trim and case-fold when it is UPI-shaped rather than email-shaped |
| Domain | trim, lowercase, IDNA-normalize, remove trailing dot |
| URL | require HTTP(S), normalize scheme/host/default port, preserve path/query, remove fragment |
| Social handle | ensure leading `@`, case-fold, and scope with platform when known |
| Transaction ID / UTR | trim only; preserve case and internal formatting |
| Bank/account identifier | trim only; avoid unsafe aggressive transformations |

Candidate values come from:

- reporter narrative;
- structured incident/financial/suspect fields;
- analysis facts and entities; and
- evidence extracted text/context notes, with evidence ID provenance where available.

Generic dates, amounts, platforms, locations, people, and category words are not Connect indicators.

## Matching algorithm

`find_related_incidents(complaint_id)`:

1. loads the complaint and its indicator rows;
2. creates exact `(indicator_type, normalized_value)` keys;
3. queries matching rows owned by other complaints;
4. groups by complaint;
5. groups repeated sources under each exact indicator;
6. exposes current-case and related-case provenance;
7. avoids duplicate indicators; and
8. sorts cases with more exact matches first, then deterministically.

Excluded from matching:

- category or subject folder
- narrative similarity
- date/location proximity
- embeddings or model judgement
- screenshot/image similarity
- fuzzy identifiers

PostgreSQL equality and a composite B-tree index are sufficient for the competition dataset and a normal operational starting point.

## API surface

Routes are under `/api/v1` except health.

| Method and route | Access | Purpose |
|---|---|---|
| `GET /health` | public | API/database health |
| `POST /auth/login` | public | officer/admin JWT |
| `POST /complaints` | public intake | create and baseline-analyse |
| `POST /complaints/intake` | public intake | persist guided-form case |
| `POST /complaints/import` | protected | import current frontend case contract |
| `GET /complaints` | protected | filterable case list |
| `GET /complaints/{id}` | protected | case detail |
| `PATCH /complaints/{id}` | protected | allowed status/category changes |
| `GET /complaints/{id}/related-incidents` | protected | exact shared indicators grouped by case |
| `GET/POST /complaints/{id}/evidence` | protected | list/ingest evidence |
| `GET /complaints/{id}/evidence/{evidence_id}/content` | protected | private evidence download |
| `POST /complaints/{id}/analysis-runs` | protected | persisted analysis run |
| `GET/POST /complaints/{id}/reports` | protected | immutable report versions |
| `POST /triage/{id}/decision` | protected | human confirm/override/request-information |
| `GET /audit/complaints/{id}` | protected | audit history |
| `GET /public/tracking/{token}` | signed link | allow-listed victim status |
| `POST /safety/check-message` | public | deterministic warning-sign guidance |
| `POST /safety/lookup` | public | privacy-preserving exact directory lookup |

The Related Incidents response includes the current case reference, total related cases, each case’s reference/summary/category/status, match count, each exact shared indicator, both sides’ provenance, and the non-attribution disclaimer.

## Demo utility

```bash
# Running Docker stack
./scripts/demo-data.sh seed
./scripts/demo-data.sh reset

# Direct backend environment
cd backend
python -m app.demo seed
python -m app.demo reset
```

The utility owns only these IDs:

- `demo-connect-a` / `CYB-2026-D001`
- `demo-connect-b` / `CYB-2026-D002`
- `demo-connect-c` / `CYB-2026-D003`
- `demo-connect-d` / `CYB-2026-D004`

It deletes/recreates only those records, creates report version 1 for each, and synchronizes indicators through the production service path. The main app never depends on seed data.

Expected links:

- D001 ↔ D002 through `niriksh-demo@upi`
- D001 ↔ D003 through `case-link.example`
- D004 has no link despite a similar category

## Security properties

Implemented:

- secrets remain server-side;
- password hashes use salted scrypt;
- JWTs expire and routes enforce roles;
- the BFF hides internal API credentials;
- evidence keys/content are private;
- ingestion is size-bounded, path-safe, and hashed;
- CORS is restricted;
- public tracking is allow-listed;
- known development secret defaults are rejected in production;
- provider failure is recorded and falls back rather than discarding a complaint.

Required before handling real sensitive complaints:

- citizen identity and per-complaint grants;
- jurisdiction/unit-scoped RBAC;
- rate limiting and abuse controls;
- immutable/versioned evidence storage, retention, legal hold, and deletion workflows;
- malware scanning, quarantine, safe rendering, and content-disarm;
- key rotation, centralized audit monitoring, backup/restore tests, and incident response;
- data-protection impact assessment, threat model, legal review, and agency SOP mapping;
- formal access, correction, appeal, and false-connection review policy.

## Current limitations

- frontend and backend analysis logic overlap;
- local fallback persistence can be mistaken for a successful server sync;
- long media analysis is synchronous;
- model extraction can miss or misread indicators;
- exact shared identifiers can be recycled, shared, or mistyped and therefore never prove common ownership;
- admin staffing/configuration values are illustrative, not operational telemetry;
- case payload JSON remains a compatibility bridge rather than a fully relational case-reconstruction schema;
- automated browser visual QA was unavailable in the current environment, though lint, tests, and production build were run.

## Prevention intelligence limits

Patterns are a small, explainable exact-match aggregation for the current scale. They are not a graph database, entity-resolution system, or crime-attribution engine. A verified pattern retains the indicator keys that justified its review so a later case can receive a transparent match warning. Production work still needs reviewer identity display, note validation, role/jurisdiction policy, retention/dispute handling, and a controlled publishing workflow for awareness drafts.
