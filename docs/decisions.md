# Niriksh decision record

Last updated: 6 September 2026

## Purpose of this document

This document records how Niriksh evolved, why the major product and technical choices were made, which ideas were superseded, and which boundaries remain intentional. It is an architectural decision record and project history, not a claim that every discussed capability is production-ready.

The record was reconstructed from:

- `plan.md`
- the current repository and implementation
- Git commits `b9d67a7` and `4ba67ca`
- five project-specific Codex sessions from 26–28 August 2026
- the deployment and custom-domain troubleshooting session

Sensitive values such as API keys, certificate validation tokens, and AWS account identifiers are deliberately omitted.

> **Current-state notice:** ADR-049 through ADR-056 define the current release. Older entries are retained as project history. Where they mention priority scoring, AI routing, Bhumika/WhatsApp as a required channel, or broader prevention/intelligence features, the newer decisions supersede them.

## Current product statement

> Niriksh turns scattered cybercrime complaints and evidence into structured, source-backed case intelligence, then surfaces exact shared indicators across incidents for human review.

The product is intended to help with the first-mile preparation problem: complaints arrive as incomplete narratives plus screenshots, messages, receipts, audio, video, and links; a reviewer must understand the context, inspect supported active signals, find useful identifiers, ask for missing information, and decide what happens next.

Niriksh is not an autonomous investigator, deepfake detector, guilt engine, legal decision-maker, police-report filing service, or forensic authenticity tool.

## Non-negotiable product principles

1. Evidence context is the core feature; routing and dashboards are downstream views.
2. Reporter claims, evidence observations, system inferences, and human decisions must remain distinguishable.
3. Every important finding should retain a source.
4. Factual active signals and evidence completeness are separate concepts; neither becomes an automated priority.
5. Safety-related wording remains factual, deterministic where possible, and inspectable.
6. A provider failure must not prevent a reporter from preparing a case.
7. Uncertainty must be shown rather than converted into a confident category.
8. A reporter must be able to review and correct the generated summary.
9. Routing, takedown, and authority submission remain human-confirmed actions.
10. The public experience should explain the outcome without exposing unnecessary operational jargon.

## Evolution of the project

### 1. Initial MVP: complete demo over enterprise completeness

The original plan described a broad complaint-triage platform with complainant, triage-officer, and administrator roles; a Next.js frontend; a FastAPI backend; PostgreSQL; evidence storage; classification; severity; completeness; routing; and an audit trail.

The repository was initially greenfield. The first implementation decision was to build the shortest convincing end-to-end demo rather than a partially implemented enterprise stack. The early prototype, then called Sentinel, therefore used:

- a browser-first Next.js application
- deterministic classification and priority rules
- seeded cases and one-click demo data
- browser persistence
- a small FastAPI service as a contract boundary
- PostgreSQL in Docker Compose as a foundation rather than an active store

The motivation was demo reliability: judges could see a complete citizen-to-reviewer flow even without an API key, database, or network connection.

Status: accepted as the MVP delivery strategy. The name and product emphasis changed later.

### 2. Sentinel became Niriksh

The project was renamed Niriksh. The brand was reframed around observation and evidence understanding rather than generic case management.

The preferred positioning became:

> Niriksh — Evidence intelligence for cybercrime complaints.

The team intentionally avoided making “AI” the entire product identity. AI is an enabling capability inside the pipeline; the user-facing value is evidence understanding, prioritisation, and human-review preparation.

Status: accepted.

### 3. Officer-first dashboard became evidence-first and citizen-first

The first prototype led with an operational dashboard. Feedback identified that this looked like a generic admin product and buried the main innovation. The product was reorganised around:

```text
Complaint
  -> evidence/context analysis
  -> reporter review
  -> report creation
  -> routing information
  -> officer review
```

The citizen experience became the primary demo path, with the officer workspace retained as a downstream operational view. An administrator concept remained available but was no longer the product's main story.

Status: accepted.

### 4. Evidence analysis changed from simulated results to provenance-aware analysis

Early demo outputs were largely predetermined or based on complaint keywords. This was considered insufficient for a product whose core claim is evidence understanding.

The local analyser was rebuilt to treat the following as separate sources:

- user description
- readable text from each evidence item
- reporter notes about each evidence item
- incident form fields
- location fields
- financial fields
- AI-misuse fields
- suspect identifiers

It gained source-labelled facts, entity extraction, approximate timelines, action recognition, negation handling, contradiction detection, missing-information questions, verification readiness, and explicit limitations.

Status: accepted and implemented in `lib/analyzer.ts`.

### 5. Four information layers must not be mixed

A central trust decision emerged during the analysis redesign:

| Layer | Example | Owner |
|---|---|---|
| Reporter claim | “They threatened me yesterday.” | Reporter |
| Evidence observation | “The screenshot contains ‘I know where you work.’” | Evidence tool/model |
| System inference | “This may indicate escalating risk.” | Analysis pipeline |
| Human decision | “Route for urgent threat review.” | Authorised reviewer |

The current data model does not encode these as four formal discriminated unions, but it approximates the separation through source-labelled facts, highlights, evidence findings, analysis results, and audit events. A future backend should formalise this boundary.

