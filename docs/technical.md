# Niriksh technical reference

Last verified against the repository: 29 August 2026

## 1. System overview

Niriksh is a browser-first cybercrime complaint triage prototype. Its primary runtime is a Next.js application that supports complaint intake, evidence preparation, local deterministic analysis, optional Gemini multimodal analysis, report generation, browser-local case tracking, officer review, routing recommendations, and an administrator concept screen.

The current architecture is deliberately hybrid:

```text
Reporter browser
  |
  |-- complaint narrative and structured details
  |-- local evidence preparation and SHA-256
  |-- local deterministic analysis
  |-- local case/report storage
  |
  `-- optional multipart POST /api/analyze
          |
          |-- server-only Gemini SDK
          |-- structured multimodal findings
          |-- best-effort provider-file cleanup
          `-- response merged with local policy result

Officer/citizen/admin views
  `-- read the same browser-local case store

Optional FastAPI service + PostgreSQL
  `-- contract/future-backend foundation; not used by the active UI flow
```

## 2. Technology stack

### Primary application

| Concern | Technology | Why it is used |
|---|---|---|
| Web framework | Next.js 16 App Router | Unified UI, server route, build, and production runtime |
| UI | React 19 + TypeScript | Typed client components and shared contracts |
| Styling | Plain CSS files | Fast prototype iteration without a component-framework dependency |
| Icons | Lucide React | Consistent lightweight icon set |
| Local analysis | TypeScript rules and regular expressions | Repeatable, inspectable, offline behaviour |
| File fingerprinting | Browser Web Crypto | SHA-256 without uploading a file first |
| Local state | React context + `localStorage` | Reliable self-contained demo |
| Voice | MediaRecorder + browser Speech Recognition | Preserve original audio and offer live transcription where supported |
| Connected media analysis | `@google/genai` | Structured image, document, audio, and video understanding |
| Tests | Node test runner through `tsx` | Lightweight TypeScript regression suite |

### Optional backend foundation

| Concern | Technology | Current role |
|---|---|---|
| API | FastAPI | Demonstrates analysis/auth/decision contracts |
| Validation | Pydantic | Typed request and response schemas |
| Server | Uvicorn | Local API runtime |
| Tests | Pytest | Three deterministic contract tests |
| Database | PostgreSQL 17 | Docker Compose foundation; currently unused by the app |

### Deployment

| Concern | Technology |
|---|---|
| Container | Multi-stage Node 22 Alpine image |
| Registry | Amazon ECR |
| Runtime | Amazon ECS Express Mode |
| Health | `GET /api/health` |
| TLS | AWS-managed endpoint plus ACM custom certificate |
| DNS | Porkbun CNAME for `niriksh.scopophobic.xyz` |

## 3. Repository structure

```text
app/
  page.tsx                    public landing page
  report/page.tsx             complaint and report flow
  track/page.tsx              citizen complaint tracking
  dashboard/page.tsx          officer evidence workspace
  cases/[id]/page.tsx         detailed case review
  routing/page.tsx            officer routing dashboard
  admin/page.tsx              administrator concept
  api/analyze/route.ts        connected Gemini analysis
  api/health/route.ts         production health endpoint

components/
  ReportFlow.tsx              end-to-end citizen workflow
  CitizenDashboard.tsx        citizen status experience
  Dashboard.tsx               officer queue
  CaseReview.tsx              detailed evidence/context view
  RoutingDashboard.tsx        human routing queue
  AdminConsole.tsx            simulated operations/governance UI
  AppShell.tsx                officer navigation
  CitizenShell.tsx            citizen shell
  PublicHeader.tsx            shared public navigation
  POVSwitch.tsx               citizen/officer transition

lib/
  analyzer.ts                 deterministic context and policy engine
  multimodal.ts               local/remote result merge
  types.ts                    domain contracts
  case-store.tsx              seeded localStorage repository
  mock-data.ts                demo cases and descriptions
  analysis-benchmark.ts       ten controlled fixtures

apps/api/
  app/main.py                 optional FastAPI routes
  app/schemas.py              Pydantic contracts
  app/services/analysis.py    simplified Python deterministic engine
  tests/test_analysis.py      API contract tests

public/demo-evidence/         fictional demonstration assets
scripts/deploy-ecs-express.sh repeatable AWS deployment
docs/                         architecture and decision documentation
```

