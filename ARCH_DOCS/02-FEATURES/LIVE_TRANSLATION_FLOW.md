# Live Translation System Flow
**Architecture: Dual Pipeline Strategy**

This document outlines the system architecture for the "Live Translation" feature. Per the `MASTER_ARCHITECTURE`, the system uses a **Dual Pipeline** approach to satisfy two distinct requirements: **Low-Latency Live Interaction** (Voice) and **High-Fidelity Evidence Records** (Text/Audit).

## 1. High-Level Concept

The system splits the call into two parallel workflows:

| Pipeline | **Live Agent (The "Chatbot")** | **Evidence Engine (The "Record")** |
| :--- | :--- | :--- |
| **Purpose** | Facilitate conversation in real-time. | Create a legally defensible permanent record. |
| **Technology** | SignalWire AI Agent (SWML) | AssemblyAI (Transcription) + OpenAI (Translation) |
| **Latency** | < 2 Seconds (Conversational) | Post-Call (Async) |
| **Output** | Ephemeral Voice Audio | Database Rows, PDF Artifacts, Email |
| **Storage** | None (Vanishes on hangup) | Immutable `ai_runs` and `recordings` tables |

---

## 2. Detailed System Flow

```mermaid
sequenceDiagram
    participant User as End User (WebRTC)
    participant API as Call Handler API
    participant DB as Supabase DB
    participant SW as SignalWire (Telephony)
    participant Agent as SignalWire AI Agent
    participant AAI as AssemblyAI
    participant OAI as OpenAI
    participant Email as Resend

    Note over User, Agent: PHASE 1: LIVE INTERACTION (Ephemeral)

    User->>API: POST /api/voice/call (live_translate=true)
    API->>DB: Check Plan (Business+) & Config
    API->>SW: Initiate Call with "Record=true"
    SW->>API: Fetch Call Instructions (LaML/SWML)
    API->>SW: Return Redirect -> /api/voice/swml/translation
    SW->>Agent: LOAD AI AGENT (Source: en, Target: es)
    
    par Live Call Actions
        User->>Agent: Speaks English
        Agent->>User: Speaks Spanish (translated)
        Agent->>User: Speaks English (echo)
        Note right of Agent: This happens <2s latency. No record kept.
    and Background Recording
        SW->>SW: Records entire audio stream (Master Copy)
    end

    User->>SW: Hangup
    Note over User, Email: PHASE 2: EVIDENCE CHAIN (Persistent)

    SW->>API: Webhook (Call Ended)
    API->>AAI: Send Audio -> Request Transcription
    
    loop Async Processing
        AAI->>AAI: Transcribe Audio
    end

    AAI->>API: Webhook (Transcription Complete)
    API->>DB: Update `recordings` with Transcript JSON
    
    API->>OAI: Send Transcript -> Request Translation (gpt-3.5)
    OAI->>API: Return Translated Text (es)
    API->>DB: Insert into `ai_runs` (status: completed)

    API->>Email: Generate PDF Artifacts & Send
    Email->>User: Delivers "Call Artifacts" Email
```

## 3. Component Breakdown

### A. The "Chatbot" (Session Layer)
- **File:** `app/api/voice/swml/translation/route.ts`
- **Config:** `lib/signalwire/ai-agent-config.ts`
- **Function:** It instructs the SignalWire cloud to attach an AI Agent ("bot") to the phone line.
- **Why it's needed:** A normal phone call cannot "think" or "translate". You need an active bot bridging the two parties.
- **Constraint:** It does not save its own output. If the system crashes, this data is gone.

### B. The "Scribe" (Data Layer)
- **File:** `app/api/webhooks/assemblyai/route.ts`
- **Service:** `app/services/translation.ts`
- **Function:**
    1.  **AssemblyAI** listens to the *recording* (not the live call) and writes down every word.
    2.  **OpenAI** reads that written transcript and translates it definitively.
- **Why it's needed:** We need a perfect, searchable, and printable document for legal/business records ("Evidence").
- **Reliability:** Decoupled from the live call. Even if the live bot stutters, the recording is safe, and the transcript can be regenerated.

## 4. Configuration Flags

To enable this flow, the following settings in `voice_configs` must be true:

1.  `record` = `true` (Enables the Evidence Engine)
2.  `transcribe` = `true` (Enables AssemblyAI)
3.  `live_translate` = `true` (Enables the Chatbot/SWML)
4.  `translate_from` / `translate_to` (Defines languages)
5.  **Plan Tier:** Must be `Business` or `Enterprise`.

## 5. Failure Modes

-   **Quota Exceeded:** If OpenAI fails (Phase 2), the user still heard the translation during the call (Phase 1), but the email (Phase 2) will say "Translation Failed" and the PDF will be missing the Spanish text.
-   **Webhook Failures:** If AssemblyAI fails to callback, the "Evidence" chain breaks, but the live call was unaffected.
