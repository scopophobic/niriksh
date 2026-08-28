# Prototype architecture

```text
Citizen intake (/report)
        │
        ▼
Deterministic analysis contract
  ├─ entity parsing
  ├─ taxonomy classification
  ├─ risk-factor scoring
  ├─ completeness checks
  └─ routing recommendation
        │
        ▼
Structured case + local demo store
        │
        ▼
Officer queue → review → approve / override / request info
                              │
                              ▼
                         Audit event
```

The browser implementation is the primary demo runtime and remains fully functional without external services. The FastAPI service mirrors the structured analysis and decision contracts so the prototype communicates the intended service boundary. Docker Compose supplies the Next.js web app, API, and a PostgreSQL foundation.

Production evolution should move browser state behind authenticated repositories, use immutable object storage for evidence, implement migrations, and introduce a swappable structured-output LLM provider. Deterministic severity, completeness, and routing rules should remain outside the model.