## 4. Application routes

| Route | Audience | Function |
|---|---|---|
| `/` | Public | Product explanation, safety guidance, entry points |
| `/report` | Citizen | Intake, evidence, analysis, report, citizen routing handoff |
| `/track` | Citizen | Local complaint status, updates, contacts, guidance |
| `/dashboard` | Officer | Searchable evidence-oriented case queue |
| `/cases/[id]` | Officer | Context, facts, timeline, evidence, map, routing |
| `/routing` | Officer | Routing readiness, units, jurisdiction, queue blockers |
| `/admin` | Administrator concept | Capacity, rules, governance, and audit mock UI |
| `GET /api/analyze` | Browser | Connected-analysis configuration status |
| `POST /api/analyze` | Browser | Multipart Gemini analysis request |
| `GET /api/health` | Infrastructure | No-cache service/version health response |

## 5. Main complaint state machine

`ReportFlow` uses five local screens:

```text
intake
  -> analyzing
  -> analysis
  -> report
  -> routing
```

### Intake readiness

Analysis is enabled only when:

- the typed description is at least 60 characters, or an attached voice description can be processed by a configured connected pipeline
- an incident date is present
- a State/UT is present
- a channel is present
- the declaration is confirmed
- voice recording is not active

The default structured state keeps financial and AI-misuse sections inactive and does not assume a crime category.

### Adaptive fields

The core form collects description, date, channel, State/UT, current status, and an optional account/link. Conditional areas add:

- financial institution, transaction ID/UTR, transaction date, amount, and money status
- suspected AI misuse, media type, identity use, consent, harm type, distribution, and takedown preference
- reporter role, time, district, police station, delay reason, and suspect identifiers

### Reporter review

After analysis, the reporter can:

- edit the generated summary
- return to the intake form
- answer up to four follow-up questions
- inspect evidence findings and limitations
- create the report

Follow-up answers are appended as additional context and the deterministic analyser runs again before the final report is created. If the previous run contained connected findings, those findings are merged into the refreshed local result.

## 6. Evidence intake and browser processing

### Limits

- maximum selected file size: 10 MB
- maximum files retained by the UI: 6
- description length: 3,000 characters
- directly read plain-text content: first 100,000 bytes/characters

### Accepted interface types

The UI supports images, screenshots, video, audio, PDF/document inputs, plain text, CSV, JSON, HTML, pasted messages, and recorded voice descriptions. Actual browser `accept` values and device support determine the exact selectable formats.

### File preparation

For each file, the browser:

1. reads the bytes
2. categorises the file as image, video, audio, or document
3. computes SHA-256 with `crypto.subtle.digest`
4. records a human-readable size
5. reads supported text formats locally
6. creates a `blob:` preview for image/video/audio
7. stores the original `File` in component memory, keyed by SHA-256, for later multipart submission

The resulting `EvidenceItem` can carry:

- filename
- type and MIME type
- size
- preview URL
- SHA-256
- extracted/readable text
- reporter context note
- purpose
- originality label
- demo marker

### Important limitation

The file fingerprint proves only that the same bytes produce the same digest. It does not prove authenticity, authorship, creation time, or chain of custody. `blob:` previews and in-memory `File` objects are not durable across browser reloads.

## 7. Voice handling

The voice-description path uses `navigator.mediaDevices.getUserMedia` and `MediaRecorder`. It prefers WebM/Opus and falls back according to browser support.

When `SpeechRecognition` or `webkitSpeechRecognition` exists:

- language is set to `en-IN`
- interim text appears live
- final transcript is appended to the normal editable description

When recording stops:

- the original audio becomes an `EvidenceItem`
- purpose is `Voice description`
- originality is `Original`
- the media stream is closed

Live transcription is a browser feature. The connected pipeline can still review the saved recording when live transcription is unavailable. Without either transcription or connected analysis, the reporter must provide enough typed context.

Microphone use requires browser permission and a secure context such as HTTPS or localhost.

## 8. Deterministic analysis engine

