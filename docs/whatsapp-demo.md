# WhatsApp-style guided chat (`/whatsapp`)

## What this is, and what it isn't

`/whatsapp` is a **native, self-contained** chat demo built entirely inside niriksh. It looks
and behaves like a WhatsApp conversation (photo/voice/text bubbles, a checklist the bot fills
in as you talk), but it is a simulation running in the browser — there is no Meta integration,
no phone number, and no connection to WhatsApp's network. Every message goes to niriksh's own
API (`app/api/mock/whatsapp-chat`), not to any messaging platform.

This is **not** a reconnection to Bhumika's live Meta account. Per `docs/decisions.md` (ADR-046)
and `docs/whatsapp-cutover.md`, Bhumika owns the real Meta/WhatsApp webhook, conversation state,
and phone number, and forwards curated submissions to niriksh's protected `bhumika` integration
module (`backend/app/modules/bhumika/`). That path is untouched by this feature — nothing here
imports from it, calls it, or changes its behavior. This chat is a **second, independent front
door** into niriksh's own complaint pipeline, built because niriksh had no chat-style intake UI
of its own at all (confirmed during the port: no `/whatsapp` route or phone-mock UI existed
here before this).

A completed chat produces a **real complaint** in niriksh's own database (visible on
`/dashboard`, reviewable like any other case) — it is not a toy that discards its output.

Ported from Bhumika's `umang-reimagined` repo (`app/niriksh/`, `lib/niriksh.js`,
`lib/niriksh-map.js`, `app/api/mock/niriksh-chat/route.js`), which is a separate demo that
still runs standalone there and was left unchanged by this port.

## File map

| File | Purpose |
| --- | --- |
| `lib/whatsapp-classifier.ts` | The checklist engine: categories, required/optional fields, the two-tier Gemini analysis (`analyzeFull`/`analyzeSkim`), the monotonic merge (`mergeFields`/`mergeValues`), case-strength weighting, and the chat reply text (`nextReply`, `checklistView`). Ported from `lib/niriksh.js`. |
| `lib/whatsapp-mapping.ts` | Turns a finished checklist into niriksh's own `ComplaintDetails` shape (`checklistToComplaintDetails`) and a plain-text narrative (`buildNarrative`). Ported from `lib/niriksh-map.js`, but targets `ComplaintDetails` directly — there is no external contract to map to any more. |
| `lib/evidence.ts` | `classifyFile`/`fileSize`/`prepareFile` (extracted out of `ReportFlow.tsx`, which now imports from here too) plus `base64ToFile`, which reconstructs a real `File` from the base64 the chat accumulates turn-by-turn. |
| `app/api/mock/whatsapp-chat/route.ts` | The stateless chat API. Ported from `app/api/mock/niriksh-chat/route.js`, minus the Bhumika/niriksh HTTP handoff (there is none) — a finished, confirmed checklist gets a `readyToSubmit: true` signal instead, and the client does the actual filing. |
| `components/WhatsAppDemo.tsx` | The phone-mock chat UI, scenario starters, and the client-side submit step. Ported from `app/niriksh/NirikshLanding.js`'s chat portion, restyled with niriksh's own CSS-variable tokens (`--teal`/`--navy`/`--mint`, `app/globals.css`). |
| `app/whatsapp/page.tsx` | The page: on-page notices (see below) plus `<WhatsAppDemo/>`. niriksh's own landing page (`app/page.tsx`) is unchanged except for one new CTA link to this page. |
| `tests/whatsapp-classifier-strength.test.ts`, `tests/whatsapp-classifier-confirm.test.ts`, `tests/whatsapp-mapping.test.ts` | Ported from `tests/niriksh-strength.test.js`, `tests/niriksh-confirm.test.js`, `tests/niriksh-map.test.js`. |

## The checklist / case-strength rubric

