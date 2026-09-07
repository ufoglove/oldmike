import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 1) Contract file exports the pinned version and rejects malformed bodies.
const contractSource = await readFile(path.join(root, "lib/artifact-request-contract.ts"), "utf8");
assert.match(contractSource, /ARTIFACT_REQUEST_CONTRACT_VERSION = "artifact-request\/1\.0\.0"/);
assert.match(contractSource, /ARTIFACT_REQUEST_MAX_BODY_BYTES = 65_536/);
assert.match(contractSource, /export function isArtifactRequestBody/);
assert.match(contractSource, /export function isAuthorizationValid/);

// 2) Route enforces auth + origin + bounded body and maps failure codes.
const routeSource = await readFile(
  path.join(root, "app/api/projects/[projectId]/artifacts/request/route.ts"),
  "utf8",
);
assert.match(routeSource, /requireAuthenticatedUser/);
assert.match(routeSource, /originAllowed/);
assert.match(routeSource, /readBoundedJson\(request, ARTIFACT_REQUEST_MAX_BODY_BYTES\)/);
assert.match(routeSource, /work_order_not_found/);
assert.match(routeSource, /authorization_revoked/);
assert.match(routeSource, /authorization_expired/);
assert.match(routeSource, /work_order_not_running/);
assert.match(routeSource, /idempotency_conflict/);
assert.match(routeSource, /"Cache-Control": "no-store"/);

// 3) Store checks tenant membership, work-order RUNNING status, and authorization validity.
const storeSource = await readFile(path.join(root, "lib/artifact-request-store.ts"), "utf8");
assert.match(storeSource, /resolveResearchTenant/);
assert.match(storeSource, /RUNNING/);
assert.match(storeSource, /is_revoked/);
assert.match(storeSource, /valid_until/);
assert.match(storeSource, /createHash\("sha256"\)/);

// 4) Migration defines all three tables with idempotency + FK to projects.
const migration = await readFile(path.join(root, "database/migrations/0035_artifact_requests.up.sql"), "utf8");
for (const table of ["adoption_work_orders", "project_work_authorizations", "artifact_requests"]) {
  assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
}
assert.match(migration, /UNIQUE \(workspace_id, idempotency_key\)/);
assert.match(migration, /REFERENCES projects\(workspace_id, project_id\) ON DELETE CASCADE/);

console.log("artifact-request contract: PASS");
