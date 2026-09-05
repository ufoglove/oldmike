# Multi-user Threat Model - v1.4.3

| Threat | Control |
|---|---|
| Unverified account logs in | Better Auth `requireEmailVerification` |
| Reset token replay or stale sessions | Better Auth expiry/single-use verification and session revocation |
| Consent bypass | Controlled registration endpoint; direct Better Auth sign-up HTTP rejected; immutable DB record |
| A reads B project | Server session + membership + composite tenant lookup; generic 404 |
| Artifact joins wrong workspace | Composite `(workspace_id, project_id)` foreign key |
| Multi-instance rate-limit reset | Better Auth database storage and Portal durable table; no process Map |
| Spoofed client IP | No XFF accepted; HMAC identifier/global fallback; no unproven proxy trust |
| Email enumeration | Generic sign-up/reset/resend responses and timing-safe Better Auth path |
| Shared OpenClaw filesystem leak | No user path authority; project write fail-closed; chat 503 until restricted agent/context adapter |
| Prompt/tool escape | Prompts are not control; restricted agent/tool allowlist is a deployment prerequisite |
| Secret/client leak | Server-only modules and built client scan |
| Legacy accidental claim | `LEGACY_UNCLAIMED` row is not auto-associated |

Real PostgreSQL, Resend and restricted-agent evidence remain deployment gates.