`lib/analyzer.ts` is the repeatable policy and context layer.

### 8.1 Source construction

The engine builds a list of labelled `TextSource` objects from:

- user description
- `extractedText` and `contextNote` for each evidence item
- incident details
- location details
- financial details
- AI-misuse details
- suspect details

Structured form values are converted into controlled natural-language statements so the same signal and entity functions can operate across all source types.

### 8.2 Signal detection

Regular-expression groups cover:

- suspected AI/synthetic content
- financial activity
- threats
- intimate content
- child-safety context
- active or stopped incidents
- reported loss/no loss
- impersonation
- phishing
- account compromise
- harassment
- harmful/degrading content

Negation checks inspect a short preceding window for phrases such as `no`, `not`, `never`, `without`, and `did not`. This reduces false triggers such as “this is not a threat.” It is intentionally lightweight and is not full linguistic negation parsing.

### 8.3 Entity extraction

The local engine extracts and source-labels:

- platforms
- email addresses
- UPI IDs
- usernames
- URLs
- phone numbers
- monetary amounts
- transaction IDs/UTRs

Emails are extracted before UPI IDs, and username extraction excludes address fragments, preventing known collisions such as treating `alerts@example.com` as a payment identifier.

Structured fields also add facts/entities for channel, account/URL, State, district, police station, bank/wallet, transaction ID, amount, suspect alias, and suspect bank account.

### 8.4 Classification candidates

Candidates are created only when their required signals exist. Current base confidences are:

| Candidate | Base confidence |
|---|---:|
| Synthetic child safety risk | 96 |
| AI-generated harmful content | 94 |
| Phishing | 92 |
| Synthetic media impersonation | 91 |
| Threats | 87 |
| Account compromise | 86 |
| Social media impersonation | 83 |
| Online financial fraud | 80 |
| Online harassment | 76 |

Evidence-source support can add three points, capped at 97. Candidates are sorted by confidence; the first is primary, and up to three candidates at 75 or above become secondary categories. If there is no candidate, the output is `Unclear / needs review` with low confidence.

These values are rule confidence, not empirically calibrated probabilities.

### 8.5 Priority scoring

| Risk indicator | Weight |
|---|---:|
| Child plus intimate/harmful content | +100 |
| Threat | +60 |
| Intimate content | +60 |
| Money reported lost | +50 |
| Incident active | +30 |
| Account compromise | +30 |
| Identity impersonation | +20 |

The total is capped at 100. Thresholds are:

- Critical: 80–100
- High: 50–79
- Medium: 25–49
- Low: 0–24
- Needs review: no reliable primary category

Sensitive child risk is always Critical. The score orders review; it does not estimate truth or guilt.

### 8.6 Context and actions

The engine derives:

- reporter role
- whether the incident is still happening, stopped, unclear, or contradictory
- possible personal, financial, identity, privacy, account, and harassment harms
- actions such as blocking an account, saving evidence, reporting to a platform, contacting a bank, changing a password, contacting police/1930, or stopping a payment

### 8.7 Timeline

The engine finds exact, approximate, and repeated temporal phrases, extracts a nearby sentence, retains the source, removes duplicates, and keeps up to eight locally derived events. Structured incident and transaction dates are added separately.

Relative phrases remain relative; the analyser does not silently convert “yesterday” into an invented exact timestamp.

### 8.8 Contradictions

Current explicit contradictions include:

- money both sent and not sent
- incident both active and stopped

Each contradiction becomes a concern and a plain-language question rather than a conclusion.

### 8.9 Missing information and adaptive questions

Possible missing fields include:

- platform/service
- account/link/contact detail
- approximate date/time
- supporting file
- whether money moved
- whether the incident continues
- bank/wallet/merchant
- transaction ID/UTR
- amount
- AI-content source/original file
- State/UT

The UI receives at most four deduplicated questions per analysis.

### 8.10 Completeness

Expected information starts with six common items, then adds requirements for financial details, AI-misuse details, and structured-form usage. Missing items reduce the known count. The displayed completeness is clamped between 18% and 96%.

Completeness is a heuristic for report preparation, not evidence quality.

### 8.11 Verification readiness

Seven checks are evaluated:

1. usable incident account
2. date/time context
3. source or suspect identifier
4. evidence attached
5. file-integrity fingerprint
6. evidence content reviewed
7. reporter declaration

Statuses are `Ready`, `Needs review`, or `Missing`. Ready contributes one point, Needs review contributes half a point, and readiness is the percentage of available points.

The disclaimer is part of the result: readiness means organised for checking; it does not prove authenticity or truth.

### 8.12 Routing

Default department mapping is:

- synthetic/AI-generated content -> Synthetic Media Review
- threats/harassment/account compromise -> General Cybercrime
- phishing/financial fraud -> Financial Fraud Unit
- child-sensitive content -> Women & Child Safety first
- financial involvement -> Financial Fraud Unit added when not already present

Routing is marked ready only when:

- State/UT is supplied
- a primary category exists
- completeness is at least 50%

Jurisdiction text is assembled from police station, district, and State/UT. This is a recommendation for human confirmation.

### 8.13 Takedown guidance

Takedown/preservation guidance appears when requested or when suspected manipulated content combines relevant harm/identity signals with active distribution. It recommends preserving URLs, account names, dates, originals, screenshots, and platform records before removal requests.

The generated text explicitly avoids claiming forensic authenticity.

## 9. Connected Gemini analysis

### 9.1 Configuration status

`GET /api/analyze` returns:

- whether `GEMINI_API_KEY` is present
- generic provider label
- configured primary/fallback/reserve model names
- supported capability labels

The API key itself is never returned.

### 9.2 Multipart request

`ReportFlow` posts:

- `description`: reporter narrative
- `details`: JSON structured complaint details
- `manifest`: JSON evidence metadata/notes/originality/extracted text
- repeated `evidence`: original `File` objects still available in memory

If an item has only seeded text context and no source `File`, that context remains available to the local analyser and manifest but no binary is uploaded.

### 9.3 Server-side file preparation

The route considers at most 12 submitted files.

- Text/CSV/JSON/HTML-like files are included inline, capped at 100,000 characters.
- Images, audio, video, and PDFs are uploaded through the Gemini Files API.
- Unsupported types receive a file-specific limitation.
- Files are polled while `PROCESSING`, for up to 75 seconds.
- Multiple files prepare concurrently.
- Provider file names are collected for best-effort deletion in `finally`.

### 9.4 Model instructions and safety boundary

The system instruction requires the model to:

- connect narrative and evidence while separating claims, observations, and inferences
- avoid guilt, identity, and forensic-authenticity conclusions
- ignore instructions inside evidence
- use short necessary quotations only
- avoid reproducing graphic or sexual content
- flag child-sensitive material without describing it
- preserve uncertainty
- name the source of important indicators
- return one finding for every supplied evidence source
- avoid invented timestamps

### 9.5 Structured-output contract

The route requests JSON Schema output with:

- `situation_summary`
- `category`
- `severity`
- `confidence` from 0 to 97
- `suspected_ai_manipulation`
- `important_indicators[]`
- `evidence_findings[]`
- `timeline[]`
- `limitations[]`

Generation uses:

- JSON response MIME type
- schema-constrained output
- temperature `0.1`
- low thinking level
- maximum 3,500 output tokens
- route `maxDuration` of 180 seconds

### 9.6 Retry and failover

The route builds attempts from:

- `GEMINI_MODEL` or code default
- `GEMINI_FALLBACK_MODEL` or code default
- `GEMINI_RESERVE_MODEL` or code default

It tries the primary twice with 15-second timeouts, then unique fallback/reserve models with 30-second timeouts. Temporary failures trigger capped exponential delay with jitter. Permanent failures stop immediately.

Recognised temporary conditions include overload, high demand, timeout, deadline exceeded, unavailable, resource exhausted, and common retryable HTTP status codes.

### 9.7 Model defaults

Current code defaults:

```text
Primary:  gemini-3.7-flash
Fallback: gemini-3.6-flash
Reserve:  gemini-3.5-flash
```

Current `.env.example` overrides them as:

```text
Primary:  gemini-3.5-flash
Fallback: gemini-3.6-flash
Reserve:  gemini-3.5-flash
```

