# Split Deployment - Architecture Diagram (Mermaid)

The diagram below describes the high-level architecture: Cloudflare Pages frontend (OpenNext) + Node backend (services/backend), DB, storage, CI, and external integrations.

```mermaid
flowchart LR
  subgraph FrontendHost["Cloudflare Pages (OpenNext)"]
    direction TB
    NextJS[Next.js app (app/)]
    NextJS -->|Static/SSR assets| Browser[Browser clients]
    Browser -->|API calls (client)| NextAPI[app/api/* (Edge or Node runtimes)]
    NextJS -.dev proxy.-> DevProxy[dev: NEXT_PUBLIC_BACKEND_URL rewrite]
  end

  subgraph EdgeLayer["Edge Runtime (Cloudflare/OpenNext)"]
    direction TB
    NextAPIEdge[Lightweight Edge routes / static assets]
  end

  subgraph BackendHost["Node Backend (services/backend)"]
    direction TB
    Backend[Express / NodeJS service]
    Backend -->|NextAuth| AuthJS[Auth.js (+ PG adapter)]
    Backend -->|Webhooks| Webhooks[AssemblyAI, SignalWire, Stripe handlers]
    Backend -->|Audio/TTS endpoints| Audio[Audio upload / TTS / presign]
    Backend -->|Integrations| CRM[HubSpot / Salesforce stubs]
  end

  subgraph Infra["Cloud / Platform"]
    direction LR
    Neon[Neon Postgres (NEON_PG_CONN)]
    R2[R2 (object storage)]
    GHCR[GHCR (image registry)]
    Render[Render / Fly (deployment targets)]
    CloudPages[Cloudflare Pages]
  end

  subgraph CI["CI / Dev tooling"]
    direction TB
    GHActions[GitHub Actions]
    OpenNextBuild[OpenNext build (npx open-next build)]
    DockerBuild[Docker build + push scripts/scripts/deploy_backend.sh]
  end

  %% Connections
  NextAPIEdge -->|calls requiring server-only| Backend
  NextAPI -->|some routes converted -> node runtime| Backend
  Backend --> Neon
  Backend --> R2
  Backend -->|REST| Eleven[ElevenLabs REST API]
  Backend -->|REST/HTTP| AssemblyAI
  Backend -->|SignalWire webhooks| SignalWire
  Backend -->|Stripe webhooks| Stripe
  GHActions --> OpenNextBuild --> CloudPages
  GHActions --> DockerBuild --> GHCR --> Render
  DevProxy --> Backend
  Browser --> CloudPages

  style FrontendHost fill:#f8f9fb,stroke:#444,stroke-width:1px
  style EdgeLayer fill:#eef6ff,stroke:#2b6cb0,stroke-width:1px
  style BackendHost fill:#fff7ed,stroke:#c05621,stroke-width:1px
  style Infra fill:#eefbf0,stroke:#2f855a,stroke-width:1px
  style CI fill:#f7f0ff,stroke:#6b46c1,stroke-width:1px
```