Status: accepted in principle; partially represented in the current data model.

### 6. Deterministic policy remains outside the multimodal model

The local TypeScript analyser remains authoritative for transparent policy logic such as:

- hard child-safety escalation
- risk weights and severity thresholds
- completeness checks
- verification-readiness checks
- follow-up-question generation
- routing readiness
- preservation/takedown prompting

The multimodal model adds evidence and context understanding but is not allowed to own legal, forensic, or enforcement decisions.

Reasons:

- repeatable offline behaviour
- inspectable rules
- reliable demo operation
- provider independence
- safer critical escalation
- clear testability
- graceful fallback during model outages

Status: accepted.

### 7. Urgency and completeness are separate

The project rejected the idea that poorly documented cases should automatically receive low priority. A child-safety complaint may be critical even when account identifiers or original evidence are missing.

Niriksh therefore calculates:

- a severity/signal score from harm and urgency indicators
- complaint completeness from missing context
- verification readiness from seven operational checks

These values are displayed separately and have different meanings.

Status: accepted.

### 8. Uncertainty is a valid result

Ambiguous input returns `Unclear / needs review` and `Needs review` instead of forcing a category. Contradictory statements become questions. Negated threat wording should not create a threat classification.

This decision was reinforced through benchmark fixtures for ambiguous complaints, negation, contradictory payments, and evidence-only context.

Status: accepted and tested.

### 9. The complaint form became adaptive

An early long form was judged tiring and difficult to scan. The form was redesigned to ask for the smallest useful core:

- what happened
- incident date
- channel/platform
- State or Union Territory
- whether the incident is ongoing
- reporter declaration

Evidence and an account/link remain easy to add. Financial, AI-misuse, district, police-station, delay, reporter-role, and suspect fields appear only when relevant or expanded.

The system intentionally does not require a national-ID upload in the prototype. Identity documents would add privacy and security risk without improving evidence understanding, especially before authentication and secure storage exist.

Status: accepted.

### 10. Reporter accountability should not become intimidation

The design uses:

- a neutral truthfulness declaration
- evidence originality labels
- file fingerprints
- editable summaries
- follow-up questions
- preserved audit events
- explicit “do not guess” guidance for suspect identifiers

The project rejected a threatening false-complaint warning as the primary control because it could discourage legitimate or vulnerable reporters. Production abuse controls—OTP, rate limits, duplicate detection, corrections, and sensitive anonymous pathways—remain future work.

Status: accepted for the prototype; production controls deferred.

### 11. A new AI-generated harmful-content category was required

The initial taxonomy was expanded to cover AI-generated or manipulated material involving:

- identity use
- consent
- image, video, voice, text, or profile media
- intimate, humiliating, threatening, fraudulent, or harassing content
- child identity
- continued distribution
- requested takedown support

The output never treats “AI-generated” as a forensic finding. It records a reported or model-observed manipulation indicator requiring specialist verification.

Status: accepted, deployed, and production-smoke-tested.

### 12. Evidence integrity begins in the browser, but is not chain of custody

Selected files receive a browser-generated SHA-256 digest. The reporter can label a file as original, screenshot, forwarded, edited, unknown, or demo material. Plain-text evidence is read locally, and images/audio/video are previewable.

The digest is described as a unique file check, not proof of authenticity. Production evidence preservation would require immutable object storage, ingestion timestamps, uploader identity, access logs, derivative tracking, malware scanning, and formal chain-of-custody procedures.

Status: accepted for the prototype; full evidence preservation deferred.

### 13. A public Analysis Lab was built, then removed

A temporary `/lab` route exposed controlled benchmark scenarios and raw analysis output so the local analyser could be tested honestly. It helped identify a rule that over-weighted “password changed” as phishing instead of account compromise.

Once the benchmark moved into automated tests, the public Analysis Lab was removed because it distracted from the citizen workflow. The route was replaced in navigation by the routing dashboard.

Status: superseded. Benchmark retained as developer tooling in `lib/analysis-benchmark.ts` and `tests/analyzer.test.ts`.

### 14. Fictional evidence is preferred for demos

The project needed realistic media without exposing private people or using harmful real-world material. It therefore uses clearly fictional chat, identity-theft, payment, and phishing images. Demo assets carry supplied text context so the deterministic pipeline remains demonstrable if connected media analysis is unavailable.

Four one-click scenarios were selected:

1. Threatening messages
2. Investment deepfake
3. Phishing and payment loss
4. Synthetic child-safety risk

The investment-deepfake scenario became the primary pitch because it demonstrates synthetic media, identity misuse, active distribution, financial loss, multi-unit routing, and evidence review in one case.

Status: accepted.

### 15. OpenAI multimodal support was considered, then Gemini became the provider

The first connected multimodal design used an OpenAI-specific route with image/file inputs, separate audio transcription, and sampled video frames. It was technically workable but required modality-specific preprocessing.

Gemini Flash was chosen instead because the selected Gemini API path supports images, PDFs, audio, and video natively through one structured-analysis flow. This simplified the evidence adapter and preserved more native media context.

