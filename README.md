# Niriksh — Understand → Learn → Prevent

Niriksh is cybercrime prevention intelligence built from real incident patterns. It turns scattered complaints and mixed evidence into structured, source-backed case intelligence; then uses exact shared indicators to surface explainable, human-reviewed prevention patterns.

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

- `/` — prevention-first product story
- `/prevention` — emerging and verified prevention intelligence
- `/prevention/{id}` — explainable pattern evidence and human review
- `/awareness` — lightweight awareness/advisory drafts from verified patterns
- `/report` — guided complaint and evidence intake
- `/whatsapp` — Bhumika-derived WhatsApp-style guided chat that files into Niriksh
- `/track?token=...` — allow-listed status through a signed tracking link
- `/dashboard` — cases in received order, without AI priority ranking
- `/cases/{id}` — case reconstruction, provenance, timeline, indicators, active signals, missing information, evidence, status, and Related Incidents
- `/routing` — human-confirmed subject-folder and destination workflow
- `/safety` — deterministic suspicious-message guidance and privacy-protected identifier lookup
- `/admin` — illustrative governance controls and audit view

## Demo dataset

Start the Docker stack, then seed six fictional cases:

```bash
./scripts/demo-data.sh seed
```

Open `/prevention`. Five fictional reports share the reserved UPI ID `demo-invest@upi` and domain `wealth-demo.example`; `CYB-2026-D004` is deliberately similar in category but has no exact shared pattern. See [prevention intelligence](docs/prevention-intelligence.md) for the full walkthrough.

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

### Prevent

- explainable pattern candidates aggregated from the existing exact indicators
- human review lifecycle: unreviewed, verified, dismissed, or needs more evidence
- verified-pattern warnings on future reports, showing matching identifiers and support count
- controlled awareness-draft action after verification; publication still requires human approval

The prevention loop deliberately separates evidence from impact claims:

- **Observed:** exact recurring indicators and linked cases;
- **Decided:** human review and verification;
- **Acted:** warning matches, watchlist decisions, and approved awareness drafts;
- **Learned:** follow-up outcomes such as acknowledgement, intervention, or reduced repeat harm.

The demo can prove the first three activity checkpoints. It does not claim that harm was prevented until an outcome is collected and reviewed.

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

The economical demo deployment uses one ARM64 EC2 instance for the Next.js and FastAPI containers. PostgreSQL and private evidence storage remain in the existing Supabase project. Caddy provides HTTPS, and GitHub Actions verifies and deploys every successful change to `main` through short-lived AWS OIDC credentials.

The deployment creates no ECS, Fargate, load balancer, RDS, or NAT Gateway resources. Start with the complete friend-handoff instructions in [the EC2 deployment runbook](docs/deployment.md). Legacy ECS Express scripts remain only for historical deployments and are not used by the current workflow.

Production secrets live only in root-readable environment files on the demo host; they never enter images, GitHub, documentation, or `NEXT_PUBLIC_*` values. Detailed architecture and decision records are in [docs/architecture.md](docs/architecture.md), [docs/technical.md](docs/technical.md), [docs/deployment.md](docs/deployment.md), and [docs/decisions.md](docs/decisions.md).

## WhatsApp and Bhumika boundary

The `/whatsapp` route is a browser-based simulation derived from Bhumika and files real local Niriksh cases; it is not connected to Meta. Live WhatsApp transport remains owned by the separate Bhumika deployment, which submits curated complaints and evidence through Niriksh's protected `/integrations/bhumika/intakes` API. Local Compose enables that API with a development-only integration key; production must supply a separate random secret to both services.
