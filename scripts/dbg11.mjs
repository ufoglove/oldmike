import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as g from "../lib/research-data-governance-repository.ts";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { Client } = await import("pg");
const client = new Client({ connectionString: process.env.DATABASE_URL });
const q = (sql, values = []) => client.query(sql, values);
const h64 = (s) => Buffer.from(String(s)).toString("hex").padEnd(64, "0").slice(0, 64);
const tenant = { userId: "g11u", workspaceId: "g11w", projectId: "g11p", role: "owner" };
try {
  await client.connect();
  const names = ["0001_better_auth_core.up.sql","0002_old_mike_tenant.up.sql","0003_registration_invites.up.sql","0004_registration_invite_revocation.up.sql","0005_research_workflow_phase2.up.sql","0006_admin_provisioned_accounts.up.sql","0007_topic_lab_frontier_radar.up.sql","0008_research_provenance.up.sql","0009_submission_navigator.up.sql","0010_submission_navigator_phase2.up.sql","0011_submission_navigator_document_type.up.sql","0012_research_project_foundation.up.sql","0013_research_blueprint.up.sql","0014_navigator_drafts.up.sql","0015_gap_novelty_lab.up.sql","0016_theory_mechanism_lab.up.sql","0017_research_design_lab.up.sql","0018_route_workspace.up.sql","0019_zotero_connections_sync_status.up.sql","0020_ethics_compliance_package.up.sql","0021_route_section_provenance.up.sql","0022_instrument_protocol_studio.up.sql","0023_pilot_protocol_validation.up.sql","0024_formal_research_execution.up.sql","0025_data_governance_and_analysis_dataset.up.sql"];
  for (const name of names) await q(await readFile(path.join(root, "database", "migrations", name), "utf8"));
  await q(`INSERT INTO "user" (id,name,email) VALUES ('g11u','U','u@t');
    INSERT INTO workspaces (id,name,owner_user_id) VALUES ('g11w','W','g11u');
    INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ('g11w','g11u','owner');
    INSERT INTO projects (project_id,workspace_id,created_by,title,status,storage_backend) VALUES ('g11p','g11w','g11u','P','ACTIVE','POSTGRES_INDEX_PENDING_SAFE_STORAGE');
    INSERT INTO research_projects (id,workspace_id,project_id,created_by_user_id,project_name,project_type,created_at,updated_at) VALUES ('g11rp','g11w','g11p','g11u','P','JOURNAL_MANUSCRIPT',now(),now());
    INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at,created_at,updated_at) VALUES ('g11hg','g11w','g11p','g11u','RAW_DATA_LOCKED_AND_HANDOFF_READY','raw','x','${h64("l")}','APPROVED','g11u',now(),now(),now());
    INSERT INTO formal_studies (id,workspace_id,project_id,created_by_user_id,status,created_at,updated_at) VALUES ('g11fs','g11w','g11p','g11u','RAW_DATA_LOCKED',now(),now());
    INSERT INTO raw_data_assets (id,workspace_id,project_id,formal_study_id,data_type,data_layer,source,file_name,file_format,checksum,storage_location,status,synthetic,pilot_origin,created_by_user_id,created_at,updated_at) VALUES ('ra1','g11w','g11p','g11fs','QUESTIONNAIRE','RESEARCH_RAW','s','a.csv','csv','sha256:aaa','s','LOCKED',false,false,'g11u',now(),now());`);
  const steps = [
    ["adjudicate", () => g.createAdjudication(tenant, { userId: "g11u", adjudication: { issue: "x", status: "RESOLVED_WITH_FLAG", resolution: "y" } })],
    ["deid", () => g.runDeidentification(tenant, { userId: "g11u", run: { method: "PSEUDO", fieldsAffected: ["a"], status: "APPROVED_FOR_INTERNAL_ANALYSIS" } })],
    ["rule", () => g.saveCleaningRule(tenant, { userId: "g11u", rule: { ruleId: "r1", ruleName: "n", ruleType: "RANGE", status: "ACTIVE" } })],
    ["validate-clean", () => g.validateCleanDataset(tenant, { userId: "g11u", datasetId: "clean_v1", reviewer: "DM" })],
    ["saveMapping", () => g.saveMapping(tenant, { userId: "g11u", mapping: { sourceAssetId: "a", sourceFieldName: "f", canonicalName: "" } })],
  ];
  for (const [name, fn] of steps) { try { const r = await fn(); console.log(name, "OK", JSON.stringify(r).slice(0, 80)); } catch (e) { console.log(name, "ERR", e.message); } }
  await client.end();
} catch (e) { console.log("SETUP ERR", e.message); await client.end().catch(() => undefined); }