The public UI later removed vendor and model names and uses “analysis pipeline” or “connected media analysis.” The internal result still records the actual provider/model for traceability.

Status: OpenAI route superseded; Gemini accepted as the current provider.

### 16. The provider key remains server-side

`GEMINI_API_KEY` is read only by the Next.js server route. It must never use a `NEXT_PUBLIC_` prefix. The route exposes only a configuration-status response to the browser.

Temporary provider uploads are deleted with best-effort cleanup after every analysis attempt. Evidence content is treated as untrusted input, and the model instruction explicitly tells the provider not to follow instructions embedded in evidence.

Status: accepted.

### 17. Structured model output is mandatory

The provider is required to return a JSON object matching a schema containing:

- situation summary
- category
- severity
- confidence
- suspected manipulation indicator
- source-labelled important indicators
- one finding per evidence source
- timeline
- limitations

The temperature is low, confidence is capped, and child-sensitive material receives restrictive output instructions. Free-form model prose is not used as the application contract.

Status: accepted.

### 18. Connected analysis is the default path; local analysis is the fallback

The UI briefly offered an explicit provider checkbox. Feedback was that connected analysis is the MVP's core capability and should not look like an optional extra. The checkbox and duplicate status panels were removed. When the server reports that Gemini is configured, the complaint flow automatically attempts connected analysis. If it fails, local analysis appears with a visible limitation notice.

There is a known documentation mismatch: the README currently says the reporter can turn Gemini off, but the current `ReportFlow` has no user-facing toggle. The implementation reflects the later decision to run connected analysis automatically when configured.

Status: accepted in code; README wording needs reconciliation.

### 19. Provider overload requires bounded failover

Live testing showed temporary high-demand errors, timeouts, and `DEADLINE_EXCEEDED` responses. The route was changed from a hanging interaction path to `generateContent`, low thinking, bounded timeouts, retry/backoff, and model failover.

The current attempt sequence is:

1. configured/default primary model, 15-second request
2. a distinct configured fallback model, 20-second request
3. a distinct stable reserve model, 20-second request
4. deterministic local fallback in the client

Using separate model capacity pools proved more reliable than immediately retrying an overloaded primary. The complete generation failover stays within the load balancer request window, and server logs retain the model-specific failure reasons without exposing them to the reporter.

Temporary 429, 500, 502, 503, 504, overload, timeout, deadline, and resource-exhaustion signals are treated as retryable. Permanent/schema/permission failures are returned immediately.

Status: accepted and implemented.

### 20. Video must not fail silently

The first video path waited only 15 seconds for provider-side preparation. A video could therefore be skipped while the complaint text still produced a successful-looking report.

The server now:

- waits up to 75 seconds for provider file preparation
- prepares multiple files concurrently
- requires source-specific evidence findings
- tolerates harmless source-label and filename variations
- records a per-file limitation if preparation or matching fails
- counts a file as reviewed only when content findings exist

Status: accepted and tested.

### 21. Voice description and audio evidence are different concepts

The reporter may type or record the incident description. When browser speech recognition is available, the spoken description is transcribed into the editable text field. The original recording is also attached as evidence.

Separate uploaded calls and voice notes remain evidence items. They are semantically analysed only by the connected pipeline; local mode merely preserves and previews them.

Status: accepted.

### 22. The report prioritises meaning over density

Early reports contained useful information but displayed all sections with equal visual weight. The report was redesigned so the first screen answers:

1. What did the system understand?
2. What requires attention first?
3. How ready is the case for verification?
4. What should the reporter do next?

Priority uses severity colour, a signal meter, and a “human review” marker. Important findings and the timeline are visually prominent; complete evidence and verification details remain expandable.

The status is explicitly “Prepared—not yet submitted.”

Status: accepted.

### 23. Routing is a recommendation, not a dispatch action

The routing page shows jurisdiction, primary and supporting review units, reasons, readiness, missing information, and official next steps. It does not create an FIR, submit to the National Cyber Crime Reporting Portal, contact a police station, or dispatch a case.

The officer routing dashboard was made actionable with:

- an “act first” case
- busiest destination
- queue blockers
- per-case next action
- human confirmation checklist

Status: accepted.

### 24. Citizen, officer, and administrator views are distinct

The UI was redesigned around separate roles:

- Citizen: complaint registration and personal complaint tracking
- Officer: evidence workspace, case review, and routing dashboard
- Administrator: operations, routing-rule, governance, and audit concepts

A persistent point-of-view switch links citizen and officer workspaces through a short transition screen. Citizen tracking filters the local case store to the seeded citizen example and newly submitted cases rather than exposing the full officer queue.

The visual system moved from a generic blue dashboard to oxblood, deep forest, ivory, and warm neutral tones, with larger typography and a shared public header. CSS import order was corrected so the refresh layer consistently overrides legacy styles.

Status: accepted.

### 25. Browser-local storage was chosen for demo reliability

Cases are stored under `niriksh-demo-cases-v2` in `localStorage`, with seeded cases used on first load. This avoids database/network dependencies during a demonstration and allows newly prepared reports to appear immediately in the reviewer workspace.

Trade-offs:

