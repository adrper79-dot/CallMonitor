## Media Plane Diagrams

Below are two diagrams (Mermaid) showing Phase 1 (Pre-FreeSWITCH) and Phase 2 (FreeSWITCH integration).

### Phase 1 — Pre-FreeSWITCH

```mermaid
flowchart LR
  UI[CPID (UI / Control Panel)] --> COE[COE - Call Orchestration Engine]
  COE --> SignalWire[SignalWire / PSTN]
  COE --> AI[AI Services\n(AssemblyAI / Deepgram / OpenAI)]
  AI --> COE
  SignalWire --> Customer[Customer Endpoint / PSTN]
  COE --> DB[Supabase / Recordings]
  COE --> Evidence[Evidence Manifests]
  classDef ext fill:#f9f,stroke:#333,stroke-width:1px;
  class SignalWire,AI ext;
```

### Phase 2 — FreeSWITCH Integration

```mermaid
flowchart LR
  UI[CPID (UI / Control Panel)] --> COE[COE - Call Orchestration Engine]
  COE --> SignalWire[SignalWire]
  SignalWire --> FreeSWITCH[FreeSWITCH (Media Plane)]
  FreeSWITCH --> AI[AI Services\n(AssemblyAI / Deepgram / OpenAI)]
  FreeSWITCH --> COE
  FreeSWITCH --> Recordings[Recordings -> GCS / Supabase]
  COE --> Evidence[Evidence Manifests]
  classDef infra fill:#eef,stroke:#333,stroke-width:1px;
  class FreeSWITCH,Recordings infra;
```

Notes:
- These diagrams are lightweight and intended for inclusion in runbooks and PRs. Save as PNG/SVG from any Mermaid renderer for presentations.
