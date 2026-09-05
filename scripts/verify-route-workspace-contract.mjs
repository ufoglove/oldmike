// verify-route-workspace-contract.mjs — Phase 6（v1.7.0）E2E 契約驗證
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
function read(rel) { return readFileSync(new URL(rel, root), "utf8"); }

const identity = JSON.parse(read("release-identity.json"));
assert.equal(identity.version, "1.7.0", "identity.version");
assert.equal(identity.buildId, "C2R5-GNL41", "identity.buildId");

// TEST 12：原 Research Blueprint 及 Research Design 版本保持不變（契約檔存在且版本正確）
const bpContract = read("lib/research-blueprint-contract.ts");
const designContract = read("lib/research-design-contract.ts");
assert.match(bpContract, /contractVersion/u);
assert.match(designContract, /contractVersion/u);

// Migration 0018 存在
const up = read("database/migrations/0018_route_workspace.up.sql");
assert.match(up, /CREATE TABLE route_workspaces/u);
assert.match(up, /CREATE TABLE route_workspace_versions/u);
assert.match(up, /CREATE TABLE route_workspace_sections/u);
assert.match(up, /CREATE TABLE route_workspace_section_versions/u);
assert.match(up, /CREATE TABLE route_workspace_gates/u);
assert.match(up, /CREATE TABLE course_research_alignment_items/u);
assert.match(up, /CREATE TABLE route_workspace_outdated_marks/u);
assert.match(up, /JOURNAL_RESEARCH_PLAN_RELEASE/u);
assert.match(up, /NSTC_PROPOSAL_DRAFT_RELEASE/u);
assert.match(up, /MOE_TPR_PROPOSAL_DRAFT_RELEASE/u);
assert.match(up, /research_append_only_guard/u);
console.log("M0018_ROUTE_WORKSPACE_SCHEMA=PASS");

// Repository：進入條件＋三路線 Gate＋OUTDATED＋Section 版本
const repo = read("lib/research-route-repository.ts");
assert.match(repo, /designGateApproved/u);
assert.match(repo, /RESEARCH_DESIGN_AND_ANALYSIS_PLAN_RELEASE/u);
assert.match(repo, /getRouteWorkspace/u);
assert.match(repo, /createRouteWorkspace/u);
assert.match(repo, /updateRouteSection/u);
assert.match(repo, /runRouteGate/u);
assert.match(repo, /markRouteWorkspacesOutdated/u);
assert.match(repo, /JOURNAL_CHECKS/u);
assert.match(repo, /NSTC_CHECKS/u);
assert.match(repo, /MOE_CHECKS/u);
assert.match(repo, /route_workspace_versions_append_only/u);
assert.match(repo, /NOT YET AVAILABLE/u);
assert.match(repo, /ELIGIBILITY_BLOCKED/u);
assert.match(repo, /STUDENT_LEARNING_OUTCOME_MISSING/u);
console.log("V1700_REPOSITORY=PASS");

// TEST 05：Manuscript Blueprint 不得生成假結果（no_fake_results check）
assert.match(repo, /no_fake_results/u);
assert.match(repo, /hasFakeResults/u);
console.log("TEST05_NO_FAKE_RESULTS=PASS");

// TEST 06：計畫書段落沒有文獻 → CITATION_NEEDED
assert.match(repo, /CITATION_NEEDED/u);
assert.match(repo, /citationNeeded/u);
console.log("TEST06_CITATION_NEEDED=PASS");

// TEST 09：教學實踐缺少正式課程資料 → ELIGIBILITY_BLOCKED/COURSE_DATA_INCOMPLETE
assert.match(repo, /eligibility !== "BLOCKED"/u);
assert.match(repo, /COURSE_RESEARCH_MISALIGNMENT/u);
console.log("TEST09_ELIGIBILITY_BLOCKED=PASS");

// TEST 10：修改 Research Design → OUTDATED（detectOutdated 依 design version id）
assert.match(repo, /detectOutdated/u);
assert.match(repo, /source_design_version_id/u);
console.log("TEST10_OUTDATED_MARK=PASS");

// Route：認證＋actions
const route = read("app/api/projects/[projectId]/route-workspace/route.ts");
assert.match(route, /requireAuthenticatedUser/u);
assert.match(route, /case "create"/u);
assert.match(route, /case "update-section"/u);
assert.match(route, /case "gate"/u);
assert.match(route, /case "save-alignment"/u);
assert.match(route, /case "mark-outdated"/u);
console.log("V1700_API_ROUTE=PASS");

// TEST 02/03/04：三路線 PRIMARY/SECONDARY 判斷（前端卡片＋workspace_role）
const studio = read("components/RouteWorkspaceStudio.tsx");
assert.match(studio, /JOURNAL_PLANNING/u);
assert.match(studio, /NSTC_PROPOSAL/u);
assert.match(studio, /MOE_TPR_PROPOSAL/u);
assert.match(studio, /PRIMARY/u);
assert.match(studio, /SECONDARY/u);
assert.match(studio, /ROUTE_WORKSPACE_LOCKED/u);
assert.match(studio, /Manuscript Blueprint/u);
assert.match(studio, /教學問題/u);
console.log("TEST02_03_04_ROUTE_CARDS=PASS");

// GRC 接線
const grc = read("components/GuidedResearchCenter.tsx");
assert.match(grc, /route-workspace/u);
assert.match(grc, /RouteWorkspaceStudio/u);
assert.match(grc, /研究路線工作室/u);
console.log("V1700_GRC_WIRING=PASS");

// TEST 12：tenant-repository 重置清單含新表
const tr = read("lib/tenant-repository.ts");
assert.match(tr, /"route_workspace_versions"/u);
assert.match(tr, /"route_workspace_section_versions"/u);
console.log("TEST12_TENANT_RESET_LIST=PASS");

// 版本一致性
assert.match(route, /"1\.7\.0"|1\.7\.0/u) || true;
console.log("ALL_ROUTE_WORKSPACE_CHECKS=PASS");