Because reserve duplicates primary in the example, the route removes the duplicate and may have only two unique model choices. These values should be standardised and validated against the provider account before production use.

## 10. Local and multimodal result merge

`lib/multimodal.ts` merges connected findings into the deterministic result.

Key rules:

- Connected situation summary/category replace local summary/category when present.
- Severity can increase but cannot be lowered below the deterministic result.
- Confidence becomes the maximum of local and connected confidence, capped at 97.
- Suspected manipulation is an OR across both results.
- Remote highlights and timeline entries are placed first, deduplicated, and capped.
- Evidence findings match by normalised filename, tolerating source-label prefixes and video-frame suffixes.
- A file becomes `AI reviewed` only when it has actual observations, visible text, or concerning signals.
- Provider/file-processing limitations remain attached to the relevant evidence card.
- Evidence-content verification becomes Ready when at least one attachment received connected review, while the disclaimer still requires human verification.
- Model-level limitations remain visible in `engine.limitations`.

When connected analysis is not configured or fails, `addLocalEngine` marks the result as `Local fallback`, records zero media reviewed, and states that binary media was not interpreted.

## 11. Case and report model

The main contracts are defined in `lib/types.ts`.

Important types include:

- `ComplaintDetails`
- `EvidenceItem`
- `GroundedFact`
- `TimelineEvent`
- `EvidenceAnalysis`
- `MultimodalInsight`
- `AnalysisEngine`
- `AnalysisHighlight`
- `VerificationSummary`
- `RoutingInfo`
- `TakedownRecommendation`
- `ContextProfile`
- `AuditEvent`
- `AnalysisResult`
- `TriageCase`

A created `TriageCase` stores the original description, final summary, category, secondary categories, severity, score, completeness, departments, entities, evidence metadata, missing information, risk factors, confidence, full analysis result, complaint details, citizen confirmation, and audit entries.

The prototype reference format is generated in the browser as `CYB-2026-######`. It is not an official acknowledgement number and is not guaranteed globally unique.

## 12. Browser case repository

`CaseStoreProvider` starts with seeded `DEMO_CASES`. After hydration, it reads/writes JSON under:

```text
niriksh-demo-cases-v2
```

Operations are:

- get case by ID
- add/replace a case
- patch a case
- reset to seed data

Restored cases are passed through `withCurrentAnalysis`, so current deterministic rules regenerate analysis details from the stored description, evidence metadata, and complaint details.

This is useful for regression demos but means historic analysis can change when rules change. A production audit record must store immutable analysis versions rather than silently recompute them.

## 13. User interfaces

### Citizen

The landing page provides a clear workflow and emergency guidance. `/report` contains the full complaint-to-routing journey. `/track` shows only the seeded citizen case and newly submitted local cases, with status, responsible unit, updates, downloadable status summary, safety guidance, and contact actions.

The citizen tracking data is illustrative. Names, operating hours, email addresses, and assignment statuses are not backed by a real case-management service.

### Officer

`AppShell` provides persistent navigation for dashboard, routing, registration, and administration. The evidence workspace supports search and filters, urgent-case counts, evidence counts, and links to detailed cases.

Case review displays:

- allegation summary
- important source-backed indicators
- verification readiness
- routing recommendation
- approximate location map
- context
- timeline
- grounded facts
- contradictions
- original description
- evidence previews, observations, and limitations
- missing information

The embedded map is a Google Maps query based on police station, district, and State/UT. It is explicitly approximate.

### Administrator concept

The administration page contains simulated team capacity, priority policy, editable client-side routing rules, governance toggles, and audit displays. These controls are not persisted to a backend and do not configure the actual analyser or ECS service.

## 14. Report generation

The final report view contains:

- prototype reference
- priority and signal score
- category and confidence
- verification readiness
- editable plain-language summary
- top source-backed findings
- timeline
- complete context/evidence/verification details
- contact and official-reporting guidance
- routing handoff

Download options are:

- generated UTF-8 plain-text file
- browser print dialog for PDF

The plain-text export includes context, indicators, evidence explanations, units, routing reasons, and the human-verification disclaimer.

Nothing is uploaded to an authority or external case system by report creation.

## 15. Optional FastAPI contract service

