# Phase 2 — Two-Mascot Scam-Awareness PSA Pipeline

Companion to `plan.md`. Read that file first — this phase reuses its taxonomy, audit
conventions, and privacy principles, and does not repeat them.

## 1. Project Goal

Turn a reviewed scam case into a 10-second comedy-skit PSA: two recurring mascots, one
falls for the scam, one is the smarter one who catches it. The story is never invented
from nothing — it comes from a `case_studies` row, which is always either an
officer-reviewed real pattern, a cited public source, or a clearly-tagged synthetic
story. Nothing renders without a human approval step, matching the existing
`/awareness` studio boundary ("Human approval required").

This phase is **not** a new source of truth. It is a controlled output layer on top of
`prevention_patterns`, exactly as `docs/prevention-intelligence.md` already describes
for text/WhatsApp-card awareness drafts — this just adds a video format.

---

## 2. Phase 2 Scope

Should support:

1. A `case_studies` table holding a scrubbed "base story" per scam pattern
2. Two configurable mascots (name, role, voice, numbered character sheet)
3. A script-generation step: base story + two mascots → scene-by-scene dialogue beats
4. A single-call render step (MiniMax H3 Max Turbo via fal, same provider the
   `internetphysics/live-classroom` project already uses for this exact model)
5. A fourth format option in `AwarenessStudio.tsx`: "10-second PSA skit"
6. The existing publish-lock / human-review gate, unmodified

Should NOT include:

- Automatic publishing of any rendered clip
- Any code path that writes `Complaint.description` or `Complaint.summary` directly
  into `case_studies.base_story`
- Real names, phone numbers, UPI IDs, or bank names in a script, even if present in a
  source article
- A live-streaming render runway (`live-classroom`'s just-in-time architecture solves a
  different problem — a live TV channel — this is a batch content pipeline)
- Police research/prediction tooling (see `TODO.md` — this is a separate, unresolved
  product/policy question, not an engineering detail of this phase)
- WhatsApp-based scam checking (see `TODO.md`)

---

## 3. Relationship to the Existing System

- `AwarenessStudio.tsx` already fetches `VERIFIED` patterns from
  `/api/prevention/patterns` and has a "Create draft" flow that currently returns
  static template copy. This phase gives that flow a real generator and a fourth
  format.
- `PreventionPattern.behavioural_pattern` (`backend/app/modules/prevention/service.py`)
  is a deterministic template string — safe to reference, but not a story. A
  `case_studies` row is the actual narrative input; it may cite a `behavioural_pattern`
  for grounding but is authored separately.
- Rendering follows the pattern already proven in `internetphysics/live-classroom`:
  a numbered character sheet per mascot (H3's prompt rewriter copies numbered lists
  verbatim, compresses prose), a fixed seed for visual consistency, and a compiled
  prompt combining sheet + scene + voice + style.

---

## 4. Data Model — New Tables

### 4.1 `case_studies`

```text
id                      UUID PK
source_type             ENUM (real_reviewed, public_research, synthetic)
title                   VARCHAR
scam_category           VARCHAR (matches plan.md §26 taxonomy)
base_story              TEXT        -- scrubbed narrative, see rule below
behavioural_pattern_id  UUID NULL   -- FK prevention_patterns, optional grounding
source_citation         TEXT NULL   -- required when source_type = public_research
status                  ENUM (draft, approved, archived)
reviewed_by             UUID NULL
reviewed_at             TIMESTAMP NULL
created_at              TIMESTAMP
```

**Hard rule:** no code path may write `Complaint.description` or `Complaint.summary`
into `base_story`. A `real_reviewed` row is hand-written by a reviewer who has read the
complaint and produced a clean summary with zero identifying detail — the same
judgment call an officer already makes for the text/WhatsApp awareness formats. This is
a manual authoring step, not an extraction step.

### 4.2 `mascots`

```text
id                  UUID PK
name                VARCHAR
role                VARCHAR      -- e.g. "the mark", "the smart one"
voice               TEXT         -- one sentence: pitch, accent, delivery
character_sheet     JSONB        -- numbered lines, same shape as live-classroom's TEACHER
sprite_path          TEXT NULL
created_at          TIMESTAMP
```

Names, roles, voices, and character sheets are a product input, not something to
invent here. Seed two placeholder rows with `status = draft` and block Milestone 3 on
someone filling them in.

