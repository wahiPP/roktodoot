# Architecture

```mermaid
flowchart TB
  subgraph Presentation["Presentation (Next.js PWA)"]
    R[Requester screens] --- D[Donor screens] --- A[Admin screens]
    M[Live escalation map<br/>Leaflet + WebSocket]
  end
  subgraph Application["Application (FastAPI)"]
    API[REST API<br/>JWT, roles, rate limit, Pydantic]
    WS[WebSocket<br/>snapshot every 1.5 s]
  end
  subgraph Agents["Agent layer"]
    O[Orchestrator<br/>LangGraph]
    I[Intake] --> T[Trust] --> MA[Matching] --> OU[Outreach and Escalation] --> F[Follow-up]
    W[Background worker<br/>wave deadlines, expiry, reminders]
  end
  subgraph Data["Data and integration"]
    DB[(PostgreSQL<br/>requests, donors, events)]
    G[Gemini API]
    S[Supabase Auth<br/>Google]
    N[Email via Resend<br/>SMS mocked]
    OSM[OpenStreetMap tiles]
  end
  Presentation -->|HTTPS| API
  M -->|WSS| WS
  API --> O
  O --> I & T & MA & OU
  W --> OU & F
  I -.language only.-> G
  API --> DB
  WS --> DB
  Agents --> DB
  API -.verify token.-> S
  OU & F --> N
  M --> OSM
```

## Request lifecycle

```mermaid
stateDiagram-v2
  [*] --> PARSED: Intake agent
  PARSED --> REJECTED: trust < 30
  PARSED --> HELD: trust 30 to 59
  PARSED --> WAVE_1: trust >= 60
  HELD --> WAVE_1: admin approves
  HELD --> REJECTED: admin rejects
  WAVE_1 --> WAVE_2: timeout or all declined
  WAVE_2 --> WAVE_3: timeout or all declined
  WAVE_3 --> BANK_FALLBACK: timeout or all declined
  WAVE_1 --> ACCEPTED: donor accepts
  WAVE_2 --> ACCEPTED
  WAVE_3 --> ACCEPTED
  BANK_FALLBACK --> ACCEPTED: late accept
  ACCEPTED --> FULFILLED: requester confirms
  BANK_FALLBACK --> EXPIRED: 24 h
  PARSED --> CANCELLED
  WAVE_1 --> CANCELLED
  ACCEPTED --> CANCELLED
```

A wave with no new eligible donors is skipped straight away. Donors from earlier waves can still accept while the request is open.

## Key design decisions

- **The LLM only handles language.** Eligibility, ranking and escalation are rules in `backend/app/rules.json`. That makes every decision reproducible in tests and explainable in the audit log.
- **State lives in the database.** Wave deadlines are columns, the worker polls for due deadlines, and the WebSocket re-reads the database. A restart loses nothing, and more than one server process can run.
- **One donor wins.** Accepting uses a conditional `UPDATE … WHERE status IN (searching)`, so two simultaneous accepts cannot both succeed.
- **Privacy by construction.** The map payload is built from a separate function that only includes a random label, rounded coordinates and status. Contact details appear only in `request_view` and only after acceptance.
