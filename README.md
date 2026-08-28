# Niriksh — evidence context analysis for cybercrime complaints

Niriksh is a working browser prototype for turning an unstructured complaint and its evidence into a source-labelled case summary for human review. It focuses on understanding context before any routing, enforcement, or legal decision.

It does **not** determine guilt, file a police report, verify an online account, or claim forensic authenticity.

## Run the product

Node.js 22+ is recommended:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The local text analyser works without an account, API key or database.

To enable the multimodal pipeline, copy `.env.example` to `.env.local`, add a server-side `GEMINI_API_KEY`, choose `GEMINI_MODEL`, and restart the development server. Gemini analysis is then enabled by default in the complaint flow; the reporter can turn it off before analysis, and the deterministic local engine remains the automatic fallback. `GEMINI_FALLBACK_MODEL` is used only for temporary overloads or timeouts. Never expose the key through a `NEXT_PUBLIC_` variable.

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
- Browser-local case storage, source-focused case review, and report download
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
- Browser storage for the prototype case workspace
- An optional server-only Google Gemini `generateContent` route using the official `@google/genai` SDK and structured JSON output
- Automatic, disclosed Flash-model failover for temporary provider overloads and timeouts
- Gemini Files API inputs for image, document, audio and native video analysis, with best-effort deletion after every request
- Node's test runner through `tsx` for analyser regression tests

The deterministic pipeline always remains available as a repeatable fallback. When the multimodal route is configured, the result screen names the mode and model and shows how many evidence items received AI review.

## Verify

```bash
npm test
npm run lint
npm run build
```

## Deploy to Amazon ECS Express Mode

The production image uses Next.js standalone output, runs as the unprivileged `node` user, listens on port `3000`, and exposes `GET /api/health` for load-balancer and container health checks.

Prerequisites are Docker, AWS CLI v2, an authenticated AWS account, and a default VPC with public subnets. Deploy or update the service with:

```bash
AWS_REGION=us-east-1 ./scripts/deploy-ecs-express.sh
```

The script creates the `niriksh` ECR repository and the two AWS-managed IAM roles required by Express Mode when they do not exist. It builds an immutable `linux/amd64` image, pushes it to ECR, and creates or updates the `niriksh` Express service with HTTPS, CloudWatch logging, load balancing, health checks, and CPU-based scaling from one to three tasks.

The deterministic analysis remains available without external secrets. For multimodal analysis in production, store `GEMINI_API_KEY` in AWS Secrets Manager and attach it to the Express service as a container secret rather than committing it or passing it as plain text.

An optional FastAPI contract service remains under `apps/api`; it is not required by the current browser workflow. Authentication and production evidence storage are intentionally deferred until the analysis experience is validated.
