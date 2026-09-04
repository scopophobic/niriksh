# Niriksh mentor demo script

## Before the room

1. Open `https://niriksh.scopophobic.xyz` and confirm it redirects from HTTP and loads over HTTPS.
2. Sign in once and confirm the officer dashboard loads its case list from the backend.
3. Confirm Niriksh health says `bhumika_integration: configured` and `direct_whatsapp_webhook: disabled`.
4. Configure Bhumika with the Niriksh API URL and the shared integration key. Do not change Bhumika's Meta callback or credentials.
5. Keep one approved test phone ready.
6. Send one private test text and one voice note before presenting. Confirm Bhumika sends the curated submission, the case appears in Niriksh, and Bhumika relays the tracking number.

## 30-second setup

“Niriksh is a cybercrime intake and triage system. A victim can report through the web or the same WhatsApp number we already operate. Both channels create one canonical case in the backend. The system organises allegations and evidence for an authorised human reviewer; it does not claim to file an FIR or decide guilt.”

## Five-minute demo

1. Open the officer dashboard and show that the queue is backed by the FastAPI service and Supabase PostgreSQL.
2. From an approved phone, send the existing Bhumika WhatsApp number a short fictional complaint: “Yesterday I paid ₹5,000 after a caller on WhatsApp pretended to be my bank.”
3. Explain while Bhumika asks questions: “Bhumika owns the WhatsApp conversation and gathers the required details. Once the form is complete, it sends one versioned, idempotent submission to Niriksh.”
4. Reply with a missing detail, such as the UPI ID or transaction reference.
5. Send a short fictional voice note containing the date, location, and transaction reference.
6. When Niriksh responds, say: “Bhumika transferred the original voice note to Niriksh. Niriksh stored it privately, computed a SHA-256 digest, transcribed it, extracted useful fields, and retained the transcript with the evidence record. The model output is advisory and has a deterministic fallback.”
7. Tap **Submit report**.
8. Show the WhatsApp reply containing a `CYB-YYYY-NNNNNN` tracking number and report version.
9. Refresh the officer dashboard, open the new case, and show the summary, category, priority, extracted fields, evidence metadata/transcript, report, and audit trail.
10. Send `status` in WhatsApp and explain that Bhumika looks up the existing Niriksh submission/tracking state instead of opening a duplicate case.
11. Close with: “This is submitted for Niriksh review, not automatically to police. The next integration can send a human-approved report to an authorised external system.”

## Architecture answer

“The UI and WhatsApp are channels, not separate databases. FastAPI owns the business rules and API. Supabase PostgreSQL owns canonical structured data. A private Supabase Storage bucket holds binary evidence; PostgreSQL holds its key, hash, metadata, and analysis. Gemini performs source-labelled multimodal extraction and audio transcription, while deterministic policy remains available if it fails. Analysis runs, reports, routing decisions, and audit events are independently versioned.”

## If the model is slow or unavailable

Say: “Connected analysis can fail without losing the complaint. The complaint is already stored, deterministic triage still works, and the failed provider run is recorded for retry.” Then continue with text intake and submit.

## If WhatsApp cutover fails

Replay the same fictional JSON through the protected Bhumika integration endpoint or use the web form. The stable submission ID returns the original case instead of duplicating it; Meta remains untouched.

## Claims to avoid

- Do not say the system filed an FIR or government complaint.
- Do not say a hash proves authenticity.
- Do not call AI-media detection forensic proof.
- Do not show real victim evidence or unredacted credentials.
- Do not call the current bucket immutable or legally compliant.
