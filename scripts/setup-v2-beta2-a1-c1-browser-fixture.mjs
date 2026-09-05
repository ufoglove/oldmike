import assert from "node:assert/strict";

import { hashPassword } from "better-auth/crypto";
import { Pool } from "pg";

import { V2_BETA2_CONTRACT_VERSION, createV2Beta2Source } from "../lib/v2-beta2/contracts.ts";
import { createV2Beta2Coordinator } from "../lib/v2-beta2/coordinator.ts";
import { DeterministicFakeV2Beta2Provider } from "../lib/v2-beta2/fake-provider.ts";
import { PostgresV2Beta2Repository } from "../lib/v2-beta2/repository.ts";

const ownerUrl = process.env.DATABASE_URL;
const users = [
  { id: "beta2-user-01", name: "Beta2 Active User", email: process.env.BETA2_E2E_ACTIVE_EMAIL, password: process.env.BETA2_E2E_ACTIVE_PASSWORD, status: "ACTIVE", mustChangePassword: false },
  { id: "beta2-user-disabled", name: "Beta2 Disabled User", email: process.env.BETA2_E2E_DISABLED_EMAIL, password: process.env.BETA2_E2E_DISABLED_PASSWORD, status: "DISABLED", mustChangePassword: false },
  { id: "beta2-user-password-change", name: "Beta2 Password Change User", email: process.env.BETA2_E2E_CHANGE_EMAIL, password: process.env.BETA2_E2E_CHANGE_PASSWORD, status: "PASSWORD_CHANGE_REQUIRED", mustChangePassword: true },
];

if (!ownerUrl || process.env.INTEGRATION_TEST_MODE !== "1" || process.env.TEST_FIXTURE !== "1" || users.some((user) => !user.email || !user.password)) process.exit(2);
const parsed = new URL(ownerUrl);
assert.ok(["127.0.0.1", "localhost", "::1"].includes(parsed.hostname));
assert.equal(parsed.username, "postgres");
assert.equal(parsed.password, "");
assert.ok(parsed.pathname.slice(1).startsWith("old_mike_beta2_disposable_"));
assert.equal(parsed.searchParams.get("application_name"), "old_mike_beta2_disposable");