### 4.3 `psa_scripts`

```text
id                  UUID PK
case_study_id       UUID FK
mascot_a_id         UUID FK
mascot_b_id         UUID FK
language            VARCHAR
beats               JSONB   -- [{ sceneNumber, visualAction, speaker, line }]
status              ENUM (draft, approved, rejected)
reviewed_by         UUID NULL
reviewed_at         TIMESTAMP NULL
created_at          TIMESTAMP
```

### 4.4 `psa_renders`

```text
id                  UUID PK
script_id           UUID FK
provider_url        TEXT NULL
fal_request_id      VARCHAR NULL
duration_seconds    INTEGER
resolution          VARCHAR
cost_cents          INTEGER
render_status       ENUM (queued, running, complete, failed)
created_at          TIMESTAMP
```

---

## 5. Milestones (Codex should implement in this order)

### Milestone 1 — Data Model

Build: the four tables above, plus an Alembic migration.

Acceptance:

```text
migration runs
all four tables queryable and empty
FK constraints hold (case_studies -> prevention_patterns, psa_scripts -> case_studies/mascots, psa_renders -> psa_scripts)
```

### Milestone 2 — Mascot Config

Build: two `mascots` rows seeded as drafts with placeholder fields, an admin-only
endpoint or seed script to fill in the real name/role/voice/character_sheet later.

Acceptance:

```text
two mascot rows exist
character_sheet stored as an ordered list, not free prose
```

### Milestone 3 — Script Generation Service

Build: one LLM call taking `{case_study.base_story, mascot_a.character_sheet,
mascot_b.character_sheet, scam_category}` and returning `beats`. Reuse whatever LLM
provider abstraction the existing analysis pipeline already uses (`plan.md` §6, AI
Layer) rather than adding a second one.

The prompt must state explicitly: never introduce a name, phone number, bank name, or
identifying detail that is not already present in `base_story`. This is defense in
depth — `base_story` should already be clean by Milestone 1's rule, but the script step
must not be trusted to add anything back in.

Acceptance:

```text
given an approved case_study and two mascots, produces a beats array
a reviewer can edit beats before approval
status stays "draft" until a human sets it to "approved"
```

### Milestone 4 — Render Integration

Build: one fal call to `minimax/h3-max-turbo/text-to-video`, `duration: 10`,
resolution `480P` to start, prompt compiled from both character sheets + the approved
beats (mirror `compileH3ScenePrompt` in `internetphysics/live-classroom`). Single call,
no streaming runway — this produces one finished asset per approved script, not a live
feed.

Acceptance:

```text
approved script produces exactly one fal request
provider_url, fal_request_id, and cost_cents are recorded on psa_renders
failed renders are not billed and are retried once (matches live-classroom's convention)
```

### Milestone 5 — Awareness Studio Wiring

Build: add `"10-second PSA skit"` as a fourth `format` option in
`AwarenessStudio.tsx`. Selecting it swaps the picker from patterns-only to
`case_studies` (approved ones), keeps the existing two-step flow (choose intelligence →
choose format → generate), and the existing `publish-lock` component stays exactly as
is — do not add a path that skips it.

Acceptance:

```text
officer flow: pick approved case_study -> generate draft script -> review/edit beats -> approve -> render -> preview -> still locked behind human approval before any publish action
```

### Milestone 6 — Tests + Audit

Build: schema validation tests for all four tables, an `audit_events` row on script
approval and on render request (reuse the existing audit pattern, `plan.md` §32/§41),
and one regression test asserting no code path constructs a `case_studies.base_story`
value from `Complaint.description` or `Complaint.summary`.

Acceptance:

```text
audit trail shows who approved each script and each render request
the regression test fails if someone later wires base_story to raw complaint text
```

---

## 6. Cost Model

MiniMax H3 Max Turbo bills by duration × resolution, not by character count. Using the
same per-second rate already coded into `live-classroom`'s `classroom-config.ts`
(~$0.025/s at 480P):

```text
10s PSA at 480P   ~$0.25 per render
10s PSA at 768P   ~$0.72-0.80 per render (fal's documented 768P rate)
```

Start at 480P for iteration volume; revisit resolution once script quality is settled.

---

## 7. Populating `case_studies` — Recommendation

