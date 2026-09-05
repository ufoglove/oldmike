# Old Mike Portal v1.4.11 Auth Architecture

Better Auth `1.6.29` is the only password/session implementation. Required
Email verification and one-hour password reset use server-only Resend; reset
revokes prior sessions. Audit metadata contains only HMAC identifiers, message
kind/outcome and a Boolean URL-presence flag.

`REGISTRATION_MODE` accepts exactly `closed`, `invite_only` or `open` and
defaults to `closed`. Invalid values make configuration fail closed. Direct
HTTP `/api/auth/sign-up/email` is rejected; controlled signup uses
`/api/account/register` with exact consent versions.

In `invite_only` mode, an operator creates a 256-bit one-time token outside the
browser. The token is bound to one normalized Email and is delivered in the
URL fragment. PostgreSQL stores HMAC token/email/operator keys only. An atomic
15-minute reservation prevents concurrent use; successful registration writes
immutable consent and consumes the invitation in one transaction.

Better Auth routes and custom account routes use database-backed limits.
`X-Forwarded-For` is intentionally ignored. Missing database, Better Auth or
Resend configuration returns 503. Legacy auth is not a production bypass.
