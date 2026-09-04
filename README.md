# Niriksh — evidence context analysis for cybercrime complaints

Niriksh is a working browser prototype for turning an unstructured complaint and its evidence into a source-labelled case summary for human review. It focuses on understanding context before any routing, enforcement, or legal decision.

It does **not** determine guilt, file a police report, verify an online account, or claim forensic authenticity.

## Run the complete product

The application now has a real FastAPI backend and database. The simplest complete local start is:

```bash
docker compose up --build
```

This starts the Next.js web app on port 3000, FastAPI on port 8000, and PostgreSQL 17. Interactive backend documentation is available at `http://localhost:8000/docs`.

Node.js 22+ is recommended:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The local text analyser and browser cache still provide an offline demo fallback, but PostgreSQL is the canonical store in the complete stack.

To enable the multimodal pipeline, copy `.env.example` to `.env.local`, add a server-side `GEMINI_API_KEY`, choose `GEMINI_MODEL`, and restart the development server. Gemini analysis is then attempted automatically, and the deterministic local engine remains the fallback. `GEMINI_FALLBACK_MODEL` and `GEMINI_RESERVE_MODEL` provide distinct capacity pools for temporary overloads or timeouts. Never expose the key through a `NEXT_PUBLIC_` variable.

The main product areas are:

- `/` — public landing page, safety guidance and a short explanation of the workflow.
- `/report` — add a complaint and evidence, review the analysis, answer missing-context questions, and download a report.
- `/dashboard` — review the local case workspace and open a case's context, timeline, facts, and evidence.
- `/routing` — review recommended units, jurisdiction, verification readiness, missing information and priority.

## Suggested product walkthrough

1. Open `/report` and either complete the guided incident form or select **Load a complete sample**.
2. Select **Analyse complaint**. Check the priority, context, important source-backed indicators, verification readiness, evidence limitations, and questions.
3. Correct the summary or answer a question, then create and download the structured report.
4. Continue to the routing screen, then open `/dashboard` to review the saved case from the evidence workspace.
5. Open `/routing` to review recommended destinations and cases that still need information.

## What actually works

- Separate analysis of the user description, readable evidence text, and user evidence notes
- Guided incident, jurisdiction, AI-misuse, financial and optional suspect-information forms
- Typed or recorded voice descriptions, with live browser transcription where supported and the original recording preserved as evidence
- A dedicated AI-generated harmful-content category covering consent, identity use, distribution and requested takedown support
- Context extraction for reporter role, whether the incident is ongoing, possible harm, and actions already taken
- Source-labelled dates, repeated events, platforms, usernames, email, phone, UPI ID, URLs, amounts, and transaction IDs
- Timeline construction and contradiction detection
- Follow-up questions for missing or conflicting context
- Deterministic category, confidence, priority score, and plain reasons
- Hard child-safety escalation and explicit uncertainty for insufficient information
- Browser SHA-256 fingerprints for selected files
- Preview of local images and videos and direct reading of plain-text files
- Audio playback, common evidence-file uploads, and a direct paste-chat/SMS/email evidence path
- Default server-side Gemini analysis of complaint context, screenshots, images, PDFs, audio and short videos when Gemini is configured
- Structured AI output merged with the deterministic safety and routing pipeline
- A visible analysis-mode disclosure so local fallback is never presented as media understanding
- Database-backed complaint records with an offline browser cache, source-focused case review, and report download
- Versioned analysis runs and report snapshots
- Streamed private evidence ingestion with SHA-256 hashing
- JWT officer/admin authentication, role checks, optimistic complaint versions, and audit events
- Human routing decisions with mandatory reasons for overrides
- A protected, idempotent Bhumika integration that accepts curated WhatsApp complaints and evidence, then creates the Niriksh analysis, report, and tracking number
- Human-confirmed routing information and copyable content-takedown request text
- Ten controlled benchmark fixtures covered by the automated test suite

The benchmark is a regression check for known examples. A 10/10 result means those fixtures behave as expected; it is **not** a real-world accuracy percentage.

## Multimodal boundary

Without `GEMINI_API_KEY`, images, video and audio can be previewed and fingerprinted but are not interpreted. With the key configured and the reporter's consent, the server sends complaint context and supported evidence to Gemini for native image, document, audio and short-video understanding. Provider file uploads are deleted after each analysis attempt. Deepfake detection, metadata forensics and external identity/account verification are not implemented. Multimodal observations are triage indicators, not forensic authenticity findings.

## Technology

- Next.js 16, React 19, and TypeScript for the product UI
- A local deterministic TypeScript context engine for signals, negation, classification, priority, and questions
- Regular-expression and source-aware parsing for structured details and timelines
- Browser Web Crypto for SHA-256 file fingerprints
- PostgreSQL-backed case storage with a browser offline cache and retry queue
- An optional server-only Google Gemini `generateContent` route using the official `@google/genai` SDK and structured JSON output
- Automatic, disclosed Flash-model failover for temporary provider overloads and timeouts
- Gemini Files API inputs for image, document, audio and native video analysis, with best-effort deletion after every request
- Node's test runner through `tsx` for analyser regression tests
- FastAPI, Pydantic, SQLAlchemy, Alembic, and PostgreSQL for the canonical backend
- A versioned server-to-server integration contract isolated from officer and citizen APIs
- HTTP-only officer web sessions and protected workspace routes
- Selectable private local-disk or S3 evidence storage

The deterministic pipeline always remains available as a repeatable fallback. When the multimodal route is configured, the result screen names the mode and model and shows how many evidence items received AI review.

## Verify

```bash
npm test
npm run lint
npm run build
cd backend && pytest -q
```

## Deploy to Amazon ECS Express Mode

The production image uses Next.js standalone output, runs as the unprivileged `node` user, listens on port `3000`, and exposes `GET /api/health` for load-balancer and container health checks.

Prerequisites are Docker, AWS CLI v2, an authenticated AWS account, a default VPC with public subnets, and an AWS Secrets Manager JSON secret. Deploy the API first:

```bash
AWS_REGION=us-east-1 NIRIKSH_API_SECRET_ARN='<secret-arn>' ./scripts/deploy-ecs-express-api.sh
```

Then deploy the web service against the API endpoint:

```bash
AWS_REGION=us-east-1 BACKEND_API_URL='https://<api-endpoint>/api/v1' NIRIKSH_WEB_SECRET_ARN='<secret-arn>' ./scripts/deploy-ecs-express.sh
```

The scripts create/update immutable ECR images and separate `niriksh-api` and `niriksh` services. Database, Gemini, integration, and object-storage credentials are injected from Secrets Manager rather than committed or baked into images.

The active backend is in `backend/`; the previous `apps/api` contract stub has been removed. Bhumika continues owning its existing Meta account, app, phone number, conversation flow, and outbound replies. Niriksh receives only Bhumika's curated form submission and optional evidence bytes. See `docs/deployment.md`, `docs/bhumika-integration.md`, and `docs/demo-script.md` for the exact sequence and mentor walkthrough.