Four categories (`lib/whatsapp-classifier.ts`'s `CATEGORY_DEFS`): `phishing_payment`,
`threatening_messages`, `investment_deepfake`, `child_safety`. Each has its own fields, plus
four fields every category shares (`channel`, `incident_status`, `state`, `district` —
`COMMON_FIELDS`). Every field is marked `required: true` or `required: false` (a nice-to-have).

**Adding a 5th category or a new field:** add an entry to `CATEGORY_DEFS` (or `COMMON_FIELDS`
for a cross-category field) with a `key`, a `label` (what the bot asks for, in plain English),
and `required`. Nothing else needs to change — `blankFields`, `checklistView`, the case-strength
weighting, and the Gemini prompt all derive from this table.

**Weighting:** every required field is worth 2 "units," every optional field 1 unit
(`fieldWeights`); a category's units are normalized so they sum to 100%. This guarantees, by
construction, that no optional field can ever outweigh a required one, and that the required
set alone can never be outweighed by the optional set — see the invariant tests in
`tests/whatsapp-classifier-strength.test.ts`. `caseStrength()` sums the weights of every *done*
field. A field only counts as "done" once it has an actual value (`isFieldDone`) — a bare tick
with nothing behind it doesn't count, except for the two evidence-only fields
(`chat_evidence`, `media_evidence`), where the attachment itself *is* the detail.

**How replies are driven:** `nextReply()` computes `missingFields()` (required vs. optional),
and if any required field is still missing, asks for the first one by name; once all required
fields are done, it invites the citizen to tap **Send now**. `sendButtons(ready)` disables that
button until `ready` is true — both client-side (a disabled `<button>`) and server-side (the
route re-checks `missingFields` before treating any `send_now` tap or typed "yes" as
consent to file, since a disabled attribute is not something a server can trust alone).

**The monotonic merge:** the server keeps no session — the client echoes back `category`,
`checklist`, and `values` on every request, and `mergeFields()` OR's this turn's fresh Gemini
read onto what's already ticked, so a field confirmed on turn 1 can never silently un-tick
itself if a later turn's re-read of the conversation misses it. `mergeValues()` is different: a
non-empty fresh read *replaces* the prior value (so a correction on turn 4 wins over turn 2's
reading), but a turn that reads nothing keeps the prior value rather than blanking it.

## Endpoint / data flow

```
Citizen types/speaks/photographs in the browser
        │
        ▼
POST /api/mock/whatsapp-chat  (mode: "skim" AND mode: "full", fired concurrently)
        │  skim: Flash-Lite, text-only, fields only — fast, best-effort, never files anything
        │  full: the real multimodal read — media, transcript, summary, values
        ▼
Client merges + renders the reply, checklist ticks, and Send now / Don't send buttons
        │
        ▼  (citizen taps Send now, or types "yes", once every required field is done)
route responds { readyToSubmit: true, category, checklist, values, summary }
        │
        ▼  (entirely client-side from here — components/WhatsAppDemo.tsx's submitCase())
buildNarrative() + checklistToComplaintDetails()   (lib/whatsapp-mapping.ts)
        │
        ▼
analyzeComplaint(narrative, evidenceItems, details)   (lib/analyzer.ts — same engine /report uses)
        │
        ▼
addLocalEngine(result, ...)   (lib/multimodal.ts — every AnalysisResult needs an `engine`)
        │
        ▼
useCaseStore().addCase(newCase, { persistOnly: true })
                              →  POST /api/cases  →  POST /api/v1/complaints/intake
        │                                                (backend, existing, unchanged)
        ▼
persisted case + `_uploadToken` (only present on real success — see the fake-reference guard below)
        │
        ▼
per-file POST /api/cases/{id}/evidence  (X-Complaint-Token header, one call per attachment)
```

There is no call to `lib/analyzer.ts`'s connected/multimodal Gemini endpoint
(`app/api/analyze`) at final submit — each turn's attachment was already read multimodally by
`analyzeFull()` during the conversation, so re-running the full evidence-analysis pass again at
submit would be redundant. `addLocalEngine` is required regardless, because a bare
`analyzeComplaint()` result has no `engine` field and the case-review UI reads it.

## Evidence & attachments

Two genuinely separate steps — a common way to get this wrong is doing only one of them:

1. **During the chat (base64, unchanged from the Bhumika original):** `pickPhoto()`/the mic
   handlers convert a selected photo or recorded voice note to a base64 string and push it onto
   an in-memory array (`evidenceRef` in `WhatsAppDemo.tsx`), capped at 6 items (niriksh's own
   existing cap — see `ReportFlow.tsx`'s dropzone, not Bhumika's 20). Each turn's newest
   attachment is *also* sent inline as `mediaBase64`/`mimeType` to
   `/api/mock/whatsapp-chat` so `analyzeFull()` can read it multimodally right away — that part
   needs no persistence, it just informs that turn's reply.
2. **At final submit (the one new piece of work this port adds):** `base64ToFile()`
   (`lib/evidence.ts`) reconstructs each accumulated item into a real `File`, then
   `prepareFile()` (also `lib/evidence.ts`, shared with `ReportFlow.tsx`) SHA-256-hashes and
   classifies it into a real `EvidenceItem` for `TriageCase.evidence`. The reconstructed `File`
   objects are kept in a `sourceFiles` map keyed by sha256. After `addCase()` returns a
   `_uploadToken`, each file in `sourceFiles` is POSTed individually as multipart form data to
   `/api/cases/{id}/evidence` with `X-Complaint-Token: <token>` — the backend matches each
   upload to its placeholder `EvidenceItem` by `expected_sha256`, which is exactly why the
   metadata (step 2's `EvidenceItem`, with that same sha256) must already be in
   `TriageCase.evidence` *before* `addCase` is called. The backend returns an already-stored
   item when the same complaint and SHA-256 are retried, so a lost response does not duplicate
   evidence.

## The fake-tracking-number guard

The chat calls `addCase()` with `persistOnly: true`, so a client-generated placeholder is never
shown in the local citizen portal. The only signal that a case was genuinely persisted is the
presence of `_uploadToken` on the response. `submitCase()` checks for it before showing a
reference. It also keeps one stable complaint ID and creation timestamp across retries, letting
the backend recover a submission if the first response was lost instead of creating a duplicate.
Evidence upload failures are reported separately: the citizen sees the real reference plus a
prompt to retry, and the SHA-256 idempotency guard makes that retry safe.

## Environment variables

Reuses niriksh's existing Gemini configuration — no separate model-chain naming was introduced:

- `GEMINI_API_KEY` — when unset, both `analyzeFull` and `analyzeSkim` fall back to
  `fixtureAnalyze()` (rough keyword matching), and the page shows a fixture-mode notice.
- `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `GEMINI_RESERVE_MODEL` — the full tier's model chain
  (same variables `app/api/analyze/route.ts` uses).
- `WHATSAPP_DEMO_SKIM_MODEL` (new; defaults to a Flash-Lite model) — the fast tier's model.

## Known, deliberate gap vs. the Bhumika original

The Bhumika version has a live-location picker (a Leaflet map pin + reverse geocoding backed by
a Supabase cache table) for filling in State/district in one tap. This port replaces it with a
plain **State dropdown + district text field** modal (the 📍 button in the chat) instead —
niriksh has no such map dependency or geocoding cache table today, and pulling one in for a demo
chat wasn't worth it. State/district can still be filled the normal way too, just by the citizen
typing where they are (the classifier already extracts it from text). Revisit this only if pin-
drop UX is specifically wanted later.

## Tracking behavior

The chat's final message links to `/track?ref=<reference>`, matching the reference-in-URL
pattern the Bhumika original used. `/track` reads that reference and selects the matching
persisted chat case from the browser's local case store. The link therefore works on the same
browser that filed the case, but is intentionally not a public reference-number lookup.

Cross-device tracking remains a citizen-auth/roadmap decision. A public
`GET /complaints/{reference}` would be wrong: references are only a ~900k-value space
(`secrets.randbelow(900_000) + 100_000`, `backend/app/modules/complaints/service.py`), not
enough entropy to stand alone as a public bearer credential, and the response would expose
officer-side case content. If this gets picked up:

1. **Capability-URL token (recommended first step):** mint a longer-lived `citizen_track`-scoped
   token at intake (the codebase already does this for evidence upload —
   `create_access_token(complaint.id, "citizen_upload", settings)`,
   `backend/app/modules/complaints/router.py`); make the link `/track?ref=<reference>&t=<token>`;
   add a `GET /complaints/track` that validates the token and returns a **citizen-safe
   projection** (status, summary, created date, assigned unit — never officer notes or routing
   internals). Tradeoff: whoever holds the link holds the access.
2. **Reference + second factor** (phone/email captured at intake) as an alternative if a
   losable link is unacceptable — more friction, requires contact details to be collected.
3. **Citizen OTP session + per-case authorization** — already on niriksh's own roadmap, and the
   only one of the three that's a real production answer; the other two are staging posts
   toward it.

The separate protected Bhumika intake already returns a signed `tracking_url` for real WhatsApp
conversations. The native browser demo uses its same-browser `?ref=` link because it enters
through the public guided-form compatibility endpoint rather than impersonating Bhumika.

## Running it locally

```
npm run dev      # then open http://localhost:3000/whatsapp
npm test         # includes tests/whatsapp-classifier-*.test.ts and tests/whatsapp-mapping.test.ts
npm run build    # full production build, used to verify this port compiles cleanly
```

Without `GEMINI_API_KEY` set, the chat still runs end-to-end in fixture mode (rougher
classification, but the checklist, buttons, and submit flow all work) — useful for a quick
local check without needing real credentials.
