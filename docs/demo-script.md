# Niriksh two-minute demo

This walkthrough uses fictional data only. It demonstrates Report → Understand → Connect without Bhumika, WhatsApp, real victims, or claims of government integration.

## Prepare once

1. Supply safe local configuration in `.env`; never commit it.
2. Start the stack:

   ```bash
   docker compose up --build -d
   ```

3. Seed the repeatable fixture:

   ```bash
   ./scripts/demo-data.sh seed
   ```

4. Confirm `http://localhost:8000/health` and `http://localhost:3000` respond.
5. Sign in at `/login` with the officer email/password configured in the environment. Local development may use the repository’s documented demo-auth setting; production must not disable officer authentication.
6. Open `/cases/demo-connect-a` in another tab.

The seed command may be repeated. It replaces only the four fixed demo IDs and leaves every other complaint untouched.

## Exact fictional scenario

| Case | Story | Explicit indicator |
|---|---|---|
| `CYB-2026-D001` | Social account takeover, impersonation, and payment requests | `niriksh-demo@upi`, `case-link.example`, fictional social handle |
| `CYB-2026-D002` | A separate fictional payment request | same UPI ID |
| `CYB-2026-D003` | A separate fictional verification message | same reserved domain |
| `CYB-2026-D004` | An unrelated marketplace complaint | no shared identifier |

All values are safe fixtures. `.example` is used for non-resolving demo domains.

## Recording script

### 0:00–0:15 — Position

Show the landing hero.

Say:

> “A complaint is not yet an investigation-ready case. Niriksh takes scattered narratives and evidence through one path: Report, Understand, Connect. It prepares source-backed information for people; it does not replace police or decide priority.”

Scroll just far enough to reveal the three pillars and human/AI boundary.

### 0:15–0:38 — Report

Open `/report`, select **Load a complete sample**, and show the guided information and evidence inputs.

Say:

> “A person reports what happened and adds what they safely have—messages, screenshots, documents, transaction details, or supported media. The form is adaptive rather than one overwhelming questionnaire.”

Run **Organise complaint** if this was prepared before recording. Point to one missing-information question and its source/limitation wording.

### 0:38–1:18 — Understand

Open seeded case `/cases/demo-connect-a`.

Point, in order, to:

1. the concise reconstruction;
2. the provenance legend;
3. timeline events at 09:12, 09:18, 09:24, and 09:31;
4. a **Source →** evidence link;
5. extracted identifiers;
6. an active factual signal; and
7. **Original profile URL** under missing information.

Say:

> “The officer can answer what happened, when, what supports it, which identifiers matter, and what is still missing. Evidence, extracted facts, and analysis-assisted observations stay distinct. Ongoing conditions are factual signals—not an AI priority score.”

Click one timeline source to move to the original evidence record.

### 1:18–1:48 — Connect

Show **Related incidents** on D001.

Point to:

- D002 and exact UPI match `niriksh-demo@upi`;
- D003 and exact domain match `case-link.example`;
- provenance on both sides; and
- the disclaimer.

Say:

> “Connect is deterministic. PostgreSQL matches only the same normalized explicit identifier. It does not connect cases because their narratives, dates, locations, or categories look similar. This is a potential connection—not a claim about a common offender.”

Optionally mention that D004 has a similar category but does not appear because it has no shared identifier.

### 1:48–2:00 — Human control

Return to the status or routing area.

Say:

> “Niriksh complements an existing review workflow. Humans confirm the category, destination, status, and every operational or legal decision. AI assists with extraction and organisation; people remain accountable.”

## Reliability fallback

- If connected media analysis is unavailable, continue with the disclosed deterministic result; never describe it as media interpretation.
- If a just-submitted browser case has not synchronized, use the seeded D001 case. Do not imply that browser cache is the database.
- If Related Incidents is unavailable, verify that the API container is healthy, migration `20260906_0005` ran, and the seed command succeeded.
- The demo does not require network access after images/dependencies are built.

## Reset

```bash
./scripts/demo-data.sh reset
```

The command removes only `demo-connect-a` through `demo-connect-d`.

## Claims to avoid

Do not say:

- “same criminal” or “criminal network detected”;
- “AI decides which case is urgent”;
- “the evidence is authentic”;
- “an FIR was filed”;
- “integrated with the government”;
- “WhatsApp reporting is included”; or
- “these are real complaints.”
