# Resend Setup — Verified Domain, Delivery Test Pending

User evidence confirms `josephbb0105.com` is verified in Resend. The reviewed
server-side sender is:

```text
Old Mike Research OS <no-reply@josephbb0105.com>
```

Keep `RESEND_API_KEY`, `RESEND_FROM_EMAIL` and `BETTER_AUTH_URL` server-side.
The API key must never appear in Codex, source, client bundles, logs, fixtures,
screenshots, manifests or ZIPs.

The mailer sends HTML and plain-text verification/reset messages. It never
logs full URLs, tokens or plaintext recipients. Before deployment, send one
verification and one reset message to a dedicated staging address and inspect
delivery/authentication results without exposing message links.
