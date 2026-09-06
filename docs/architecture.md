# Niriksh architecture

Last verified: 6 September 2026

## Product and system boundary

```text
Reporter
  │
  │ complaint + evidence
  ▼
Next.js web application and same-origin BFF
  │
  ▼
FastAPI modular monolith
  ├── authentication and RBAC
  ├── complaints and case status
  ├── evidence and provenance
  ├── deterministic/connected analysis
  ├── reports
  ├── human routing
  ├── Connect indicator matching
  ├── tracking and safety
  └── audit
       │
       ├── PostgreSQL / Supabase PostgreSQL
       ├── private filesystem or S3-compatible object storage
       └── optional Gemini analysis
```

The product flow is:

```text
REPORT                    UNDERSTAND                         CONNECT
complaint + evidence  →   source-backed case reconstruction → exact shared indicators
```

Niriksh is a preparation and intelligence layer that can complement an existing complaint workflow. It does not file an FIR, replace a government system, determine guilt, prove authenticity, assign priority, or take enforcement action.

Bhumika/WhatsApp is excluded from the current release and demo. Historical integration code may remain for traceability, but it is not required, advertised, or modified. A later intake adapter can use the canonical complaint boundary without changing the case or Connect model.

## Why a modular monolith

The current scale needs transactional data ownership and understandable operations more than independent services. One FastAPI deployment and PostgreSQL database keep complaint, evidence, indicator, report, routing, and audit writes consistent. Domain modules remain separate in code so a high-load analysis worker or future intake adapter can be extracted later.

No graph database, vector database, Elasticsearch cluster, or microservice mesh is needed for exact indicator correlation.

## Module ownership

| Module | Owns | Important invariant |
|---|---|---|
| `auth` | users, password verification, JWTs, roles | Protected routes require an authorised officer/admin or internal credential |
| `complaints` | canonical complaint record and compatibility payload | Every complaint has one reference and monotonically increasing version |
| `evidence` | metadata, private bytes, hashes, extracted text | Bytes stay private; source identity is preserved |
| `analysis` | deterministic policy, optional connected extraction, immutable runs | Provider failure never discards the complaint; output is advisory |
| `connect` | indicator extraction, normalization, persistence, related-incident query | Only equal type + normalized value creates a match |
| `reports` | immutable report versions | A new version does not rewrite an earlier snapshot |
| `routing` | human approval/override | An override requires a reason and creates an audit event |
| `tracking` | signed links and allow-listed status projection | Public tracking never exposes narrative, evidence, or internal report data |
| `safety` | rule-based message guidance and keyed identifier directory | A directory match is a lead, never proof of guilt |
| `audit` | append-only activity history | Normal application flows append events rather than rewrite history |

## Canonical data model

```text
users
  └── complaints.reporter_id

complaints
  ├── evidence_items
  ├── case_indicators ── optional source_evidence_id ──> evidence_items
  ├── analysis_runs
  ├── reports
  ├── routing_decisions
  └── audit_events
```

`complaints.case_payload` is a compatibility bridge for the current frontend contract. Searchable or security-relevant data also has relational columns. Binary evidence never enters the JSON payload.

`case_indicators` preserves:

- `indicator_type`
- the submitted/extracted `raw_value`
- a conservative `normalized_value`
- the complaint
- optional source-evidence ID
- extraction source, source label, metadata, and creation time

Indexes on `complaint_id`, `source_evidence_id`, and `(indicator_type, normalized_value)` support provenance and exact cross-case lookup.

## Report flow

1. The reporter supplies a narrative, structured fields, and evidence.
2. Browser-side parsing creates an immediate, disclosed fallback result.
3. If configured and consented, connected analysis adds structured, source-labelled observations.
4. The reporter can inspect and correct the prepared material.
5. The Next.js BFF imports the case into FastAPI without exposing its internal credential.
6. FastAPI stores complaint state, evidence metadata, an analysis run, indicators, and an audit event.
7. Original bytes are streamed to private storage and hashed.
8. A report version and tracking reference support the downstream human workflow.

