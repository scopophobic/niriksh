# Human Review, Subject Folders, and Public Safety Checks

Status: implemented locally on 5 September 2026. This document supersedes any older Niriksh design that describes AI-generated priority, severity, confidence, legal classification, or autonomous routing.

## Product position

Niriksh is an intake and evidence-organisation layer that can complement an existing government complaint workflow. It helps a reporter assemble a clear complaint and helps an authorised reviewer understand the submitted facts, sources, evidence metadata, timeline, and missing information. It does not decide guilt, legal outcome, urgency, priority, or final routing.

The consumer side remains deliberately useful: guided complaint intake, evidence preservation, Bhumika submissions, tracking numbers, signed tracking links, status updates, and a new preventive safety checker. The officer side is now a category-based review workspace rather than an AI-ranked queue.

## Decision boundary

AI is allowed to:

- transcribe intelligible audio;
- extract visible text and identifiers from supplied material;
- organise reporter-provided facts into structured fields;
- produce a source-grounded draft summary;
- build a draft timeline;
- list factual questions for missing fields; and
- state technical limitations.

AI is not allowed to:

- assign a priority or severity;
- produce a risk score or confidence-based queue;
- decide a legal category, guilt, truth, or authenticity;
- decide that media is AI-generated;
- select the final team or jurisdiction;
- dispatch a case; or
- recommend an enforcement action.

These prohibited fields were removed from both connected Gemini response schemas. Legacy `severity`, `severityScore`, and `confidence` fields remain temporarily in the API/database for compatibility but are always neutralised to `Needs review`, `0`, and `0`. Old stored scores therefore cannot reappear in the UI.

## Subject-folder model

The reporter selects the closest subject folder. An officer can confirm or change it and must record a reason when routing. An uncertain report remains visible under **Other / needs category review**; the system never guesses a folder from narrative keywords.

| Folder | Proposed specialist workspace | Examples |
| --- | --- | --- |
| Financial fraud | Financial complaint review | UPI, cards, banking, investment, shopping, and payment fraud |
| Social media and identity misuse | Social media and identity review | Impersonation, fake profiles, and misuse of identity or media |
| Threats, harassment and extortion | Harassment and extortion review | Threatening messages, stalking, bullying, and blackmail |
| Sexual exploitation and child safety | Sensitive complaint review | Non-consensual intimate material and child exploitation; restricted handling |
| Account access and phishing | Account and phishing review | Credential requests, account takeover, and unauthorised access |
| Malware, ransomware and data incidents | Technical incident review | Malware, ransomware, intrusion, and data theft |
| Other / needs category review | General complaint review | Uncertain, mixed, or other incidents |

This is a product working taxonomy, not a claim that these are the exact statutory or live NCRP categories. It should be mapped to the receiving authority's current taxonomy during a government integration.

The design is informed by the official National Cybercrime Reporting Portal, which distinguishes financial fraud from other cybercrime and describes complaint types including online/social-media crime, financial fraud, ransomware, hacking, cryptocurrency crime, and trafficking. The portal also provides women/child and other-cybercrime reporting paths.

Official references:

