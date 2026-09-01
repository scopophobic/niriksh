# Niriksh decision record

Last reconstructed: 29 August 2026

## Purpose of this document

This document records how Niriksh evolved, why the major product and technical choices were made, which ideas were superseded, and which boundaries remain intentional. It is an architectural decision record and project history, not a claim that every discussed capability is production-ready.

The record was reconstructed from:

- `plan.md`
- the current repository and implementation
- Git commits `b9d67a7` and `4ba67ca`
- five project-specific Codex sessions from 26–28 August 2026
- the deployment and custom-domain troubleshooting session

Sensitive values such as API keys, certificate validation tokens, and AWS account identifiers are deliberately omitted.

## Current product statement

> Niriksh is an evidence intelligence platform for cybercrime complaints. It connects a reporter's description, structured incident details, and supporting evidence into a prioritised, source-labelled case for human review.

The product is intended to help with the first-mile triage problem: complaints arrive as incomplete narratives plus screenshots, messages, receipts, audio, video, and links; a reviewer must understand the context, identify urgency, find useful identifiers, ask for missing information, and decide where the case may need review.

Niriksh is not an autonomous investigator, deepfake detector, guilt engine, legal decision-maker, police-report filing service, or forensic authenticity tool.

## Non-negotiable product principles

1. Evidence context is the core feature; routing and dashboards are downstream views.
2. Reporter claims, evidence observations, system inferences, and human decisions must remain distinguishable.
3. Every important finding should retain a source.
4. Urgency and evidence completeness are separate concepts.
5. Child-safety and other critical safety rules remain deterministic and inspectable.
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

Status: accepted and implemented.

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
2. retry the primary, 15-second request
3. configured fallback, 30-second request
4. configured reserve, 30-second request
5. deterministic local fallback in the client

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

Status: accepted for the prototype only.

### 26. FastAPI and PostgreSQL remain a future service boundary

The optional FastAPI app mirrors analysis, demo login, queue, and decision contracts. Docker Compose also creates PostgreSQL. The current Next.js UI does not use that service for its active workflow, and PostgreSQL is not used for case persistence.

This boundary was retained to communicate a production direction without risking the browser demo. It should either be integrated and expanded or removed from production deployment to avoid architectural ambiguity.

Status: retained but inactive.

### 27. Controlled benchmarks are regression checks, not accuracy claims

The deterministic engine is tested against ten controlled benchmark scenarios plus merge/fallback/video behaviours. The Python contract service has three tests.

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

## Decision index

| ID | Decision | Status |
|---|---|---|
| ADR-001 | Brand the product Niriksh and position it as evidence intelligence | Accepted |
| ADR-002 | Optimise the MVP for a complete demo before enterprise completeness | Accepted |
| ADR-003 | Make citizen complaint-to-report flow the primary product journey | Accepted |
| ADR-004 | Keep source attribution throughout analysis | Accepted |
| ADR-005 | Keep deterministic safety, scoring, and routing policy outside the model | Accepted |
| ADR-006 | Treat urgency, completeness, and verification readiness separately | Accepted |
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
| ADR-022 | Make the report priority-first and explicitly “not submitted” | Accepted |
| ADR-023 | Keep routing human-confirmed | Accepted |
| ADR-024 | Separate citizen, officer, and administrator experiences | Accepted |
| ADR-025 | Use browser-local storage for demo reliability only | Accepted for prototype |
| ADR-026 | Retain FastAPI/PostgreSQL as an inactive production-direction boundary | Provisional |
| ADR-027 | Treat controlled benchmarks as regression tests, not accuracy | Accepted |
| ADR-028 | Deploy a hardened standalone container to ECS Express Mode | Accepted |
| ADR-029 | Use immutable ECR tags and repeatable create/update automation | Accepted |
| ADR-030 | Use ACM + Porkbun CNAME for the custom HTTPS domain | Accepted |

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
- production authentication and role enforcement
- durable database-backed case storage
- immutable production evidence storage
- malware scanning and forensic metadata validation
- notification delivery
- real team capacity and operational analytics
- legally validated electronic-evidence certification

## Known inconsistencies and follow-up decisions

1. **README versus current AI behaviour:** README says a reporter can disable connected analysis; the current UI automatically uses it whenever configured.
2. **Model defaults:** `app/api/analyze/route.ts` defaults to one primary model while `.env.example` overrides it with another. Deployment behaviour depends on environment configuration and should be standardised.
3. **Production Gemini:** the initial AWS deployment did not include `GEMINI_API_KEY`, so the deployed service used local analysis unless the secret was added later.
4. **FastAPI ambiguity:** Docker Compose makes the web service depend on FastAPI/PostgreSQL even though the primary browser workflow does not call them.
5. **Admin realism:** several admin capacity, health, identity, and success-rate values are illustrative UI data, not live operational telemetry.
6. **Citizen privacy language:** the UI says only authorised reviewers can access case material, but the prototype has no real authentication or server access control.
7. **Evidence durability:** binary `blob:` previews and in-memory `File` objects are not durable across reloads.
8. **HTTP redirect:** only HTTPS is currently verified; `http://niriksh.scopophobic.xyz` does not redirect.
9. **Provider disclosure:** public UI intentionally hides vendor/model names, while operational/audit views may still need them for accountability.
10. **Evaluation:** controlled fixtures are too small for accuracy or fairness claims.

## Recommended next decision sequence

1. Reconcile README, UI consent, and connected-analysis policy.
2. Decide whether the FastAPI service becomes the real backend or is removed.
3. Introduce authentication and separate citizen/officer/admin authorisation.
4. Move cases and audit events from `localStorage` to a database.
5. Store original evidence in immutable encrypted object storage with derivative tracking.
6. Add asynchronous media jobs, progress, retries, and larger evidence limits.
7. Add explicit provider/model/audit metadata visible to authorised reviewers.
8. Build a labelled evaluation corpus and measure extraction, urgency, and routing performance.
9. Add HTTP-to-HTTPS redirection and codify custom-domain infrastructure.
10. Obtain legal, privacy, security, and evidence-handling review before real complaints are accepted.