- no cross-device access
- no authentication boundary
- no durable server audit record
- object-URL previews do not survive reload reliably
- local data can be edited or cleared by the user
- not appropriate for real sensitive evidence

Status: superseded as the source of truth by ADR-033; retained only as an offline/demo cache.

### 26. FastAPI and PostgreSQL remain a future service boundary (superseded)

The optional FastAPI app mirrors analysis, demo login, queue, and decision contracts. Docker Compose also creates PostgreSQL. The current Next.js UI does not use that service for its active workflow, and PostgreSQL is not used for case persistence.

This boundary was retained to communicate a production direction without risking the browser demo. It should either be integrated and expanded or removed from production deployment to avoid architectural ambiguity.

Status: superseded by ADR-031 through ADR-034. FastAPI/PostgreSQL are now active.

### 27. Controlled benchmarks are regression checks, not accuracy claims

The deterministic engine is tested against ten controlled benchmark scenarios plus merge/fallback/video behaviours. The replacement backend has five integration tests covering persistence and channel workflows.

A 10/10 benchmark result means the known fixtures produced expected categories, priorities, entities, and concerns. It is not a real-world accuracy percentage. Production evaluation needs a labelled, representative dataset and metrics for precision, recall, calibration, missed urgent cases, false escalations, extraction errors, and performance across languages/media quality.

Status: accepted.

### 28. Deployment uses Next.js standalone on ECS Express Mode

The production runtime uses:

- Next.js standalone output
- Node 22 Alpine multi-stage image
- dependency and build stages on the native build platform
- a lightweight `linux/amd64` runtime image for ECS
- non-root `node` user
- port 3000
- `/api/health` container/load-balancer checks
- immutable Git-derived ECR tags
- ECR scan-on-push and AES-256 repository encryption
- ECS Express Mode HTTPS, load balancing, CloudWatch logging, and CPU-based scaling from one to three tasks

Native build stages were chosen after a full emulated Apple-Silicon-to-amd64 Next.js build crashed under QEMU.

Status: accepted and deployed.

### 29. Deployment is repeatable and noninteractive

`scripts/deploy-ecs-express.sh` creates missing IAM roles and the ECR repository, builds and pushes the image, then creates or updates the same ECS Express service. `--monitor-mode TEXT-ONLY` was added in the second Git commit so monitoring works noninteractively.

The script does not currently attach the Gemini secret. Production connected analysis requires a secret managed outside the image, such as AWS Secrets Manager, and explicit attachment to the service.

Status: accepted; secret injection remains operational work.

### 30. The custom domain uses Porkbun DNS and an AWS certificate

The chosen public hostname is `niriksh.scopophobic.xyz`.

The setup uses:

- ACM certificate in `us-east-1`
- a permanent ACM validation CNAME in Porkbun
- an additional host-header value on the Niriksh ALB listener rule
- the custom certificate attached to the HTTPS listener
- a Porkbun `niriksh` CNAME pointing to the ECS Express load balancer

During setup, an incorrect AAAA record was replaced with the required CNAME. Public resolvers eventually returned the correct AWS addresses and all load-balancer addresses returned HTTPS 200 with valid TLS.

Operational lesson: the local ISP resolver retained a negative/stale answer after public DNS had propagated. `dig` against public resolvers succeeded while normal applications initially failed. Troubleshooting should compare the authoritative resolver, `1.1.1.1`, `8.8.8.8`, the operating-system resolver, and direct TLS requests.

Current limitation: HTTPS works, but port 80 is not configured to serve or redirect. Public links must use `https://` until an HTTP-to-HTTPS redirect is added.

Status: accepted and operational, with HTTP redirect still open.

### 31. FastAPI is now the real backend, not a contract placeholder

The user chose to implement the backend before revisiting deployment. The small service under `apps/api` was therefore replaced with a top-level `backend/` modular monolith. The new service owns durable complaints, users, evidence records, analysis runs, reports, routing decisions, audit events, messaging contacts/sessions/messages, and webhook jobs.

The old service was removed so there is only one Python backend to maintain.

Status: accepted and implemented.

### 32. Use a modular monolith before microservices

The domain needs clear boundaries but does not yet need independently deployed services. Authentication, complaints, evidence, analysis, reports, routing, audit, and WhatsApp are separate modules in one FastAPI codebase. The API and worker share those modules and one database.

This keeps transactions, local development, debugging, and deployment understandable while leaving extraction seams if scale or ownership later requires separate services.

Status: accepted.

### 33. PostgreSQL is canonical; SQLite is a development fallback

Docker Compose now connects SQLAlchemy to PostgreSQL and Alembic owns the schema baseline. SQLite remains available for zero-setup development and isolated tests. Browser storage is retained only as a presentation/offline cache, not as the intended authoritative store.

Status: accepted and implemented; UI sync status/retry remains future work.

### 34. The browser reaches FastAPI through a Next.js BFF

The browser calls same-origin `/api/cases` routes. Those server routes attach the internal backend credential. This avoids exposing `INTERNAL_API_KEY` in a `NEXT_PUBLIC_` variable or browser bundle and leaves a natural place for future cookie/session handling.

Status: accepted and implemented.