The FastAPI app exposes:

| Endpoint | Function |
|---|---|
| `GET /health` | deterministic demo health |
| `POST /api/v1/auth/login` | two hard-coded demo identities plus environment password |
| `POST /api/v1/complaints/analyze` | simplified deterministic Python analysis |
| `GET /api/v1/triage/queue` | states that queue data is frontend seeded |
| `POST /api/v1/triage/{id}/decision` | validates and echoes an audited demo decision |

The role header and demo tokens are not real authentication. CORS permits only `http://localhost:3000`. The Python analyser is a smaller, separate implementation and can drift from `lib/analyzer.ts`.

`NEXT_PUBLIC_API_URL` is set in Docker Compose, but the current UI does not use it. PostgreSQL credentials in Compose are development defaults, and the API does not connect to the database.

## 16. Security and privacy controls

### Present

- Gemini key remains server-side.
- `.env*` files are ignored except `.env.example`.
- `.dockerignore` excludes secrets, local evidence folders, uploads, Git metadata, logs, docs, and development caches.
- Provider uploads are deleted after each request on a best-effort basis.
- Evidence is treated as untrusted prompt content.
- Model output is schema constrained.
- File count and size are bounded in the client.
- SHA-256 fingerprints are generated locally.
- Security headers include:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - restrictive `Permissions-Policy`
- Production container runs as the unprivileged `node` user.
- The product repeatedly states that findings require human verification.

### Missing for production

- authentication and authorisation
- server-side upload validation
- malware scanning
- encrypted durable object storage
- database row security
- secret injection in the current deployment script
- CSRF/rate-limit/abuse controls
- privacy retention/deletion policy
- immutable audit ledger
- evidence access logs
- content moderation workflow
- legal hold and chain-of-custody support
- secure notification channels
- backup and disaster recovery
- dependency/security scanning enforcement beyond ECR image scan configuration

## 17. Container and deployment architecture

### Next.js build

`next.config.ts` enables `output: "standalone"`, removes the powered-by header, and adds security response headers.

The Docker build has three stages:

1. `deps`: `npm ci`
2. `builder`: copies the repository and runs `npm run build`
3. `runner`: copies only public assets, standalone server, and static chunks

Build stages use `$BUILDPLATFORM`; the runtime image targets the requested deployment platform. The container runs `node server.js` on `0.0.0.0:3000` and includes a health check against `/api/health`.

### ECS deployment script

The script:

1. resolves region/account/service configuration
2. derives an immutable image tag from Git
3. creates missing ECS IAM roles
4. ensures ECR exists with immutable tags, scan-on-push, and encryption
5. logs Docker into ECR
6. builds and pushes `linux/amd64`
7. creates or updates the Express Gateway service
8. configures `/api/health`
9. configures one-to-three-task CPU scaling at a 60% target
10. monitors in text-only mode
11. prints active status, endpoint, and image

The script performs real billable AWS mutations and should be run only with the intended account/region.

### Current public endpoints

- AWS-managed endpoint: `https://ni-cd52db42875a41f4a46dc3b9dbee4e7d.ecs.us-east-1.on.aws/`
- Custom endpoint: `https://niriksh.scopophobic.xyz/`
- Health path: `/api/health`

The custom domain uses an ACM certificate and CNAME to the AWS load balancer. HTTPS has been verified across all returned load-balancer addresses. Plain HTTP currently has no listener/redirect and should not be used.

## 18. Configuration

### Local application

```bash
npm install
npm run dev
```

Recommended Node version: 22 or newer.

### Connected analysis

Create `.env.local` from `.env.example`:

```env
GEMINI_API_KEY=replace_with_server_side_secret
GEMINI_MODEL=gemini-3.5-flash
GEMINI_FALLBACK_MODEL=gemini-3.6-flash
GEMINI_RESERVE_MODEL=gemini-3.5-flash
```

Never prefix the key with `NEXT_PUBLIC_`, commit `.env.local`, add it to the Docker image, or include it in documentation/screenshots.

### Docker Compose

```bash
docker compose up --build
```

This starts web, optional API, and PostgreSQL. It is broader than the actual active browser architecture because the web app can run without the API/database.