Three source types exist so the slow, high-trust path (real cases) isn't the only way
to get volume:

- **`public_research`** (lead with this for volume): stories imported from already-public
  articles, advisories, and forum reports. Zero privacy risk because the source is
  already public. See `docs/research/astra-scam-corpus-brief.md` — a ready-to-run brief
  for a research agent to populate this.
- **`synthetic`** (use once tone is established): LLM-generated scenarios following the
  same taxonomy as `plan.md` §26, explicitly tagged as synthetic in the UI. Unlimited
  volume, no sourcing effort, but needs a human read-through before `approved`.
- **`real_reviewed`** (use sparingly): hand-written by an officer summarizing a
  verified pattern. This is the slow path — it costs a person's time per story — so
  reserve it for the small set of stories where grounding in a real, verified local
  pattern matters more than volume.

---

## 8. Explicitly Deferred

See `TODO.md` for the full backlog. Not in scope for this phase:

- Police predictive-research / suspect-tracking workspace
- WhatsApp real-time scam/SMS checker ("scam DNA")
- A standalone "generate me a new scam scenario" user feature (overlaps with
  `case_studies.source_type = synthetic` above — check this plan before scoping it
  separately)

---

## 9. Development Principles for Codex (in addition to `plan.md` §41)

1. Never let `psa_scripts` or `case_studies` read from `Complaint.description` or
   `Complaint.summary` directly — only through a reviewed `case_studies.base_story`
   row.
2. Character sheets are numbered lists, not prose — H3's prompt rewriter compresses
   prose and copies numbered lists verbatim. See `internetphysics/live-classroom`'s
   `TEACHER` object for a working reference.
3. One render call per approved script. No streaming runway — this is a batch content
   pipeline, not a live channel.
4. The publish-lock stays. No code path may mark a `psa_renders` row "published"
   without a human approval event.
5. `mascots.character_sheet`, names, and voices are a product input. Do not invent
   placeholder identities that could ship as real product content — seed rows as
   `draft` and block on someone supplying the real values.

---

## 10. Phase 3 — Schedule, Officer Box, Publish (built 2026-09-07)

Built as a faster vertical slice on top of Milestones 3-4 rather than waiting on
Milestones 1-2's `case_studies`/`mascots` tables — it reads `docs/research/corpus`
directly and uses one new table, `psa_queue_items`, instead. Revisit this shortcut if
volume outgrows two corpus categories and two placeholder mascots.

**Officer box** (`PsaQueueItem`, `backend/app/modules/awareness/queue.py`,
`/awareness/psa-lab/officer-box`): every render — manual button or scheduled — lands
here as `pending_review`. An officer's decision is the only thing that changes that:
`reject` stops there; `approve` immediately calls
`publish.py::publish_to_configured_channels`, which tries each publisher and records
per-channel results whether or not any are actually configured. Nothing publishes on
approval-adjacent timers or retries — one approval, one publish attempt.

**Scheduling is deliberately not in this codebase.** `POST /awareness/psa/auto-run`
(`auto_run.py::run_auto_generate`) is one stateless job: pick a story, write it,
render it, enqueue it. The lab's "Run now" button calls it; point any external cron or
event-driven runner at the same endpoint for a weekly (or whatever cadence) run — same
code path, same queue, same review gate either way. `app/worker.py` was extended for
this once and then deliberately reverted — running scheduling inside the app worker
duplicated infrastructure the operator already has elsewhere.

**Publish connectors** (`backend/app/modules/awareness/publishers/`): each is inert
until its own credentials are set (see `TODO.md` for exactly what each one needs from
you — none of it is something this plan or Codex can supply).
- `youtube.py` — real YouTube Data API v3 multipart upload, OAuth refresh-token
  exchange. Needs a one-time browser-based consent from the channel owner.
- `instagram.py` — real Graph API container-create → poll → publish flow for Reels.
  Needs a Meta app + your account as a tester (no App Review needed for your own
  account).
- `whatsapp.py` — a stub, deliberately. There is no "WhatsApp Shorts," and Meta's
  official Cloud API doesn't expose Channels; this codebase's own `.env.example`
  already assigns WhatsApp ownership to Bhumika, with no outbound-send code in
  `app/modules/whatsapp` to extend. See `TODO.md` for the decision this needs before
  any code goes here.
