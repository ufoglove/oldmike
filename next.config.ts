import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import releaseContract from "./release-identity.json";

const portalRoot = path.dirname(fileURLToPath(import.meta.url));
const releaseContractHash = createHash("sha256").update(JSON.stringify({
  contractVersion: releaseContract.contractVersion,
  service: releaseContract.service,
  version: releaseContract.version,
  buildId: releaseContract.buildId,
  researchWorkflowContractVersion: releaseContract.researchWorkflowContractVersion,
  postgresSchema: releaseContract.postgresSchema,
}), "utf8").digest("hex");

const scriptSources = ["'self'", "'unsafe-inline'"];
if (process.env.NODE_ENV !== "production") scriptSources.push("'unsafe-eval'");
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src ${scriptSources.join(" ")}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-src 'none'",
  "media-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

const nextConfig: NextConfig = {
  deploymentId: releaseContractHash,
  output: "standalone",
  outputFileTracingRoot: portalRoot,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
        ],
      },
    ];
  },
};

export default nextConfig;
