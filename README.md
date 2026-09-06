# Niriksh — Report → Understand → Connect

Niriksh turns scattered cybercrime complaints and mixed evidence into structured, source-backed case intelligence. It preserves what the reporter submitted, reconstructs supported events, extracts explicit cyber indicators, identifies useful missing information, and shows when the same normalized identifier occurs in another complaint.

Niriksh assists people; it does not decide guilt, authenticity, urgency, priority, FIR registration, legal classification, routing, or enforcement. A Related Incident is a potential connection based on an exact shared identifier—not offender attribution.

## Run the complete product

Copy the example configuration and supply your own local secrets:

```bash
cp .env.example .env
docker compose up --build
```

This starts:

- Next.js web application: `http://localhost:3000`
- FastAPI: `http://localhost:8000`
- interactive API documentation: `http://localhost:8000/docs`
- PostgreSQL 17 as the canonical local database

For frontend-only development (Node.js 22+ recommended):

```bash
npm install
npm run dev
```

The browser cache and deterministic TypeScript analyser provide a disclosed offline fallback. The Docker stack is required for canonical persistence, private evidence storage, authentication, reports, audit history, and Related Incidents.

## Product areas

- `/` — the Report → Understand → Connect product story
- `/report` — guided complaint and evidence intake
- `/track?token=...` — allow-listed status through a signed tracking link
- `/dashboard` — cases in received order, without AI priority ranking
- `/cases/{id}` — case reconstruction, provenance, timeline, indicators, active signals, missing information, evidence, status, and Related Incidents
- `/routing` — human-confirmed subject-folder and destination workflow
- `/safety` — deterministic suspicious-message guidance and privacy-protected identifier lookup
- `/admin` — illustrative governance controls and audit view

## Demo dataset

Start the Docker stack, then seed four fictional cases:

```bash
./scripts/demo-data.sh seed
```

Open `/cases/demo-connect-a`. The case shares the fictional UPI ID `niriksh-demo@upi` with `CYB-2026-D002` and the reserved domain `case-link.example` with `CYB-2026-D003`. `CYB-2026-D004` is deliberately similar in category but has no exact shared identifier.

Reset only the demo fixtures with:

```bash
./scripts/demo-data.sh reset
```

Seeding is repeatable and never deletes non-demo complaints. See [the demo guide](docs/demo-script.md) for the two-minute walkthrough.

## What is implemented

### Report

- adaptive incident, jurisdiction, financial, identity-misuse, and optional suspect-information fields
- narrative, pasteable message text, screenshots, documents, image, audio, and short-video inputs where supported
- streamed private backend evidence storage with SHA-256 digests
- browser speech recognition where supported, while retaining the original recording
- reporter review/correction before a structured report is created

### Understand

- concise incident reconstruction
- chronological events with explicit precision and source labels
- a visual distinction between original evidence, extracted facts, and analysis-assisted observations
- useful cyber indicators without treating generic entities as indicators
- missing-information questions with a short explanation of why the detail matters
- factual active signals that never become a priority score
- versioned analysis runs and immutable report snapshots
- current case status, human routing decisions, and audit events

### Connect

- persisted `case_indicators` linked to complaints and source evidence where available
- conservative deterministic normalization for phone numbers, emails, UPI IDs, domains, URLs, social handles, transaction IDs, and account identifiers
- exact `(indicator_type, normalized_value)` matching in PostgreSQL
- grouped related cases showing every exact shared indicator and its source
- no embeddings, fuzzy matching, graph database, semantic narrative matching, or automated offender attribution

## Analysis boundary

The deterministic organiser is always available. If `GEMINI_API_KEY` is configured, connected analysis can assist with structured extraction, source-labelled observations, document/image understanding, and transcription. Provider failure falls back to the local result and remains visible to the user.

Connected analysis does not perform forensic authenticity or deepfake detection. Submitted evidence is untrusted content: text inside it is treated as evidence, never as an instruction to the application or model policy.

## Technology

- Next.js 16, React 19, and TypeScript
- FastAPI, Pydantic, SQLAlchemy 2, and Alembic
- PostgreSQL/Supabase PostgreSQL; SQLite only for isolated tests
- private filesystem or S3-compatible evidence storage (Supabase Storage is supported)
- salted scrypt password hashes, JWTs, role checks, and HTTP-only officer sessions
- optional server-side Google Gemini integration with structured output and bounded fallback
- Node test runner through `tsx` and Pytest

## Verify

```bash
npm test
npm run lint
npm run build
cd backend
DATABASE_URL=sqlite:////tmp/niriksh-test.db EVIDENCE_STORAGE_BACKEND=local pytest -q
```

## Deployment

The existing deployment uses separate `niriksh` web and `niriksh-api` ECS Express services. Deploy the API first, then the web service:

```bash
AWS_REGION=us-east-1 NIRIKSH_API_SECRET_ARN='<secret-arn>' ./scripts/deploy-ecs-express-api.sh
AWS_REGION=us-east-1 BACKEND_API_URL='https://<api-endpoint>/api/v1' NIRIKSH_WEB_SECRET_ARN='<secret-arn>' ./scripts/deploy-ecs-express.sh
```

Secrets belong in AWS Secrets Manager, never in images, Git, documentation, or `NEXT_PUBLIC_*` values. Run Alembic through revision `20260906_0005` before serving the Connect API. Detailed architecture, deployment, and decision records are in [docs/architecture.md](docs/architecture.md), [docs/technical.md](docs/technical.md), [docs/deployment.md](docs/deployment.md), and [docs/decisions.md](docs/decisions.md).

## Current scope boundary

Bhumika/WhatsApp is not part of the current Niriksh implementation or demo path. Historical integration modules and documents may remain in the repository for prior-work traceability, but Niriksh does not require them and this release does not advertise or modify them. A future intake adapter can call the canonical complaint API without changing the case model.