### 35. Persist evidence metadata now and isolate storage behind an adapter

The backend accepts authenticated streaming uploads, enforces a size cap, sanitizes storage names, computes SHA-256 during ingestion, and stores content outside the public web tree. The local filesystem implementation is deliberately replaceable; production should use private object storage, quarantine/scanning, encryption, derivatives, retention, and access logs.

Status: local and S3-compatible adapters implemented; private Supabase bucket provisioning remains.

### 36. Repurpose Bhumika as a channel adapter, not a separate product database

The existing Bhumika/Umang implementation proved useful patterns: normalize Meta webhooks, keep the route thin, model add-details/submit states, wrap the Cloud API, and provide fixture mode. Niriksh reuses those ideas but makes WhatsApp create and update the same canonical complaint records used by web intake.

Webhook message IDs are idempotency keys. Raw events are persisted before acknowledgement processing, and a separate worker can claim/retry them. Contacts, sessions, and messages are retained for traceability.

Status: superseded by decision 46 before live Meta cutover. The code remains inactive reference/rollback material.

### 37. Human decisions and automated analysis are independently versioned

Each analysis run records the complaint input version and immutable result. Reports store versioned snapshots. Routing decisions have their own records, and overrides require reasons. Cross-module actions append audit events. This prevents a current complaint view from erasing what an earlier model or reviewer saw.

Status: accepted and implemented.

### 38. Reuse Bhumika's live Meta assets instead of recreating WhatsApp

The WhatsApp cutover reuses Bhumika's existing Meta Business account, developer application, WhatsApp Business Account, registered phone number, access token, verify token, app secret, webhook subscription, and approved templates. Niriksh accepts Bhumika's current environment-variable names as aliases.

Only the callback URL changes during deployment. Bhumika's Supabase data model, civic scoring, dashboard, and portal logic are not imported. The former callback remains the rollback target.

Status: superseded by decision 46. Bhumika retains these assets and Niriksh no longer consumes them.

### 39. Use Supabase PostgreSQL as the shared database

The deployed FastAPI service will use the new Niriksh Supabase PostgreSQL database. ECS is a persistent container workload, so the IPv4-compatible session pooler on port `5432` is the practical connection path. The SQLAlchemy URI must use one scheme only, the `postgresql+psycopg://` driver, a URL-encoded password, and `sslmode=require`. Alembic—not the Supabase dashboard—is the owner of the application schema.

The repository's root `.env.local` currently points to Docker host `db`; that is only correct inside Compose and does not prove Supabase connectivity. Production receives `DATABASE_URL` from AWS Secrets Manager.

Status: accepted and deployed. The migration and live connection smoke test pass.

### 40. Use a private Supabase Storage bucket for the mentor demo

Supabase Storage is selected for the immediate MVP because it sits beside the database, supports S3-compatible clients and presigned downloads, and requires no public browser access. Niriksh stores only storage keys, MIME/size metadata, provenance, analysis output, and SHA-256 digests in PostgreSQL; binary evidence remains in a private bucket. The backend is the only holder of the S3 access key.

This is not yet the final forensic-evidence design. Supabase Storage does not support S3 object versioning, and deleted objects cannot be restored. The application therefore must not claim legal hold, immutability, authenticity, or evidentiary admissibility. A production evidence tier should evaluate AWS S3 with Object Lock, KMS, retention/legal-hold policy, malware quarantine, access logging, and tested recovery.

Current Niriksh ingestion is intentionally capped at 10 MB per item even though the storage provider supports larger objects. This bounds WhatsApp download memory and inline analysis latency for the demo.

Status: accepted and deployed for the demo. Private bucket write/hash/delete smoke testing passes.

### 41. Move WhatsApp multimodal understanding into the backend

The canonical backend now calls Gemini with the accumulated complaint, structured fields, and current message attachments. Audio/voice notes are transcribed inside the structured multimodal result; images/documents receive source-labelled observations. Extracted fields and transcripts are persisted with the complaint/evidence, and every connected run records provider, model, input version, output, and status.

Connected analysis is advisory. The deterministic policy engine always runs and remains the fallback if the provider times out or fails. Prompt instructions treat evidence as untrusted, prohibit guilt/authenticity conclusions, and preserve the human-review boundary.

Status: implemented and live provider schema smoke-tested.

### 42. Use inline webhook processing for the single-service demo, then restore a worker

The durable webhook inbox remains the system boundary. For tomorrow's one-service ECS deployment, `PROCESS_WEBHOOKS_INLINE=true` schedules processing after the `202` response in the API container. This avoids deploying a second non-HTTP service for the mentor demo.

This is a temporary reliability compromise: a container termination after acknowledgement can strand work until a replay mechanism runs. The next production step is `PROCESS_WEBHOOKS_INLINE=false` with the existing worker deployed as a separately supervised service, plus an outbound-message outbox and dead-letter/replay operations.

Status: superseded by decision 46; Niriksh no longer processes channel webhooks.

### 43. A Niriksh reference is a tracking number, not an FIR number