- [National Cybercrime Reporting Portal](https://www.cybercrime.gov.in/)
- [NCRP frequently asked questions](https://www.cybercrime.gov.in/Webform/FAQ.aspx)
- [NCRP citizen manual for other cybercrime reports](https://cybercrime.gov.in/UploadMedia/MHA-CitizenManualReportOtherCyberCrime-v10.pdf)

## Public suspicious-message checker

The public `/safety` page accepts pasted text and explains transparent, deterministic warning signs such as:

- requests for OTP, PIN, CVV, password, or recovery code;
- urgency or account-blocking pressure;
- payment, transfer, fee, or QR-code requests;
- screen-sharing or remote-access requests;
- unexpected prizes, jobs, or guaranteed returns;
- threats or coercion; and
- links that should be verified independently.

This checker is deliberately rule-based. It does not send the pasted message to Gemini, store the message, label the sender a criminal, or claim that the message is safe when no rule matches. It returns practical next steps and official NCRP links.

## Identifier directory

Users can check a phone number, email, UPI ID, URL, social handle, SMS header, or other identifier. A checker result can be:

- `no_published_record` — no Niriksh match; explicitly not proof of safety;
- `reported` — matched a prior complaint record but not a verified finding;
- `reviewed_concern` — an authorised reviewer marked the aggregate as a concern; still not proof of guilt; or
- `cleared` — an authorised review cleared the Niriksh record.

Public lookup is exact-match only. There is no endpoint to enumerate the directory. Only an authenticated officer/internal service can add a record.

Privacy controls:

- The normalised identifier is converted to an HMAC-SHA-256 fingerprint with `DIRECTORY_HASH_SECRET`.
- Only that keyed fingerprint, a masked display value, aggregate count, status, timestamps, and an optional reviewer note are stored.
- The raw identifier is not stored in this directory.
- HMAC prevents simple rainbow-table lookup that a plain unsalted hash would permit.
- Production must use a random secret separate from `JWT_SECRET`, supplied through AWS Secrets Manager.

This design complements rather than replaces the official NCRP suspect repository. Niriksh links users to the official repository and report flow:

- [Check/report suspect identifiers on NCRP](https://www.cybercrime.gov.in/Webform/cyber_suspect.aspx)
- [NCRP suspect repository](https://cybercrime.gov.in/Webform/suspect_search_repository.aspx)

The official repository itself explains that it is built from identifiers reported across complaints and grows with reporting. Niriksh adopts the same critical safety principle: a match is a lead, not adjudication.

## API surface

Public endpoints:

- `GET /api/v1/safety/categories`
- `POST /api/v1/safety/check-message` with `{ "text": "..." }`
- `POST /api/v1/safety/lookup` with `{ "value": "...", "type": "upi" }`

Officer-only endpoint:

- `POST /api/v1/safety/identifiers` with the identifier, optional type, review status, and note.

The Next.js frontend exposes same-origin proxies at `/api/public/safety/check-message` and `/api/public/safety/lookup`; browser code never receives the internal API key.

## Processing flow

1. A reporter or Bhumika chooses a subject folder and supplies facts and evidence.
2. Niriksh stores the complaint in PostgreSQL and evidence in private object storage.
3. Optional connected analysis extracts and organises source-grounded information only.
4. The backend neutralises all legacy decision fields before persistence and before UI hydration.
5. Cases appear in received order and can be filtered by subject folder.
6. An officer reads the source material, confirms/corrects the folder, decides the destination, and records the reason.
7. The reporter receives tracking details and safe public status updates.

## Production configuration

Add `DIRECTORY_HASH_SECRET` to the existing `niriksh/api-production` AWS Secrets Manager JSON and map it into the ECS API task definition. Generate at least 32 random bytes. Changing this value later makes existing directory fingerprints unsearchable, so rotation needs a deliberate re-indexing plan.

The database migration `20260906_0004_safety_directory.py` must run before the new API task handles safety-directory writes. The frontend and API task definitions must then be redeployed together.

## Remaining work before government use

- Validate the working taxonomy with the actual receiving agency and current SOPs.
- Define role-based access by jurisdiction and specialist unit.
- Add retention/deletion schedules, consent records, legal-basis review, and data-subject workflows.
- Add malware scanning, content-disarm rules, sensitive-media access logging, and restricted preview controls.
- Add rate limiting and abuse monitoring to public checks.
- Establish a documented directory dispute, correction, and appeal process.
- Prevent reviewers from publishing identifiers without evidence and a defined approval workflow.
- Run accessibility, multilingual, security, privacy, and representative user testing.
- Conduct a DPIA/threat model and obtain legal/security review before handling real sensitive complaints.

## Demo narrative

“Niriksh does not ask AI to decide which victim matters first. It organises every complaint into a clear evidence brief and a human-selected subject folder. Officers see the original report, source-linked details, evidence limitations, missing information, and proposed team, then make and record the decision themselves. Citizens also get a preventive message checker and privacy-protected identifier lookup, with direct links to the official national portal.”
