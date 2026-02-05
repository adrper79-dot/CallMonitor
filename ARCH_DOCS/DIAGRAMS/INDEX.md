# Architecture Diagrams Index

Central hub for Mermaid diagrams. Clickable previews + source links.

## 1. Complete System Architecture
**[COMPLETE_SYSTEM_ARCHITECTURE.md](COMPLETE_SYSTEM_ARCHITECTURE.md)** - Comprehensive overview of entire Wordis Bond system

```mermaid
graph TB
    Browser[Web Browser] --> Pages[Cloudflare Pages]
    Pages --> Workers[Cloudflare Workers]
    Workers --> Neon[Neon Postgres]
    Workers --> R2[Cloudflare R2]
    Workers --> Telnyx[Telnyx Voice]
    Workers --> AssemblyAI[AssemblyAI AI]
    Workers --> ElevenLabs[ElevenLabs TTS]
    style Browser fill:#e1f5fe
    style Workers fill:#e8f5e8
    style Neon fill:#fff3e0
```

## 2. Component Architecture
**[MASTER_ARCHITECTURE.md](MASTER_ARCHITECTURE.md)** - Hybrid Cloudflare architecture with data flows

```mermaid
flowchart TB
    Browser[Browser Client] --> Pages[Cloudflare Pages]
    Browser --> Workers[Cloudflare Workers]
    Workers --> Neon[Neon Postgres]
    Workers --> R2[Cloudflare R2]
    Workers --> Telnyx[Telnyx]
    Workers --> AssemblyAI[AssemblyAI]
    Workers --> ElevenLabs[ElevenLabs]
    style Browser fill:#e1f5fe
    style Workers fill:#e8f5e8
```

## 3. Database Schema Relationships
**[DATABASE_SCHEMA_REGISTRY.md](DATABASE_SCHEMA_REGISTRY.md)** - Entity Relationship Diagram for core tables

```mermaid
erDiagram
    users ||--o{ sessions : "1:N"
    users ||--o{ org_members : "1:N"
    organizations ||--o{ calls : "1:N"
    calls ||--o{ recordings : "1:N"
    calls ||--o{ ai_summaries : "1:N"
```

## 4. Call Flow Diagrams
**[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Single call and live translation flows

```mermaid
flowchart TD
    A[User visits /] --> B[Enter phone number]
    B --> C[Click Start Call]
    C --> D[UI calls /api/calls/start]
    D --> E[Workers API validates auth]
    E --> F[Workers calls Telnyx API]
```

## 5. High-Level System Flows
**[FINAL_STACK.md](FINAL_STACK.md)** - Outbound calls, inbound calls, and compliance flows

```mermaid
flowchart LR
    UI[Next.js UI] --> Workers1[Cloudflare Workers]
    Workers1 --> Telnyx1[Telnyx API]
    Telnyx1 --> AssemblyAI[AssemblyAI]
    AssemblyAI --> ElevenLabs[ElevenLabs]
    ElevenLabs --> Telnyx2[Telnyx]
```

## 6. Codebase Structure
**[SYSTEM_MAP.md](SYSTEM_MAP.md)** - File organization and dependencies

```mermaid
graph TB
    UI[Frontend React] --> APIClient[API Client]
    Components[Components] --> Hooks[Custom Hooks]
    APIClient --> WorkersAPI[Workers API]
    WorkersAPI --> Auth[Authentication]
    WorkersAPI --> DB[Database Layer]
```

## 7. Split Deployment Architecture
**[SPLIT_DEPLOYMENT_MERMAID.md](SPLIT_DEPLOYMENT_MERMAID.md)** - OpenNext deployment strategy

```mermaid
flowchart LR
  subgraph FrontendHost["Cloudflare Pages (OpenNext)"]
    NextJS[Next.js app]
    NextJS --> Browser[Browser clients]
  end
  subgraph BackendHost["Node Backend"]
    Backend[Express / NodeJS service]
  end
  subgraph Infra["Cloud / Platform"]
    Neon[Neon Postgres]
    R2[R2 object storage]
  end
```