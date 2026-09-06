# Niriksh deployment runbook

Last updated: 6 September 2026

## Topology

```text
Browser
  → niriksh (Next.js ECS Express)
  → niriksh-api (FastAPI ECS Express)
      ├── Supabase PostgreSQL
      ├── private Supabase Storage
      └── optional connected-analysis provider
```

Existing service names:

- website ECS service: `niriksh`
- API ECS service: `niriksh-api`
- custom web domain: `https://niriksh.scopophobic.xyz`
- API origin currently documented for deployment: `https://ni-adada88b582b4d3ea6b21602d2c1abf7.ecs.us-east-1.on.aws`

Do not assume those endpoints are healthy merely because they appear in this file; verify them during each release.

Bhumika/WhatsApp is not part of this release or deployment procedure. Historical integration routes may still exist in the codebase, but no Bhumika or Meta credential is required for Report → Understand → Connect.

## Secret placement

Production does not read the repository’s local `.env`. Put secret key/value pairs in the existing AWS Secrets Manager JSON used by the API task, then map them into the ECS task definition. The web task should receive only values it actually needs.

API secret shape:

```json
{
  "DATABASE_URL": "postgresql+psycopg://...",
  "JWT_SECRET": "...",
  "INTERNAL_API_KEY": "...",
  "DIRECTORY_HASH_SECRET": "...",
  "DEMO_USER_PASSWORD": "...",
  "GEMINI_API_KEY": "...",
  "EVIDENCE_S3_BUCKET": "niriksh-bucket",
  "EVIDENCE_S3_REGION": "ap-southeast-1",
  "EVIDENCE_S3_ENDPOINT_URL": "https://<project-ref>.storage.supabase.co/storage/v1/s3",
  "EVIDENCE_S3_ACCESS_KEY_ID": "...",
  "EVIDENCE_S3_SECRET_ACCESS_KEY": "..."
}
```

Requirements:

- use a `postgresql+psycopg://` URL with the Supabase pooler when the ECS network needs IPv4;
- percent-encode special characters inside the database password;
- keep `JWT_SECRET`, `INTERNAL_API_KEY`, and `DIRECTORY_HASH_SECRET` distinct;
- make security secrets random and at least 32 characters;
- keep storage and database credentials out of the web image;
- never use a `NEXT_PUBLIC_` name for a secret;
- never paste real values into documentation, Dockerfiles, task-definition source, or Git.

Non-secret task variables may include `PUBLIC_APP_URL`, `TRACKING_TOKEN_DAYS`, and configured origins.

## Release order

### 1. Deploy the API

```bash
AWS_REGION=us-east-1 \
NIRIKSH_API_SECRET_ARN='<secret-arn>' \
./scripts/deploy-ecs-express-api.sh
```

The API container runs `alembic upgrade head` before Uvicorn. This release requires head revision `20260906_0005`, which creates `case_indicators` and its exact-match indexes.

Confirm the API health endpoint and inspect task logs for migration or startup failures:

```bash
curl -fsS 'https://<api-origin>/health'
```

Expected essentials are a healthy service and database connection. Connected analysis or S3 health may be intentionally unconfigured in a local/non-media environment; the UI must disclose those limits.

### 2. Deploy the web service in place

```bash
AWS_REGION=us-east-1 \
BACKEND_API_URL='https://<api-origin>/api/v1' \
NIRIKSH_WEB_SECRET_ARN='<secret-arn>' \
./scripts/deploy-ecs-express.sh
```

The script updates the existing `niriksh` service. It should not create a second website service.

### 3. Verify

1. HTTPS landing page loads and HTTP redirects to HTTPS.
2. Officer login creates an HTTP-only session.
3. `/api/cases` loads canonical backend cases.
4. A fictional web complaint can be submitted.
5. Private evidence can be ingested and is not publicly enumerable.
6. A case page shows reconstruction, chronology, provenance, indicators, missing information, active signals, and status.
7. `GET /api/v1/complaints/{id}/related-incidents` requires authentication.
8. Two fictional complaints sharing an exact normalized indicator appear as Related Incidents.
9. Similar-category cases without an exact shared identifier do not appear.
10. Public tracking exposes only its allow-listed fields.
11. Legacy decision fields remain neutral (`Needs review`, `0`, `0`).
12. Task logs contain no secret values or private evidence URLs.

Do not seed competition fixtures into a real complaint environment unless the environment is explicitly designated for demonstration. The local command is:

```bash
./scripts/demo-data.sh seed
```

## Rollback

- ECS images use immutable ECR tags; redeploy the last known-good web and API tags.
- Database migration `20260906_0005` is additive. Prefer application rollback while leaving the table in place. Run a downgrade only after confirming no new release wrote indicator data that must be preserved.
- Keep the API backward compatible with the existing case payload during rollback.

## Production-readiness gap

The current deployment is suitable for a controlled fictional demo, not real sensitive complaints. Before real use, add jurisdiction-scoped RBAC, citizen identity/grants, retention and deletion policy, immutable evidence retention, malware quarantine, rate limits, audit monitoring, backup/restore tests, incident response, privacy impact assessment, threat modelling, and legal/agency review.