The frontend browser cache improves demo resilience but is not canonical. A failed backend sync must not be interpreted as a production submission.

## Understand flow

The case page presents information in this order:

1. concise reconstruction
2. chronology with precision and source
3. extracted explicit indicators
4. evidence/source trace
5. conflicts or uncertainty
6. original narrative and evidence ledger
7. factual active signals
8. missing information with a reason
9. current case status

Three layers stay visually distinct:

- original evidence or reporter narrative
- extracted fact
- analysis-assisted observation

A model must not invent evidence IDs or timestamps. Uncertain chronology is labelled approximate or uncertain.

## Connect flow

```text
stored complaint/evidence
  → deterministic candidate extraction
  → conservative normalization
  → case_indicators persistence
  → SQL equality on indicator_type + normalized_value
  → related complaints grouped by exact matches
```

The related-incidents service:

1. loads the current complaint indicators;
2. finds equal normalized indicators on other complaints;
3. excludes the current complaint;
4. groups matches by complaint;
5. lists every exact indicator responsible;
6. deduplicates repeated source rows;
7. preserves current and related source labels/evidence IDs; and
8. orders multiple exact matches before single matches.

Category, date, location, narrative similarity, images, and embeddings are never sufficient to connect two cases. The response and UI always state:

> Shared identifiers indicate a potential connection only and do not establish common ownership, identity, guilt or offender.

## Analysis and evidence boundaries

Connected analysis may extract information, transcribe supported media, organise facts, reconstruct supported chronology, identify missing information, and surface factual signals. It cannot assign priority, determine guilt or authenticity, select a final legal category, file an FIR, or initiate action.

Evidence is untrusted input. Text contained in a document, screenshot, transcript, or message is evidence content—not an application command or model-policy instruction.

The storage adapter supports local private disk for development and S3-compatible storage for deployment. PostgreSQL stores object keys, byte sizes, MIME types, SHA-256 digests, provenance, extracted text, and analysis metadata. Supabase Storage is suitable for the competition demo, but it is not represented as immutable forensic storage.

## Authentication and privacy boundaries

- Officers use an HTTP-only web session whose JWT is validated by FastAPI.
- The BFF uses `INTERNAL_API_KEY`; browser JavaScript never receives it.
- Victim tracking uses a scoped, expiring signed token and an allow-listed response.
- Public intake cannot call officer routes.
- Production rejects known development JWT/internal-key defaults.
- Private evidence URLs and storage keys are never returned through the public tracking projection.

## Deployment

The economical demo deployment runs three containers on one ARM64 EC2 instance:

- Caddy terminates HTTPS and sends normal traffic to the web container;
- `niriksh-web` runs the Next.js web/BFF;
- `niriksh-api` runs FastAPI on the private Compose network.

Only Bhumika's key-protected integration path is routed directly to FastAPI. Supabase provides PostgreSQL and private S3-compatible storage. Root-readable environment files on the host supply database, storage, connected-analysis, and authentication settings; those values do not enter GitHub Actions. GitHub OIDC, ECR, and Systems Manager provide automated deployment without permanent AWS access keys or an inbound SSH port.

Alembic migration `20260906_0005` adds `case_indicators` and its lookup indexes. The API image runs migrations during startup under the deployment convention.

## Known architectural limits

- frontend and backend analysis implementations still overlap;
- browser-local fallback needs a clearer production sync/outbox state;
- long media analysis remains synchronous;
- officer/admin roles are coarse and not jurisdiction scoped;
- object storage lacks immutable retention, malware quarantine, legal hold, and evidentiary export controls;
- exact matching has false-positive risk for recycled/shared identifiers and false-negative risk when extraction misses an identifier;
- indicator access policy, retention, correction, and dispute workflows need formal governance before real government use.
