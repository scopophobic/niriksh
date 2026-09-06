# Niriksh 80-second technical demo

This recording uses fictional demo data only. It shows assisted case preparation and prevention intelligence; it never claims that Niriksh decides guilt, authenticity, urgency, legal action, or an FIR.

The requested duration mentions both one minute and one minute twenty seconds. This version follows the explicit **1:20** request. For a strict 60-second cut, use the sections marked **core** and omit the optional feature sweep.

## Presenter checklist: feature pointers

Use this as a click-path and a compact inventory of the product.

| Feature | Show / say | Technical detail worth naming |
|---|---|---|
| Prevention-first landing | `/` | Explains the Report → Understand → Learn → Prevent loop and the human-review boundary. |
| WhatsApp-style intake | `/whatsapp` | Bhumika-derived browser demo guides narrative intake, clarification, and confirmation before filing. Live Meta transport is separate. |
| Guided report | `/report` | Adaptive fields capture incident, jurisdiction, financial, identity-misuse, and optional suspect details without one static, overwhelming form. |
| Multimodal evidence | `/report` or `/safety` | Text, screenshots/images, PDFs, audio/voice notes, and short video can be attached. Browser hashing and private evidence storage preserve provenance. |
| Speech support | `/report` | Browser speech recognition can help capture a narrative while retaining the original recording where provided. |
| Deterministic organiser | After **Organise complaint** | Produces a source-labelled structured result locally; it remains available when optional connected analysis is unavailable. |
| Optional media analysis | Evidence review | Server-side Gemini structured analysis can add document/image understanding, transcription, and media observations; its limitations remain visible. |
| Reporter review | `/report` review step | The person can correct the generated structure before creating the report. |
| Case reconstruction | `/cases/demo-connect-a` | Separates original evidence, extracted facts, and analysis-assisted observations; shows timeline precision, indicators, active signals, missing questions, and audit/status. |
| Evidence integrity | Case evidence area | SHA-256 digests and source links make it possible to trace a finding back to submitted material. |
| Exact connection | **Related incidents** | PostgreSQL normalizes explicit identifiers and matches exact type/value pairs only: phone, email, UPI, domain, URL, social handle, transaction, or account identifier. |
| Explainable prevention patterns | `/prevention` | Repeated exact indicators become reviewable candidates with linked evidence, never automated offender attribution. |
| Human review lifecycle | Pattern detail | People verify, dismiss, or request more evidence; only verified patterns can inform warnings or awareness drafts. |
| Awareness studio | `/awareness` | Drafts clear prevention material from verified patterns; publishing still needs human approval. |
| Safety Check | `/safety` | Rule-based suspicious-text guidance, optional uploaded-content review, and privacy-protected identifier lookup. A directory match is a lead, not proof. |
| Citizen tracking | `/track?token=...` | Signed, allow-listed tracking link exposes only safe status information. |
| Officer workflow | `/dashboard`, `/routing`, `/admin` | Cases remain in received order; humans confirm subject folder and destination. Authentication, role checks, audit history, and governance views support accountable operation. |
| Reliability and privacy | Mention throughout | Next.js/React frontend, FastAPI backend, PostgreSQL canonical store, private local/S3-compatible evidence storage, and disclosed browser fallback. |

## 1:20 presenter script

### 0:00–0:08 — Core

Show `/`.

> “Niriksh turns cybercrime reports into source-backed intelligence that can help prevent repeat harm. It assists people; it never decides guilt, urgency, an FIR, or enforcement action.”

### 0:08–0:21 — Core

Open `/report` and briefly show the evidence controls.

> “Reporting is guided and adaptive. A person can describe what happened and safely add text, screenshots, PDFs, audio, video, transaction details, and structured context. They review the result before a report is created.”

### 0:21–0:35 — Core

Show **Organise complaint**, then `/cases/demo-connect-a`.

> “The organiser builds a readable case: a timeline with source labels, extracted indicators, original evidence, uncertainty, and the information still missing. Optional connected analysis can help with supported media, while the disclosed deterministic fallback is always available.”

### 0:35–0:50 — Core

Open **Related incidents** on the seeded case.

> “Connect is deliberately conservative. PostgreSQL normalizes and exactly matches explicit identifiers—such as a UPI ID or domain. It does not use narrative similarity, embeddings, or automated claims about a common offender.”

### 0:50–1:03 — Core

Open `/prevention` and a pattern detail.

> “Those exact, source-backed matches form prevention candidates. A human reviewer can verify, dismiss, or request more evidence. Only verified patterns can support a future warning or an awareness draft.”

### 1:03–1:14 — Optional feature sweep

Open `/safety`.

> “For citizens, Safety Check handles suspicious text and supported uploaded content, then offers a privacy-protected identifier lookup. A match is a lead, never proof.”

### 1:14–1:20 — Optional feature sweep

Show the header links or switch view.

> “WhatsApp-style guided intake, signed status tracking, officer routing, audit history, and human controls complete the workflow: understand, learn, and prevent—without automated judgement.”

## Recording safeguards

- Seed only the fictional fixture with `./scripts/demo-data.sh seed`.
- Use the reserved `.example` domains and demo identifiers; do not open or contact them.
- If connected analysis is not configured, say “deterministic fallback” and do not imply media interpretation.
- Call a related case a “potential connection,” not the same criminal, network, or proof.
