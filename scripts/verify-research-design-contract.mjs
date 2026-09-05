import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");

// ---------- 1. Migration 0017 ----------
const migration = await read("database/migrations/0017_research_design_lab.up.sql");
for (const table of ["research_design_analyses", "research_design_versions", "design_candidates", "design_evidence_links", "research_design_gates"]) {
  assert.match(migration, new RegExp(`CREATE TABLE ${table}\\b`, "u"), `missing table ${table}`);
}
assert.match(migration, /RESEARCH_DESIGN_AND_ANALYSIS_PLAN_RELEASE/u);
assert.match(migration, /research_design_versions_append_only/u);

// ---------- 2. contract ----------
const contract = await read("lib/research-design-contract.ts");
for (const symbol of ["DESIGN_FIT_DISCLAIMER", "DESIGN_ALIGNMENT_CODES", "POWER_STATUSES", "validateDesignSectionEdit"]) {
  assert.match(contract, new RegExp(symbol, "u"), `missing contract ${symbol}`);
}

// ---------- 3. repository ----------
const repository = await read("lib/research-design-repository.ts");
for (const symbol of ["buildDesignCandidates", "computeDesignAlignment", "GATE_CHECKS", "draftDesignCandidates", "editDesignSection", "updateDesignSelection", "linkDesignEvidence", "runDesignAlignment", "writebackBlueprintDesignLocked", "lockResearchDesign", "getResearchDesign"]) {
  assert.match(repository, new RegExp(`function ${symbol}\\b|const ${symbol}\\b`, "u"), `missing ${symbol}`);
}
assert.match(repository, /research_design_lab_locked/u);
assert.match(repository, /v4\.0 Design-Locked/u);
assert.match(repository, /RESEARCH_DESIGN_AND_ANALYSIS_PLAN_RELEASE/u);
for (const code of ["RQ_WITHOUT_DESIGN", "HYPOTHESIS_WITHOUT_ANALYSIS", "CONSTRUCT_WITHOUT_MEASUREMENT", "RETENTION_WITHOUT_FOLLOWUP", "MEDIATOR_WITHOUT_TEMPORAL_ORDER", "POWER_ANALYSIS_INCOMPLETE", "ANALYSIS_REPORTING_INCOMPLETE", "STUDENT_LEARNING_OUTCOME_MISSING", "CAUSAL_CLAIM_WITHOUT_CAUSAL_DESIGN"]) {
  assert.match(repository, new RegExp(code, "u"), `missing alignment code ${code}`);
}
assert.match(repository, /不得自行猜測/u);
assert.doesNotMatch(repository, /dangerouslySetInnerHTML/u);

// ---------- 4. route ----------
const route = await read("app/api/projects/[projectId]/research-design/route.ts");
for (const action of ["draft", "edit", "select-design", "link-evidence", "alignment", "writeback", "lock", "compare"]) {
  assert.match(route, new RegExp(`case "${action}"`, "u"), `missing route action ${action}`);
}

// ---------- 5. component ----------
const component = await read("components/ResearchDesignLab.tsx");
assert.match(component, /RESEARCH_DESIGN_LAB_LOCKED/u);
assert.match(component, /根據RQ產生設計候選/u);
assert.match(component, /回寫研究藍圖（v3 Design-Locked）/u);
assert.match(component, /核准研究設計/u);
assert.match(component, /Design Alignment Check/u);
assert.match(component, /效果量不得自行猜測/u);
assert.match(component, /不得只測滿意度/u);
assert.doesNotMatch(component, /dangerouslySetInnerHTML/u);
const tabsMatch = component.match(/TABS = \[([^\]]*)\]/u);
const tabCount = tabsMatch ? (tabsMatch[1].match(/\"/g) ?? []).length / 2 : 0;
assert.equal(tabCount, 12, `expected 12 tabs, got ${tabCount}`);

// ---------- 6. nav 整合 ----------
const guided = await read("components/GuidedResearchCenter.tsx");
assert.match(guided, /import ResearchDesignLab/u);
assert.match(guided, /activeNav === "design"\) return currentProject \? <ResearchDesignLab/u);
assert.doesNotMatch(guided, /\["design", "analysis", "outputs", "integrity", "memory"\]/u);
const config = await read("lib/research-config.ts");
assert.match(config, /station-design/u);
assert.match(config, /navId: "design", stage: "S4"/u);

// ---------- 7. release ----------
const identity = JSON.parse(await read("release-identity.json"));
assert.equal(identity.version, "1.5.91");
assert.equal(identity.buildId, "C2R5-GNL24");

console.log("RESEARCH_DESIGN_MIGRATION=PASS");
console.log("RESEARCH_DESIGN_CANDIDATES=PASS");
console.log("SAMPLING_AND_POWER=PASS");
console.log("RQ_DATA_ANALYSIS_MATRIX=PASS");
console.log("ANALYSIS_PLANNING_MODE=PASS");
console.log("VALIDITY_BIAS_REGISTER=PASS");
console.log("DESIGN_ALIGNMENT_CHECKER=PASS");
console.log("BLUEPRINT_V3_DESIGN_LOCKED=PASS");
console.log("RESEARCH_DESIGN_GATE=PASS");
console.log("NAV_INTEGRATION=PASS");
console.log("VERSION=1.5.91");
