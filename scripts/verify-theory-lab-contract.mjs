import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");

// ---------- 1. Migration 0016（TEST 01/02/10/11/12 資料層） ----------
const migration = await read("database/migrations/0016_theory_mechanism_lab.up.sql");
for (const table of ["theory_mechanism_analyses", "theory_mechanism_versions", "theory_candidates", "theory_evidence_links", "mechanism_paths", "research_constructs", "formal_hypotheses", "competing_explanations", "boundary_conditions", "conceptual_models", "theory_mechanism_gates"]) {
  assert.match(migration, new RegExp(`CREATE TABLE ${table}\\b`, "u"), `missing table ${table}`);
}
assert.match(migration, /THEORY_AND_MECHANISM_RELEASE/u);
assert.match(migration, /theory_mechanism_versions_append_only/u);
assert.match(migration, /CONCEPTUAL_FRAMEWORK_ONLY/u);
assert.match(migration, /hypothesis_not_required boolean/u);

// ---------- 2. contract ----------
const contract = await read("lib/research-theory-contract.ts");
for (const symbol of ["CONSTRUCT_ROLES", "MECHANISM_STATUSES", "EVIDENCE_LINK_TARGETS", "theoryKeyFromName", "FIT_DISCLAIMER", "FIT_WEIGHTS", "CAUSAL_STRONG_WORDS", "ALIGNMENT_CODES"]) {
  assert.match(contract, new RegExp(symbol, "u"), `missing contract ${symbol}`);
}

// ---------- 3. repository（候選池／對齊檢查／Gate／回寫／OUTDATED） ----------
const repository = await read("lib/research-theory-repository.ts");
for (const symbol of ["buildCandidatePool", "runAlignmentCheck", "GATE_CHECKS", "draftCandidates", "editTheorySection", "updateTheorySelection", "linkTheoryEvidence", "runTheoryAlignment", "writebackBlueprintApproved", "lockTheoryModel", "compareTheoryVersions", "getTheoryMechanism"]) {
  assert.match(repository, new RegExp(`function ${symbol}\\b|const ${symbol}\\b`, "u"), `missing ${symbol}`);
}
assert.match(repository, /theory_lab_locked/u);
assert.match(repository, /OUTDATED/u);
assert.match(repository, /THEORY_NOT_LINKED_TO_GAP/u);
assert.match(repository, /CONSTRUCT_WITHOUT_DEFINITION/u);
assert.match(repository, /HYPOTHESIS_WITHOUT_EVIDENCE/u);
assert.match(repository, /MECHANISM_WITHOUT_THEORY/u);
assert.match(repository, /RQ_WITHOUT_MECHANISM/u);
assert.match(repository, /OUTCOME_NOT_EXPLAINED/u);
assert.match(repository, /EXCESSIVE_THEORY_STACKING/u);
assert.match(repository, /CAUSAL_CLAIM_UNSUPPORTED/u);
assert.match(repository, /DUPLICATED_CONSTRUCTS/u);
assert.match(repository, /v3\.0 Theory & Mechanism Approved/u);
assert.match(repository, /不虛構理論/u);
assert.doesNotMatch(repository, /dangerouslySetInnerHTML/u);

// ---------- 4. API route ----------
const route = await read("app/api/projects/[projectId]/theory-mechanism/route.ts");
for (const action of ["draft", "edit", "select-theory", "link-evidence", "alignment", "writeback", "lock", "compare"]) {
  assert.match(route, new RegExp(`case "${action}"`, "u"), `missing route action ${action}`);
}

// ---------- 5. UI component（TEST 03/05/06/07/08 語意） ----------
const component = await read("components/TheoryMechanismLab.tsx");
assert.match(component, /THEORY_LAB_LOCKED/u);
assert.match(component, /根據Gap建立候選理論/u);
assert.match(component, /補充理論文獻/u);
assert.match(component, /回寫研究藍圖/u);
assert.match(component, /鎖定研究模型/u);
assert.match(component, /conceptual-model-visual/u);
assert.match(component, /Alignment Check/u);
assert.match(component, /設為核心/u);
assert.match(component, /競爭解釋/u);
assert.match(component, /邊界條件/u);
assert.match(component, /PROPOSED（尚未驗證）/u);
assert.match(component, /強因果語句/u);
assert.doesNotMatch(component, /dangerouslySetInnerHTML/u);
// 11 tabs
const tabsMatch = component.match(/TABS = \[([^\]]*)\]/u);
const tabCount = tabsMatch ? (tabsMatch[1].match(/"/g) ?? []).length : 0;
assert.equal(tabCount / 2, 11, `expected 11 tabs, got ${tabCount / 2}`);

// ---------- 6. Nav 整合（TEST 01/02/03） ----------
const guided = await read("components/GuidedResearchCenter.tsx");
assert.match(guided, /import TheoryMechanismLab/u);
assert.match(guided, /activeNav === "theory"\) return currentProject \? <TheoryMechanismLab/u);
assert.match(guided, /theorySummary/u);
const config = await read("lib/research-config.ts");
assert.match(config, /station-theory/u);
assert.match(config, /navId: "theory", stage: "S3"/u);

// ---------- 7. release identity ----------
const identity = JSON.parse(await read("release-identity.json"));
assert.equal(identity.version, "1.5.83");
assert.equal(identity.buildId, "C2R5-GNL16");

console.log("THEORY_LAB_MIGRATION=PASS");
console.log("THEORY_LAB_CONTRACT=PASS");
console.log("THEORY_CANDIDATE_POOL=PASS");
console.log("ALIGNMENT_CHECKER=PASS");
console.log("THEORY_AND_MECHANISM_GATE=PASS");
console.log("BLUEPRINT_V2_APPROVED_WRITEBACK=PASS");
console.log("THEORY_LAB_LOCKED_GATE=PASS");
console.log("NAV_INTEGRATION=PASS");
console.log("VERSION=1.5.83");
