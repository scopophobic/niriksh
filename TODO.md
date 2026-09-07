# TODO

Backlog for the two-mascot scam-awareness PSA pipeline. Last updated 2026-09-07.

## Built — needs your action to actually run, not more code

- [x] Story → script → render → officer-box queue → approve → publish. Live at
      `/awareness/psa-lab` and `/awareness/psa-lab/officer-box`. `POST
      /awareness/psa/auto-run` is one stateless job (pick a story, write, render,
      enqueue) — the officer box's "Run now" button calls it, and it's the same
      endpoint to point an external cron/event-driven runner at for a weekly cadence.
      No scheduler lives inside niriksh on purpose — that's owned outside this repo.
      **Note:** this shipped on `docs/research/corpus` + a `psa_queue_items` table,
      not the `case_studies`/`mascots` DB tables `plan-awareness-psa.md` originally
      specced — smaller and faster to get something clickable. Milestones 1-2 of that
      plan (real `case_studies`/`mascots` tables) are still open if this needs to
      scale past the placeholder mascots and two corpus categories.
- [ ] **Set real mascot identities.** `backend/app/modules/awareness/mascots.py` is
      still two placeholder blobs. Optionally run
      `backend/scripts/generate_mascot_sprites.py` (needs `FAL_KEY`) to also get
      reference images instead of text-only description.
- [ ] **YouTube publishing.** Code is done (`publishers/youtube.py`) but inert
      without credentials. You need to: create a Google Cloud project, enable the
      YouTube Data API v3, create an OAuth client, and run a one-time OAuth consent
      (needs a browser, only the channel owner can do it) for the
      `youtube.upload` scope against your own channel — then set
      `YOUTUBE_CLIENT_ID`/`YOUTUBE_CLIENT_SECRET`/`YOUTUBE_REFRESH_TOKEN`.
- [ ] **Instagram publishing.** Code is done (`publishers/instagram.py`), inert
      without credentials. You need a Meta Business app with the Instagram Graph
      API product, your own account added as an app tester/admin (no App Review
      needed for your own account), and an access token with
      `instagram_content_publish` — then set `INSTAGRAM_ACCESS_TOKEN`/
      `INSTAGRAM_BUSINESS_ACCOUNT_ID`.
- [ ] **WhatsApp distribution — deliberately not built.** There is no "WhatsApp
      Shorts" product, and Meta's official Cloud API doesn't expose Channels at all
      (only unofficial third-party gateways do). niriksh's own `.env.example`
      already says "Bhumika owns Meta/WhatsApp" and there's no outbound-send code
      in `app/modules/whatsapp` today, only inbound webhooks. Decide first: is PSA
      distribution a new ask for Bhumika to build, or a deliberate exception to that
      ownership boundary for niriksh to send directly? `publishers/whatsapp.py` is a
      stub until that's decided.
- [ ] Public scam-story corpus research — see `docs/research/astra-scam-corpus-brief.md`
      (Astra-ready, run on Opus-5 tier). Only 2 of ~14 categories exist so far
      (`docs/research/corpus/`); the pilot from that brief covered the rest.

## Deferred — needs a product/policy decision before it's scoped

- [ ] **Police predictive-research / suspect-tracking workspace.** Requested: let
      police "do research based on all critical data... for following — picking these
      scammers up and future scam-habit predictions."
      **This conflicts with existing stated boundaries** — `plan.md` §39 explicitly
      defers "cross-case intelligence graphs" and "cross-state case intelligence," and
      `docs/human-review-and-safety.md` states AI "is not allowed to... decide that two
      complaints are related," and that Connect "never attributes an offender." A
      suspect-tracking/prediction tool sits directly against those. This needs a
      deliberate decision (who's authorized to use it, what "critical data" legally
      means here, retention/consent implications) before anyone writes a spec for it —
      don't scope this directly from the feature request without that decision first.

## Deferred — engineering, not yet scoped

- [ ] **WhatsApp "scam DNA" checker.** A user pastes an SMS or describes their
      situation on WhatsApp; the system says whether it looks like a scam or
      cybercrime-related. Likely builds on the existing rule-based checker described in
      `docs/human-review-and-safety.md` ("Public suspicious-message checker") and
      `lib/whatsapp-classifier.ts` / `lib/whatsapp-mapping.ts`, extended into a
      conversational flow over the existing `ChannelSession`/`ChannelMessage` tables.
      Keep the existing checker's rule: deterministic where possible, doesn't store the
      raw message by default.
- [ ] **Synthetic random-story generation mode.** A "generate a new scam scenario"
      capability for awareness content variety, distinct from case-grounded PSAs.
      Overlaps with `case_studies.source_type = "synthetic"` in
      `plan-awareness-psa.md` §4.1 and §7 — check that plan before scoping this as a
      separate feature.
