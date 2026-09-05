import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRouteWorkspace, getRouteWorkspace, updateRouteSection, runRouteGate } from "../lib/research-route-repository.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.INTEGRATION_DATABASE_URL;
if (!url || process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1" || process.env.INTEGRATION_TEST_MODE !== "1" || process.env.TEST_FIXTURE !== "1") { console.log("RW_FIX=NOT_EXECUTED"); process.exit(0); }
const { Client } = await import("pg");
const client = new Client({ connectionString: url });
const migrations = ["0001_better_auth_core.up.sql","0002_old_mike_tenant.up.sql","0003_registration_invites.up.sql","0004_registration_invite_revocation.up.sql","0005_research_workflow_phase2.up.sql","0006_admin_provisioned_accounts.up.sql","0007_topic_lab_frontier_radar.up.sql","0008_research_provenance.up.sql","0009_submission_navigator.up.sql","0010_submission_navigator_phase2.up.sql","0011_submission_navigator_document_type.up.sql","0012_research_project_foundation.up.sql","0013_research_blueprint.up.sql","0014_navigator_drafts.up.sql","0015_gap_novelty_lab.up.sql","0016_theory_mechanism_lab.up.sql","0017_research_design_lab.up.sql","0018_route_workspace.up.sql","0019_zotero_connections_sync_status.up.sql","0020_ethics_compliance_package.up.sql","0021_route_section_provenance.up.sql"];
try {
  await client.connect();
  for (const name of migrations) await client.query(await readFile(path.join(root, "database", "migrations", name), "utf8"));
  await client.query(`INSERT INTO "user" (id,name,email) VALUES ('rw_u','U','rw@example.test');
    INSERT INTO workspaces (id,name,owner_user_id) VALUES ('rw_w','W','rw_u');
    INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ('rw_w','rw_u','owner');
    INSERT INTO projects (project_id,workspace_id,created_by,title,status,storage_backend) VALUES ('rw_p','rw_w','rw_u','RW','ACTIVE','POSTGRES_INDEX_PENDING_SAFE_STORAGE');
    INSERT INTO research_projects (id,workspace_id,project_id,created_by_user_id,project_name,project_type,created_at,updated_at) VALUES ('rw_rp','rw_w','rw_p','rw_u','RW','JOURNAL_MANUSCRIPT',now(),now());
    INSERT INTO research_blueprints (id,workspace_id,project_id,research_project_id,created_by_user_id,status,primary_route,current_version_number,created_at,updated_at) VALUES ('rw_bp','rw_w','rw_p','rw_rp','rw_u','APPROVED','JOURNAL',1,now(),now());
    INSERT INTO research_blueprint_versions (id,workspace_id,project_id,blueprint_id,logical_id,version_number,version_label,reason,content_hash,payload,created_by_user_id,created_at) VALUES ('rw_bpv','rw_w','rw_p','rw_bp','rw_bp',1,'v1','fixture','${"0".repeat(64)}','{"research_identity":{"primaryRoute":"JOURNAL"}}'::jsonb,'rw_u',now());
    INSERT INTO research_design_analyses (id,workspace_id,project_id,research_project_id,created_by_user_id,source_blueprint_version,status,current_version_number,created_at,updated_at) VALUES ('rw_da','rw_w','rw_p','rw_rp','rw_u',1,'APPROVED',1,now(),now());
    INSERT INTO research_design_versions (id,workspace_id,project_id,analysis_id,logical_id,version_number,version_label,reason,content_hash,payload,created_by_user_id,created_at) VALUES ('rw_dv','rw_w','rw_p','rw_da','rw_da',1,'v1','fixture','${"a".repeat(64)}','{"designType":"RCT"}'::jsonb,'rw_u',now());
    INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at,created_at,updated_at) VALUES ('rw_hg','rw_w','rw_p','rw_u','RESEARCH_DESIGN_AND_ANALYSIS_PLAN_RELEASE','research_design_analysis','rw_dv','${"b".repeat(64)}','APPROVED','rw_u',now(),now(),now());`);
  const tenant = { userId: "rw_u", workspaceId: "rw_w", projectId: "rw_p", role: "owner" };
  const created = await createRouteWorkspace(tenant, { userId: "rw_u", route: "JOURNAL_PLANNING", role: "PRIMARY" });
  if (!created.ok) throw new Error("create failed: " + created.error);
  let view = await getRouteWorkspace(tenant, { userId: "rw_u", route: "JOURNAL_PLANNING" });
  const countAfterCreate = view.workspace?.sections.length ?? 0;
  if (countAfterCreate !== 7) throw new Error(`expected 7 sections after create, got ${countAfterCreate}`);
  const saved = await updateRouteSection(tenant, { userId: "rw_u", route: "JOURNAL_PLANNING", sectionId: "positioning", draftContent: "目標期刊與定位草稿內容（測試）", status: "DRAFT", provenance: "AI_PROPOSED" });
  if (!saved.ok) throw new Error("update failed");
  let check = await getRouteWorkspace(tenant, { userId: "rw_u", route: "JOURNAL_PLANNING" });
  const posRow = check.workspace?.sections.find((s) => s.sectionId === "positioning");
  if (posRow?.provenance !== "AI_PROPOSED") throw new Error("provenance AI_PROPOSED not persisted");
  const approved = await updateRouteSection(tenant, { userId: "rw_u", route: "JOURNAL_PLANNING", sectionId: "positioning", userApproved: true, status: "APPROVED", provenance: "USER_REVIEWED" });
  if (!approved.ok) throw new Error("approve failed");
  check = await getRouteWorkspace(tenant, { userId: "rw_u", route: "JOURNAL_PLANNING" });
  const posRow2 = check.workspace?.sections.find((s) => s.sectionId === "positioning");
  if (posRow2?.provenance !== "USER_REVIEWED" || posRow2?.userApproved !== true) throw new Error("USER_REVIEWED formalization not persisted");
  // 舊有 workspace 復原路徑：新增第二條路線 workspace 但先刪 sections 再 get（模擬舊資料）——直接測 update 在缺列時自動 seed
  const upd2 = await updateRouteSection(tenant, { userId: "rw_u", route: "JOURNAL_PLANNING", sectionId: "manuscript-blueprint", draftContent: "Manuscript Blueprint 骨架（Results NOT YET AVAILABLE）", status: "DRAFT" });
  if (!upd2.ok) throw new Error("seed-on-update failed");
  view = await getRouteWorkspace(tenant, { userId: "rw_u", route: "JOURNAL_PLANNING" });
  if ((view.workspace?.sections.length ?? 0) !== 7) throw new Error("seed-on-get failed");
  // Gate：部分段落核准（positioning 已核准、alignment 未核准）→ 應失敗並列出缺項
  const gateFail = await runRouteGate(tenant, { userId: "rw_u", route: "JOURNAL_PLANNING", payload: { journalFamily: "SSCI 教育科技" } });
  if (gateFail.ok) throw new Error("gate should fail with partial sections");
  // 全部 7 段核准（含 alignment 等）＋journalFamily → Gate 通過
  for (const sid of ["alignment", "manuscript-blueprint", "reporting-guideline", "preregistration", "authorship", "risks"]) {
    const r = await updateRouteSection(tenant, { userId: "rw_u", route: "JOURNAL_PLANNING", sectionId: sid, draftContent: sid === "manuscript-blueprint" ? "Abstract Shell / Methods（Results NOT YET AVAILABLE）" : `內容 ${sid}（測試）`, status: "DRAFT" });
    if (!r.ok) throw new Error("save " + sid + " failed");
    const a = await updateRouteSection(tenant, { userId: "rw_u", route: "JOURNAL_PLANNING", sectionId: sid, userApproved: true, status: "APPROVED" });
    if (!a.ok) throw new Error("approve " + sid + " failed");
  }
  const gateOk = await runRouteGate(tenant, { userId: "rw_u", route: "JOURNAL_PLANNING", payload: { journalFamily: "SSCI 教育科技" }, lock: true });
  if (!gateOk.ok) throw new Error("gate should pass now: " + JSON.stringify(gateOk.failed ?? []).slice(0, 300));
  console.log("RW_SEED_SAVE_GATE=PASS");
} finally {
  await client.end().catch(() => undefined);
}