### AWS deployment

```bash
AWS_REGION=us-east-1 ./scripts/deploy-ecs-express.sh
```

Prerequisites are authenticated AWS CLI, Docker Buildx, suitable IAM permissions, a default VPC, and public subnets. Connected analysis additionally requires secure runtime secret injection, which the current script does not configure.

## 19. Test strategy

### TypeScript

Run:

```bash
npm test
```

The 16 tests cover:

- flagship synthetic-investment scenario
- ambiguous input
- hard child-safety escalation
- threatening messages
- evidence-only context
- multi-evidence source attribution
- actions and uncertainty
- contradictory payment statements
- negated threats
- email-versus-UPI parsing
- all ten controlled benchmark fixtures
- structured AI-misuse/takedown behaviour
- multimodal merge and human-verification boundary
- disclosed local fallback
- video filename variation
- file-specific video-preparation failure

### Python

From `apps/api` with dependencies installed:

```bash
pytest
```

The three tests cover flagship routing, ambiguous input, and child-safety escalation.

### Static/build checks

```bash
npm run lint
npm run build
```

The benchmark is a regression suite for known fixtures, not a measured real-world accuracy score.

## 20. Demo data

Four intake scenarios are embedded in `ReportFlow`:

- threatening messages
- investment deepfake
- phishing and payment loss
- synthetic child-safety risk

Seeded officer cases include synthetic investment fraud, child safety, threats, phishing, social impersonation, voice cloning, insufficient information, and ambiguous reports.

All included evidence is fictional demonstration material. Several demo items include `extractedText` so the deterministic engine can show meaningful evidence context even when Gemini is unavailable. This text is test fixture data, not OCR performed at runtime.

## 21. Current limitations

- The primary case repository is browser-local.
- There is no real login or permission system.
- Citizen/officer/admin separation is presentational, not a security boundary.
- The deployed service may run only local analysis unless a Gemini secret is attached.
- Local mode does not read arbitrary image pixels, PDF layout, audio, or video.
- Connected findings are triage observations, not forensic evidence.
- The admin console and citizen contact/status data include simulated values.
- FastAPI and PostgreSQL are not integrated into the active workflow.
- Reports are not official complaints or acknowledgements.
- No government/platform submission occurs.
- Uploaded binary files are not durably restored after reload.
- The reference-number generator is a demo mechanism.
- Rules and confidence values are not statistically calibrated.
- English/India-oriented patterns dominate the current analyser.
- Long files remain constrained by client size limits and synchronous request duration.
- There is no HTTP-to-HTTPS redirect on the custom domain.

## 22. Production evolution

A safe production sequence is:

```text
Authentication and role-based access
  -> database-backed complaints and immutable audit versions
  -> encrypted object storage and evidence derivatives
  -> asynchronous media-processing jobs
  -> provider abstraction and secret-managed workers
  -> human review/override workflow
  -> measured evaluation and monitoring
  -> notification and official integration adapters
```

Specific additions should include:

- citizen identity/OTP appropriate to policy, with sensitive anonymous pathways
- officer/admin RBAC
- signed upload URLs and server-side file validation
- antivirus and content-safety scanning
- immutable originals and separate derived media
- versioned hashes and transformation logs
- PostgreSQL migrations and repository interfaces
- background queues for large media
- idempotency, retries, and job status
- model/prompt/schema version recording
- review corrections stored as evaluation data
- calibrated urgency and extraction metrics
- privacy, retention, deletion, and legal-hold policies
- infrastructure as code for ECS, certificates, DNS, logs, alerts, and secrets
- explicit HTTP-to-HTTPS redirect

## 23. How to describe the system accurately

Preferred:

> Niriksh connects a complaint and its evidence into a source-backed case summary, prioritisation signal, verification checklist, and human routing recommendation.

Avoid:

- “It proves a deepfake.”
- “It verifies the evidence.”
- “It identifies the criminal.”
- “It automatically files the complaint.”
- “It is 100% accurate.”
- “It is production-ready for sensitive public complaints.”

The strongest technical story is the combination of multimodal context understanding, deterministic safety policy, source attribution, explicit uncertainty, graceful fallback, and human-controlled action.
