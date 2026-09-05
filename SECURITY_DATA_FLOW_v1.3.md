# Security Data Flow - v1.4.3 candidate

Browser -> Better Auth or controlled registration -> server session ->
PostgreSQL membership/consent -> TenantProjectGateway -> future reviewed
OpenClaw context.

Auth secrets, PostgreSQL URL, Resend key and OpenClaw token remain server-only.
Auth endpoints require complete configuration or return 503. Unauthenticated
configured project requests return 401. Registration consent is validated and
stored server-side; direct Better Auth sign-up HTTP is blocked.

Better Auth database rate limiting protects its routes. Custom forgot/resend
routes use the durable HMAC-keyed Portal limiter. No `X-Forwarded-For` value
is accepted because a Zeabur proxy overwrite contract is not proven.

Project APIs reject client ownership claims and verify server membership.
Project creation and shared filesystem writes remain fail-closed. Multi-user
chat is 503 until a restricted OpenClaw agent/context adapter is tested; a
prompt is not a tenant boundary. Tokens, full URLs, passwords and keys are
never logged, and no global `MEMORY.md` write is permitted.