const pool = new Pool({ connectionString: ownerUrl, max: 1 });
try {
  const hashes = await Promise.all(users.map((user) => hashPassword(user.password)));
  await pool.query("BEGIN");
  for (const [index, user] of users.entries()) {
    await pool.query(`INSERT INTO "user"(id,name,email,"emailVerified") VALUES ($1,$2,$3,true)`, [user.id, user.name, user.email]);
    await pool.query(`INSERT INTO account(id,"accountId","providerId","userId",password) VALUES ($1,$2,'credential',$2,$3)`, [`beta2-account-${index + 1}`, user.id, hashes[index]]);
    await pool.query(`INSERT INTO account_provisioning_state
      (user_id,status,must_change_password,temporary_password_expires_at,password_version,password_changed_at)
      VALUES ($1,$2,$3,CASE WHEN $3 THEN clock_timestamp()+interval '1 day' ELSE NULL END,1,CASE WHEN $3 THEN NULL ELSE clock_timestamp() END)`, [user.id, user.status, user.mustChangePassword]);
  }
  await pool.query(`INSERT INTO workspaces(id,name,owner_user_id) VALUES
    ('beta2-workspace-01','Beta2 Local Workspace','beta2-user-01'),
    ('beta2-workspace-other','Beta2 Other Workspace','beta2-user-disabled')`);
  await pool.query(`INSERT INTO workspace_members(workspace_id,user_id,role) VALUES
    ('beta2-workspace-01','beta2-user-01','owner'),
    ('beta2-workspace-01','beta2-user-disabled','member'),
    ('beta2-workspace-01','beta2-user-password-change','member'),
    ('beta2-workspace-other','beta2-user-disabled','owner')`);
  await pool.query(`INSERT INTO projects(project_id,workspace_id,created_by,title,status,legacy,storage_backend) VALUES
    ('beta2-project-01','beta2-workspace-01','beta2-user-01','Beta2 Durable Project','ACTIVE',false,'POSTGRES_INDEX_PENDING_SAFE_STORAGE'),
    ('beta2-project-rejected','beta2-workspace-01','beta2-user-01','Beta2 Rejected Project','ACTIVE',false,'POSTGRES_INDEX_PENDING_SAFE_STORAGE'),
    ('beta2-project-pending','beta2-workspace-01','beta2-user-01','Beta2 Pending Project','ACTIVE',false,'POSTGRES_INDEX_PENDING_SAFE_STORAGE'),
    ('beta2-project-inactive','beta2-workspace-01','beta2-user-01','Beta2 Inactive Project','LEGACY_UNCLAIMED',true,'POSTGRES_INDEX_PENDING_SAFE_STORAGE'),
    ('beta2-project-other','beta2-workspace-other','beta2-user-disabled','Beta2 Cross Tenant Project','ACTIVE',false,'POSTGRES_INDEX_PENDING_SAFE_STORAGE')`);
  await pool.query("COMMIT");
  const restricted = new Pool({ connectionString: process.env.BETA2_DISPOSABLE_DATABASE_URL, max: 2 });
  try {
    const repository = new PostgresV2Beta2Repository(restricted);
    const provider = new DeterministicFakeV2Beta2Provider();
    provider.setNextOutcome("TERMINAL_REJECTED");
    const coordinator = createV2Beta2Coordinator({ repository, provider });
    const context = { workspaceId: "beta2-workspace-01", projectId: "beta2-project-rejected", userId: "beta2-user-01" };
    const head = await repository.readProjectHead(context);
    const request = { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "GENERATE_DURABLE_CORE", projectId: context.projectId, requestId: "beta2-browser-rejected-request-0001", idempotencyKey: "beta2-browser-rejected-key-0001", baseRevision: head.revision, baseContentHash: head.contentHash, source: createV2Beta2Source({ entryMode: "KEYWORD", researchDirection: "明確拒絕結果的 durable resume 測試", outputTarget: "SSCI", materials: [] }) };
    const rejected = await coordinator.generate(context, request);
    assert.equal(rejected.head.stageOutcome?.status, "REJECTED");
    assert.equal(rejected.providerSubmissionDelta, 1);
    const pendingProvider = new DeterministicFakeV2Beta2Provider();
    pendingProvider.setNextOutcome("COMPLETION_UNKNOWN");
    const pendingCoordinator = createV2Beta2Coordinator({ repository, provider: pendingProvider });
    const pendingContext = { workspaceId: "beta2-workspace-01", projectId: "beta2-project-pending", userId: "beta2-user-01" };
    const pendingHead = await repository.readProjectHead(pendingContext);
    const pendingRequest = { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "GENERATE_DURABLE_CORE", projectId: pendingContext.projectId, requestId: "beta2-browser-pending-request-0001", idempotencyKey: "beta2-browser-pending-key-0001", baseRevision: pendingHead.revision, baseContentHash: pendingHead.contentHash, source: createV2Beta2Source({ entryMode: "KEYWORD", researchDirection: "完成狀態不明時必須永久停止生成重送", outputTarget: "SSCI", materials: [] }) };
    const pending = await pendingCoordinator.generate(pendingContext, pendingRequest);
    assert.equal(pending.head.stageOutcome?.status, "RECONCILE_REQUIRED");
    assert.equal(pending.head.snapshot, null);
  } finally {
    await restricted.end();
  }
  console.log(JSON.stringify({ status: "PASS", users: 3, activeProjects: 4, seededRejectedOutcomes: 1, seededPendingOutcomes: 1, credentials: "RUNTIME_ONLY_NOT_EMITTED" }));
} catch (error) {
  await pool.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  for (const user of users) user.password = "";
  await pool.end();
}
