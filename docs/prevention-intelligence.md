# Prevention intelligence

## Product direction

Niriksh is prevention-first cyber intelligence built from incident patterns: **Understand each case → Learn across cases → Prevent repeated harm**. Complaints and evidence remain the input; reviewed intelligence is the differentiated output.

## Inputs and aggregation

`case_indicators` remains the only indicator store. It preserves a normalized explicit identifier, raw display value, extraction source, and optional evidence provenance. Prevention aggregation builds connected candidate clusters only when two or more complaints have equal `(indicator_type, normalized_value)` values.

Supported identifiers include phone numbers, email addresses, UPI IDs, transaction/UTR values, domains, URLs, scoped social handles, and account identifiers. Generic category, location, date, amount, or narrative similarity never connects reports.

Behavioural wording can describe a candidate after exact matches form it (for example, “high-return wording → messaging channel → payment request”). It cannot independently create or verify a pattern.

Every candidate exposes report count, first/last seen dates, exact indicators and source labels, supporting cases, and the reasons it was surfaced. “Strongly supported” and “Moderately supported” are explanation labels, not probability or guilt scores.

## Review and trust boundary

Patterns begin as `UNREVIEWED` and may become `VERIFIED`, `DISMISSED`, or `NEEDS_MORE_EVIDENCE`. A review writes reviewer, timestamp, note, status history, and an audit event. Verification says that a human reviewed the supporting information; it does not identify a person, group, offender, or legal responsibility.

Only verified patterns can generate a future-case warning or expose prevention actions. The warning identifies the matching pattern, exact matched indicators, and supporting report count, and asks the reviewer to exercise caution and inspect the evidence.

Awareness/advisory output is a human-controlled draft only. It is never automatically published, accusatory, or an enforcement action.

## Fictional demo

Run `./scripts/demo-data.sh seed` with the Docker stack running. This creates six clearly fictional cases. Five contain the reserved `demo-invest@upi` and `wealth-demo.example` identifiers alongside high-return investment wording. `CYB-2026-D004` remains unrelated, showing that category similarity does not establish a pattern.

1. Open `/prevention` and inspect the emerging investment pattern and its reasons.
2. Open the pattern, inspect supporting cases/indicators, add a reviewer note, and select **Verify pattern**.
3. Open `CYB-2026-D006` (`/cases/demo-prevention-f`) to see the previously-observed warning.
4. Return to the verified pattern to demonstrate the awareness-draft control and its publish-review boundary.

`seed` resets only these six demo IDs. No fixture is real incident data.
