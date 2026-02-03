# FreeSWITCH Phase 2 Runbook

Purpose
- Provide a concise, operational runbook for provisioning, configuring, testing, and operating FreeSWITCH as the private Media Plane for Phase 2.

Prerequisites
- GCP project and permissions to create VMs, firewall rules, and use Secret Manager.
- DNS entry for FreeSWITCH domain(s) and TLS certificate (Let's Encrypt or managed cert).
- SIP trunk credentials from SignalWire.
- Access to COE service endpoints and service account keys if needed.
- Monitoring (Prometheus/Grafana) and logging (Stackdriver/Cloud Logging) available.

High-level Goals
- Anchor calls from SignalWire to FreeSWITCH.
- Record, mix, and stream audio to AI services securely.
- Emit events for COE and Evidence pipeline.

Checklist (Pre-deploy)
- [ ] Create GCP instance template (e2-standard-2 or equivalent).
- [ ] Prepare disk image with FreeSWITCH packages and required modules (mod_event_socket, mod_sofia, mod_conference, mod_record, mod_valet_parking, mod_rtp).
- [ ] Configure firewall: open ports for SIP (TLS), RTP (UDP range), and internal control (ESL) only to authorized IPs.
- [ ] Store SIP credentials and TLS keys in GCP Secret Manager.
- [ ] Create service account for FreeSWITCH to write recordings to GCS (if using GCS) and to emit metrics.

Deployment Steps

1. Provision infrastructure
   - Create instance VM(s) from template with startup script that ensures FreeSWITCH auto-starts.
   - Use a load balancer (internal) if deploying multiple nodes.

2. Install & harden FreeSWITCH
   - Install FreeSWITCH stable release.
   - Enable and configure `mod_sofia` for SIP TLS (wss / tls), `mod_event_socket` (ESL), `mod_dptools`, `mod_conference`, `mod_record`.
   - Harden SSH and limit access with bastion or VPN.

3. Configure SIP Trunk (SignalWire)
   - Add SignalWire as an external trunk via `sofia` configuration with TLS and authentication using stored credentials.
   - Restrict accepted IP ranges and enforce TLS (sips) where possible.

4. Event Socket Layer (ESL) & COE Integration
   - Configure `mod_event_socket` with a strong password and listen only on internal network interface.
   - Ensure COE can connect to ESL over a private network or VPN.
   - Define control messages for: start-recording, stop-recording, stream-to-ai, inject-audio, and conference control.

5. AI Streaming
   - Implement a streaming bridge that reads RTP or local file and streams to AssemblyAI or Deepgram.
   - Prefer server-side websockets with TLS and service account credentials.

6. Recording & Storage
   - Recordings: store as temporary on-disk with immediate upload to GCS or directly stream to object storage.
   - Naming convention: `org/{organization_id}/recordings/{call_sid}/{recording_id}.wav`.

7. Observability
   - Export metrics: active calls, RTCP packet loss, CPU, memory, recording upload latencies.
   - Configure alerts: node down, high packet loss, recording upload failures.

8. Security
   - Keep FreeSWITCH management interfaces (ESL, CLI) on private networks.
   - Rotate SIP credentials and TLS certs regularly.
   - Use GCP IAM for storage write access.

Smoke Tests (Post-deploy)
- Place a test call through SignalWire → FreeSWITCH → COE and verify:
  - Call anchors on FreeSWITCH
  - Recording created and accessible in GCS/Supabase
  - Transcript produced by AI pipeline
  - Evidence manifest emitted and stored

Rollout Strategy
- Canary: start with one FreeSWITCH node and route a subset (1–5%) of synthetic calls.
- Monitor resource usage and call quality metrics for 24–72 hours.
- Gradually scale to full routing with load-balanced nodes.

Rollback Plan
- Re-route calls back to SignalWire direct streaming (Phase 1 path) via COE routing rules.
- Drain active calls and shut down FreeSWITCH nodes.

Post-deploy Tasks
- Add runbook links to on-call playbook and incident response docs.
- Schedule credential rotation and regular health-check audits.

Contact Points
- Infra lead: team-infra@example.com
- COE owner: team-coe@example.com
