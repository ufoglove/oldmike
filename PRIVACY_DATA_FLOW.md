# Privacy and Data Flow

Browser → same-origin Portal auth endpoint → Better Auth session/database. The browser never receives database URLs, Resend keys, Better Auth secrets or OpenClaw tokens.

For project APIs: session → user ID from server session → workspace membership → Postgres project index → only then, when a safe gateway is approved, minimal project context to OpenClaw. User-supplied paths and identity fields are not forwarded as authorization context.

Auth email content is sent server-side through Resend. Verification and reset URLs are not logged. Research conversations are project-scoped; the candidate forbids global memory writes and cross-workspace context mixing.
