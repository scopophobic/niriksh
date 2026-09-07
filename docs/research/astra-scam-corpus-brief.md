# Research Brief — Public Scam-Pattern Corpus

For: Astra (research agent). Run this brief with your strongest available model
(Opus-5 tier) — deciding what counts as identifying detail is a judgment call, not a
lookup, so don't delegate this to a fast/cheap model.

Feeds: `case_studies` table, `source_type = "public_research"`, defined in
`plan-awareness-psa.md` §4.1.

## Goal

Find real, already-public scam narratives and turn each into a clean, source-cited
story that a script writer can later dramatize into a 10-second two-mascot PSA. You are
not writing the PSA script — you are producing the raw material for `case_studies`.

## Sources to search

- Published cybercrime news articles (financial-crime and consumer-protection beats)
- Government/consumer-protection scam advisories (e.g. RBI, CERT-In, NCRP awareness
  pages, and equivalent regional cyber-cell advisories)
- Public scam-report forums and aggregators — summarize the mechanism only, never
  quote or reproduce a reporter's name, number, or handle even if the source printed it
- Already-published SMS/phishing pattern bulletins (telecom-authority or CERT phishing
  pattern advisories meant for public awareness)

## Hard exclusions

- No real names, phone numbers, UPI IDs, bank names, or social handles, even if the
  source article names them. Genericize: "a bank employee," not "a named individual at
  a named bank."
- No detail about a specific identifiable living victim beyond what's needed to explain
  the scam mechanism.
- No unsourced claims. Every row needs a citable URL. A row without one gets discarded
  on import — don't submit it.

## Output schema (one object per story)

```json
{
  "title": "short label",
  "scam_category": "one of niriksh's existing taxonomy categories — see plan.md §26",
  "mechanism_summary": "2-4 sentences: how the scam works, no names",
  "suggested_beats": [
    "what happens first",
    "the moment it turns",
    "the tell / lesson"
  ],
  "who_falls_for_it_archetype": "e.g. 'someone expecting a delivery', 'a first-time investor'",
  "why_it_works": "one sentence — the psychological lever",
  "source_citation": "URL",
  "source_type": "news_article | government_advisory | forum_report | sms_bulletin"
}
```

## Volume requested

Roughly 8-10 stories per taxonomy category (`plan.md` §26 lists about 14 categories),
so ~100-140 stories in the first pass. Prioritize categories that already have
`PreventionPattern` coverage in niriksh (investment scam, parcel/delivery-fee scam,
authority impersonation / "digital arrest," account/phishing) first, since those
already have officer-reviewed `behavioural_pattern` context to check your findings
against.

## Deliverable format

One JSON file per category, or a single combined JSONL file — whichever your tooling
produces more reliably. Every row must carry `source_citation`.