Submitting from WhatsApp closes intake, creates an immutable report snapshot, moves the complaint to `Awaiting review`, and replies with the `CYB-YYYY-NNNNNN` reference. Language says “submitted for Niriksh review”; it does not imply submission to police, the national cybercrime portal, or generation of an FIR.

Status: implemented.

### 44. Deploy web and API as separate ECS Express services

The Next.js service remains `niriksh`; FastAPI is deployed as `niriksh-api`. The web service and Bhumika call separate protected API surfaces on that service. Database, Gemini, integration, and storage credentials are injected from AWS Secrets Manager and never baked into either image. Meta remains entirely inside Bhumika.

Status: accepted and deployed. The existing web service was updated in place and the new API service is active.

### 45. Redirect plain HTTP to the canonical HTTPS domain

The custom domain originally had only a port 443 listener, so the exact `http://niriksh.scopophobic.xyz/` link failed before TLS negotiation. The existing load balancer now has a port 80 listener that returns a permanent `301` redirect to HTTPS; the application and session cookie remain HTTPS-only.

Status: accepted, deployed, and verified.

### 46. Keep Meta/WhatsApp in Bhumika and integrate at the curated-form boundary

The direct Meta-to-Niriksh plan was replaced before live Meta cutover. Bhumika continues to own its existing Meta webhook, WhatsApp session, multilingual questions, media retrieval, and outbound victim communication. Niriksh no longer needs Meta credentials and does not expose the direct WhatsApp webhook.

Bhumika now acts as an upstream intake application. It sends a versioned, curated form to a dedicated Niriksh server endpoint, optionally transfers original media bytes, and finalizes the submission. Niriksh owns canonical persistence, evidence hashing/private storage, deterministic and connected analysis, report versioning, officer review, audit, and the `CYB-YYYY-NNNNNN` tracking number returned to Bhumika.

The integration uses a credential separate from both officer JWTs and the web BFF key. A database uniqueness constraint makes `submission_id` idempotent; external evidence IDs make uploads idempotent; status lookup supports timeout recovery; finalize creates at most one report for that submission.

Reasons:

- no risky Meta callback cutover before the mentor demo
- Bhumika keeps the working conversation experience and credentials
- Niriksh stays focused on case/evidence intelligence rather than channel operations
- a stable JSON/file contract allows future channels to reuse the same pattern
- failures and retries cannot silently duplicate cases

Status: accepted, deployed, and live-smoke-tested on the Niriksh side. Adding the URL/key and schema mapping to Bhumika is the remaining cross-service step.

### 47. Inline ordinary media for low-latency web analysis

The original web adapter uploaded every image/audio/video file to the provider file service, waited for processing, and only then requested analysis. During provider demand spikes this consumed too much of the ECS load-balancer request window before model failover could complete.

Web attachments up to 8 MB are now base64-encoded into the provider request, matching the backend path that successfully analysed Bhumika evidence. Larger attachments retain the provider file-service path. The primary attempt receives 25 seconds and the two capacity-pool fallbacks receive 18 and 10 seconds, keeping the whole sequence bounded. The deterministic local result remains available if every provider pool is unavailable.

Status: accepted, deployed, and verified against the public domain with a fictional screenshot; source-specific findings and a timeline returned with HTTP 200.

### 48. Use signed tracking links, a pull update feed, and idempotent supplements

A raw `CYB-...` number is short and potentially guessable, so it is not sufficient authorization for a public case lookup. Niriksh returns a time-limited JWT bearer link with a tracking-specific issuer, audience, and token type. Its public projection is allow-listed: status, dates, category, assigned review unit, report readiness, requested questions, generic guidance, and safe audit labels. It excludes narratives, evidence, identities, internal IDs, report bodies, and provider internals.

Bhumika remains the communication owner. It receives a victim-ready acknowledgement, stores the tracking link, and reads a protected `updates` feed using an optional timestamp cursor. A pull feed was chosen for this stage because it needs no public Bhumika callback, signing protocol, delivery outbox, or new production secret. Bhumika can poll open cases and respond immediately to a victim's “status” message; update IDs allow outbound deduplication.

Later victim information is represented by an idempotent supplement attached to the original integration submission. Text can finalize in one request. Media uses create/upload/finalize. Completion reruns analysis and creates the next immutable report version while retaining the original complaint and tracking number.

Limitations: a bearer link must be treated as private, currently expires after the configured number of days, and has no individual revocation record. High-scale production should add citizen identity/grants, token rotation/revocation, and—if instant delivery is required—a signed webhook backed by a durable outbox.

Status: accepted and implemented.

### 49. Organise the product around Report → Understand → Connect

The current competition release has one coherent transformation:

```text
raw complaint + evidence
  → source-backed case reconstruction
  → explicit normalized indicators
  → potential related incidents
```

Report remains the existing intake, Understand is the hero officer experience, and Connect adds exact cross-case context. Case status and routing remain useful downstream workflows rather than the product headline.

This supersedes earlier positioning around priority-first triage, generated-content detection, a broad prevention network, and Bhumika-led demo storytelling.

Status: accepted and implemented.

### 50. Remove automated priority and expose factual active signals

