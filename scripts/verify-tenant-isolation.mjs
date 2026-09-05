import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const fixture = { users: [
  { userId: "user-a", workspaceId: "ws-a", verified: true, sessions: ["a-session"] },
  { userId: "user-b", workspaceId: "ws-b", verified: true, sessions: ["b-session"] },
], projects: [
  { projectId: "a-project", workspaceId: "ws-a", ownerUserId: "user-a", title: "A", status: "ACTIVE", legacy: false },
  { projectId: "b-project", workspaceId: "ws-b", ownerUserId: "user-b", title: "B", status: "ACTIVE", legacy: false },
  { projectId: "vr-63bc7bcef3", workspaceId: "legacy", ownerUserId: "legacy", title: "Legacy", status: "LEGACY_UNCLAIMED", legacy: true },
] };
const { canAccessProject, listProjectsForUser, tenantConversationId, workspaceForUser } = await import("../lib/tenant-model.ts");
const a = workspaceForUser(fixture, "user-a"); const b = workspaceForUser(fixture, "user-b"); assert(a && b);
assert.deepEqual(listProjectsForUser(fixture, a).map((project) => project.projectId), ["a-project"]);
assert.deepEqual(listProjectsForUser(fixture, b).map((project) => project.projectId), ["b-project"]);
assert.equal(canAccessProject(fixture, a, "a-project")?.projectId, "a-project");
assert.equal(canAccessProject(fixture, a, "b-project"), null);
assert.equal(canAccessProject(fixture, a, "vr-63bc7bcef3"), null);
assert.equal(canAccessProject(fixture, a, "../b-project"), null);
assert.equal(canAccessProject(fixture, { ...a, workspaceId: "ws-b" }, "b-project"), null);
assert.notEqual(tenantConversationId(a.workspaceId, "a-project"), tenantConversationId(b.workspaceId, "b-project"));

const projectRoute = await readFile(new URL("../app/api/projects/route.ts", import.meta.url), "utf8");
const itemRoute = await readFile(new URL("../app/api/projects/[projectId]/route.ts", import.meta.url), "utf8");
const chatRoute = await readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");
const schema = await readFile(new URL("../database/migrations/0002_old_mike_tenant.up.sql", import.meta.url), "utf8");
for (const source of [projectRoute, itemRoute]) { assert.match(source, /requireAuthenticatedUser/); assert.match(source, /resolveTenantUser/); }
assert.doesNotMatch(projectRoute, /callOpenClaw/); assert.doesNotMatch(itemRoute, /callOpenClaw/);
assert.match(projectRoute, /tenantProjectRepository\.create/); assert.match(chatRoute, /loadAuthorizedProjectTaskContext/); assert.match(chatRoute, /getServerTaskGateway/);
assert.match(schema, /workspace_id/); assert.match(schema, /LEGACY_UNCLAIMED/); assert.doesNotMatch(schema, /MEMORY\.md/);
assert.match(schema, /workspaces_owner_idx/); assert.match(schema, /storage_backend/); assert.match(schema, /projects_workspace_project_unique/);
assert.match(schema, /FOREIGN KEY \(workspace_id, project_id\)/); assert.match(schema, /REFERENCES projects \(workspace_id, project_id\)/);
assert.match(schema, /user_consents/); assert.match(schema, /user_consents_are_immutable/);
console.log("tenant isolation: PASS (User A/B fixture boundary, legacy unclaimed, composite artifact FK contract, tenant chat fail-closed)");
