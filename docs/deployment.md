# Niriksh deployment runbook

Last updated: 5 September 2026

## Deployed topology

```text
Browser -> niriksh (Next.js ECS Express) -> niriksh-api (FastAPI ECS Express)

Victim -> Meta/WhatsApp -> Bhumika server
                              |
                              `-> curated complaint/files -> niriksh-api
                                                              |-> Supabase PostgreSQL
                                                              |-> private Supabase Storage
                                                              |-> extraction-only Gemini adapter
                                                              `-> report + signed tracking link
```

Live resources:

- website: `https://niriksh.scopophobic.xyz`
- website ECS service: `niriksh`
- API ECS service: `niriksh-api`
- API base: `https://ni-adada88b582b4d3ea6b21602d2c1abf7.ecs.us-east-1.on.aws`
- Bhumika intake: `/api/v1/integrations/bhumika/intakes`
- public tracking: `https://niriksh.scopophobic.xyz/track?token=<signed-token>`
- database: Supabase PostgreSQL through the IPv4 session pooler
- evidence: private Supabase Storage bucket `niriksh-bucket`
- HTTP: permanent redirect to HTTPS

Bhumika's existing Meta callback is unchanged. Niriksh does not receive Meta webhooks and needs no Meta credentials.

## Required secret fields

The API uses one AWS Secrets Manager JSON secret:

```json
{
  "DATABASE_URL": "postgresql+psycopg://...?...sslmode=require",
  "JWT_SECRET": "...",
  "INTERNAL_API_KEY": "...",
  "DIRECTORY_HASH_SECRET": "at-least-32-random-characters",
  "BHUMIKA_INTEGRATION_KEY": "...",
  "DEMO_USER_PASSWORD": "...",
  "GEMINI_API_KEY": "...",
  "EVIDENCE_S3_BUCKET": "niriksh-bucket",
  "EVIDENCE_S3_REGION": "ap-southeast-1",
  "EVIDENCE_S3_ENDPOINT_URL": "https://<project-ref>.storage.supabase.co/storage/v1/s3",
  "EVIDENCE_S3_ACCESS_KEY_ID": "...",
  "EVIDENCE_S3_SECRET_ACCESS_KEY": "..."
}
```

`BHUMIKA_INTEGRATION_KEY` must be a separate random secret shared only by the two servers. `DIRECTORY_HASH_SECRET` must be at least 32 random characters and must remain stable so existing identifier fingerprints stay searchable. The Niriksh web task receives only the internal BFF key and Gemini key. Meta and storage credentials never enter the web task.

The API deployment script also sets non-secret `PUBLIC_APP_URL=https://niriksh.scopophobic.xyz` and `TRACKING_TOKEN_DAYS=180`. Do not add those fields to Secrets Manager. Tracking tokens use the existing `JWT_SECRET` with a tracking-specific issuer, audience, and type.

## Deploy API

```bash
AWS_REGION=us-east-1 \
NIRIKSH_API_SECRET_ARN='<secret-arn>' \
./scripts/deploy-ecs-express-api.sh
```

The container runs `alembic upgrade head` before Uvicorn. Confirm:

```bash
curl -fsS 'https://ni-adada88b582b4d3ea6b21602d2c1abf7.ecs.us-east-1.on.aws/health'
```

Expected fields include `database: connected`, `bhumika_integration: configured`, `direct_whatsapp_webhook: disabled`, `connected_analysis: configured`, and `evidence_storage: s3`.

## Deploy web in place

```bash
AWS_REGION=us-east-1 \
BACKEND_API_URL='https://ni-adada88b582b4d3ea6b21602d2c1abf7.ecs.us-east-1.on.aws/api/v1' \
NIRIKSH_WEB_SECRET_ARN='<secret-arn>' \
./scripts/deploy-ecs-express.sh
```

The script updates the existing `niriksh` service; it does not create another website. Verify HTTPS, HTTP redirect, login, `/api/cases`, and `/api/analyze`.

For a fictional Bhumika-side deployment smoke test without printing the shared key:

```bash
python3 scripts/smoke-bhumika-integration.py \
  --api-url 'https://ni-adada88b582b4d3ea6b21602d2c1abf7.ecs.us-east-1.on.aws/api/v1' \
  --secret-arn '<secret-arn>' \
  --evidence-file public/demo-evidence/fictional-threatening-chat.png
```

The script retrieves the key internally through the AWS CLI, submits fictional data, retries it, checks the signed/public tracking path and protected updates, adds a fictional supplement, and optionally uploads/retries evidence. It never prints the key.

## Configure Bhumika

Add these server-only values to Bhumika:

```text
NIRIKSH_API_URL=https://ni-adada88b582b4d3ea6b21602d2c1abf7.ecs.us-east-1.on.aws/api/v1
NIRIKSH_INTEGRATION_KEY=<same value as BHUMIKA_INTEGRATION_KEY>
```

When Bhumika has curated the form, call the contract in [bhumika-integration.md](./bhumika-integration.md). The complete copy-ready coding-agent assignment is [bhumika-agent-handoff.md](./bhumika-agent-handoff.md). Use a stable unique submission ID. After a timeout, GET the submission before retrying. For original media, create with `finalize: false`, upload each file once using its stable external ID, then finalize.

## Production checks

1. Invalid or missing integration keys return `401`.
2. The same submission ID and payload return one case/report.
3. Reusing a submission ID with different content returns `409`.
4. Original file bytes are stored privately and hashed.
5. Finalize creates one report and returns a `CYB-YYYY-NNNNNN` tracking number.
6. The officer dashboard shows the same canonical complaint.
7. `/api/v1/channels/whatsapp/webhook` returns `404`.
8. The signed tracking link returns only allow-listed status fields; an invalid token returns `401`.
9. A supplement keeps the same tracking number and creates report version 2 exactly once.
10. `/api/v1/safety/check-message` does not store pasted text and `/api/v1/safety/lookup` never exposes raw directory identifiers.
11. The officer inbox is chronological and every case exposes neutral legacy decision fields only (`Needs review`, `0`, `0`).

Do not send real victim data until authentication, retention, access-control, monitoring, backup, and legal/privacy requirements have been reviewed.