Neither AI nor deterministic scoring decides which victim deserves attention. The UI shows cases in received order and keeps legacy severity/confidence fields neutralized for compatibility. Analysis may surface statements such as ongoing access, continuing threats, recent financial activity, or continuing impersonation only when supported by submitted material. A person interprets those facts under policy.

Status: accepted and implemented. This supersedes ADR-005, ADR-006, and ADR-022 where they describe scoring or priority.

### 51. Make case reconstruction and provenance the officer hero

The case experience leads with what happened, chronology, source trace, explicit indicators, uncertainty, original evidence, active signals, missing information, and compact status. Original evidence, extracted facts, and analysis-assisted observations are distinct layers. Exact times and evidence IDs are never invented.

Status: accepted and implemented.

### 52. Correlate complaints only through deterministic exact indicators

Models may extract candidate identifiers but cannot decide that cases are related. Connect only compares equal `indicator_type + normalized_value` pairs. Same category, similar narrative, nearby time/location, embeddings, images, and fuzzy matches are excluded.

The result exposes the exact value and source provenance and uses non-attribution language. Shared identifiers can be recycled, shared, spoofed, or mistyped; a match is supporting information only.

Status: accepted and implemented.

### 53. Use PostgreSQL and a normalized indicator table for Connect

`case_indicators` preserves raw/display values, normalized values, types, complaint ownership, extraction source, and optional evidence provenance. A composite B-tree index supports equality lookups. PostgreSQL already owns canonical complaint data and is sufficient for the current query and competition scale.

Neo4j, Elasticsearch, vector storage, and a separate correlation service add operational and consistency cost without improving the exact-match requirement.

Status: accepted and implemented in migration `20260906_0005`.

### 54. Exclude Bhumika/WhatsApp from the current release

Bhumika is not part of the current repository implementation request, demo path, landing story, or runtime requirement. Historical modules and ADRs remain for traceability but are not extended. A future adapter may use the canonical complaint boundary after separate design and security review.

This avoids advertising an integration that is not part of the current deliverable and keeps Niriksh independently usable.

Status: accepted for the current release. ADR-041, ADR-046, and the Bhumika-specific part of ADR-048 are deferred.

### 55. Postpone prevention/intelligence-loop expansion

Public awareness generation, automated blocking, crawler-driven intelligence, graph visualizations, semantic cross-case matching, and automated enforcement are not needed to prove the central workflow. Development effort remains on trustworthy reporting, source-backed understanding, and explicit connections.

Status: accepted.

### 56. Keep demo correlation isolated and fictional

Four fixed demo complaint IDs and reserved/example identifiers provide a repeatable two-minute story. Seed/reset operates only on those IDs, runs through the production synchronization service, and the application never depends on the fixtures.

Status: accepted and implemented.

## Decision index

| ID | Decision | Status |
|---|---|---|
| ADR-001 | Brand the product Niriksh and position it as evidence intelligence | Accepted |
| ADR-002 | Optimise the MVP for a complete demo before enterprise completeness | Accepted |
| ADR-003 | Make citizen complaint-to-report flow the primary product journey | Accepted |
| ADR-004 | Keep source attribution throughout analysis | Accepted |
| ADR-005 | Keep deterministic safety, scoring, and routing policy outside the model | Superseded in part by ADR-050 |
| ADR-006 | Treat urgency, completeness, and verification readiness separately | Superseded in part by ADR-050 |
| ADR-007 | Allow `Unclear / needs review` instead of forced classification | Accepted |
| ADR-008 | Use adaptive, conditional intake instead of one large form | Accepted |
| ADR-009 | Do not collect national ID in the unauthenticated prototype | Accepted |
| ADR-010 | Use truth declaration and provenance controls for accountability | Accepted |
| ADR-011 | Add AI-generated harmful-content and child-safety context | Accepted |
| ADR-012 | Generate browser SHA-256 fingerprints without claiming authenticity | Accepted |
| ADR-013 | Move the public Analysis Lab into automated tests | Superseded |
| ADR-014 | Use fictional, clearly labelled demo evidence | Accepted |
| ADR-015 | Use Gemini for connected multimodal analysis | Accepted |
| ADR-016 | Keep provider credentials server-side | Accepted |
| ADR-017 | Require structured JSON-schema model output | Accepted |
| ADR-018 | Attempt connected analysis by default when configured | Accepted |
| ADR-019 | Use bounded provider retry, model failover, then local fallback | Accepted |
| ADR-020 | Treat video as a first-class source with per-file failure reporting | Accepted |
| ADR-021 | Separate voice description from uploaded audio evidence | Accepted |
| ADR-022 | Make the report priority-first and explicitly “not submitted” | Superseded by ADR-049/050 |
| ADR-023 | Keep routing human-confirmed | Accepted |
| ADR-024 | Separate citizen, officer, and administrator experiences | Accepted |
| ADR-025 | Use browser-local storage for demo reliability only | Accepted for prototype |
| ADR-026 | Retain FastAPI/PostgreSQL as an inactive production-direction boundary | Superseded by ADR-031/033 |
| ADR-027 | Treat controlled benchmarks as regression tests, not accuracy | Accepted |
| ADR-028 | Deploy a hardened standalone container to ECS Express Mode | Accepted |
| ADR-029 | Use immutable ECR tags and repeatable create/update automation | Accepted |
| ADR-030 | Use ACM + Porkbun CNAME for the custom HTTPS domain | Accepted |
| ADR-031 | Make the top-level FastAPI service the canonical backend | Accepted |
| ADR-032 | Use a modular monolith with separate API and worker processes | Accepted |
| ADR-033 | Make PostgreSQL canonical and SQLite a local/test fallback | Accepted |
| ADR-034 | Use a Next.js BFF so internal credentials stay server-side | Accepted |
| ADR-035 | Put evidence behind a replaceable private storage adapter | Accepted |
| ADR-036 | Repurpose Bhumika as the WhatsApp channel adapter | Superseded by ADR-046 |
| ADR-037 | Version analysis, reports, and human routing decisions separately | Accepted |
| ADR-038 | Reuse Bhumika's existing Meta assets inside Niriksh | Superseded by ADR-046 |
| ADR-039 | Use Supabase PostgreSQL through the session pooler | Deployed |
| ADR-040 | Use private Supabase Storage for the demo; stronger immutable storage later | Deployed for demo |
| ADR-041 | Run WhatsApp multimodal extraction/transcription in FastAPI | Deferred by ADR-054 |
| ADR-042 | Process webhook jobs inline for the one-service demo only | Superseded by ADR-046 |
| ADR-043 | Treat the Niriksh reference as tracking, not an FIR | Accepted |
| ADR-044 | Deploy separate web and API ECS Express services | Deployed |
| ADR-045 | Redirect HTTP to the canonical HTTPS domain | Deployed |
| ADR-046 | Keep Meta in Bhumika; send Niriksh a curated, idempotent form/media submission | Deferred by ADR-054 |
| ADR-047 | Inline ordinary web media to keep connected analysis inside the request window | Accepted |
| ADR-048 | Use signed tracking links, a pull update feed, and idempotent supplements | Tracking retained; Bhumika feed deferred |
| ADR-049 | Organise the product around Report → Understand → Connect | Accepted |
| ADR-050 | Remove automated priority and expose factual active signals | Accepted |
| ADR-051 | Make case reconstruction and provenance the officer hero | Accepted |
| ADR-052 | Correlate complaints only through deterministic exact indicators | Accepted |
| ADR-053 | Use PostgreSQL and a normalized indicator table for Connect | Accepted |
| ADR-054 | Exclude Bhumika/WhatsApp from the current release | Accepted |
| ADR-055 | Postpone prevention/intelligence-loop expansion | Accepted |
| ADR-056 | Keep demo correlation isolated and fictional | Accepted |

## Explicitly deferred or rejected scope

The following were intentionally excluded from the MVP:

- automatic police complaint or FIR creation
- automatic government-system integration
- guilt or legal conclusions
- suspect identification
- facial recognition
- definitive deepfake detection
- automatic bans, routing, enforcement, or takedowns
- large-scale web crawling or social monitoring
- cross-case intelligence graphs
- citizen OTP/session authentication and per-complaint grants
- production identity-provider integration and administrator provisioning
- immutable production evidence storage
- malware scanning and forensic metadata validation
- production notification templates and delivery monitoring
- real team capacity and operational analytics
- legally validated electronic-evidence certification

## Known inconsistencies and follow-up decisions

1. **Analysis duplication:** the frontend TypeScript organiser is richer than the Python baseline; these should converge behind a versioned backend contract.
2. **Model defaults:** the web and API connected-analysis adapters still use separate model configuration paths.
3. **Admin realism:** staffing, service state, and configuration controls are illustrative UI data rather than live operational telemetry.
4. **Citizen authorization:** public intake does not yet issue a citizen session or per-complaint access grant.
5. **Browser sync:** the offline case cache does not yet show a sufficiently strong canonical-sync/outbox state.
6. **Media latency:** long connected media analysis remains synchronous and needs a durable job model.
7. **Indicator governance:** exact matching is implemented, but retention, correction, access, dispute, and false-positive review policy still need formal ownership.
8. **Relational reconstruction:** chronology/facts still live primarily in the compatibility JSON payload rather than first-class relational tables.
9. **Provider disclosure:** public UI hides vendor/model details while operational/audit views may need them for accountability.
10. **Evaluation:** controlled fixtures are regression tests, not evidence of real-world accuracy, fairness, or government readiness.

## Recommended next decision sequence

1. Add visible frontend sync states and retry failed complaint writes.
2. Add citizen identity/session support and per-complaint access grants.
3. Define jurisdiction/unit-scoped RBAC and indicator access policy.
4. Consolidate TypeScript and Python analysis behind one versioned contract.
5. Add immutable encrypted evidence retention, derivative tracking, malware quarantine, and safe rendering.
6. Move long media analysis to a durable job/outbox worker.
7. Build a representative labelled evaluation corpus for extraction and provenance quality.
8. Add observability, audit alerts, backup/restore tests, retention controls, and infrastructure as code.
9. Run privacy impact, threat-model, legal, accessibility, and receiving-agency SOP reviews.
10. Design any future intake adapter—including Bhumika—separately after the canonical web workflow is stable.
