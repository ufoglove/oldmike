import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");

// ---------- 1. repository：Gate 修復指引 + 老麥建議推導 ----------
const repository = await read("lib/research-blueprint-repository.ts");
for (const symbol of [
  "runGateChecks",
  "buildFixGuide",
  "computeGatePreview",
  "GatePreview",
  "tabForSection",
  "forbiddenWordSections",
  "deriveVariablesFromRq",
  "deriveMethodDirection",
  "derivePurposeStatement",
  "deriveContributionPrimary",
  "buildStandardRisks",
]) {
  assert.match(repository, new RegExp(`${symbol}\\b`, "u"), `missing ${symbol}`);
}
// GET view 提供 gatePreview（核准前即可看到失敗清單與指引）
assert.match(repository, /gatePreview/u);
assert.match(repository, /computeGatePreview\(payload, coverage, source, findings\)/u);
// approve 失敗項目附 fix 指引（含來源資料，供推導）
assert.match(repository, /fixFor\(r\.key, payload, coverage, source, findings\)/u);
// 陣列型區塊編輯改為整筆取代（修復「手動編輯空表單」bug）
assert.match(repository, /Array\.isArray\(existingSection\)/u);
assert.match(repository, /_items/u);
// 反虛構：老麥建議必須標示 PROVISIONAL，且不得生成文獻/數據
assert.match(repository, /不會虛構文獻/u);
assert.match(repository, /PROVISIONAL/u);
assert.doesNotMatch(repository, /autoFill[\s\S]{0,120}literatureId/u);

// ---------- 2. component：修復指引面板 + 一鍵填入 + 陣列編輯 ----------
const component = await read("components/ResearchBlueprintStudio.tsx");
assert.match(component, /gatePreview/u);
assert.match(component, /blueprint-gate-preview/u);
assert.match(component, /核准 Gate 檢查/u);
assert.match(component, /修改指引/u);
assert.match(component, /老麥建議填入/u);
assert.match(component, /前往投稿導航 →/u);
assert.match(component, /前往文獻與證據中心/u);
assert.match(component, /TAB_SECTIONS/u);
assert.match(component, /startEditFromTab/u);
assert.match(component, /_items/u);
assert.match(component, /FIELD_LABELS/u);
assert.doesNotMatch(component, /dangerouslySetInnerHTML/u);

// ---------- 3. contract：SectionEdit 支援所有可編輯區塊 ----------
const contract = await read("lib/research-blueprint-contract.ts");
assert.match(contract, /"workpackages" \| "milestones"/u);

// ---------- 4. release identity ----------
const identity = JSON.parse(await read("release-identity.json"));
assert.equal(identity.version, "1.5.80");
assert.equal(identity.buildId, "C2R5-GNL13");

// ---------- 5. 導航 run 跨專案繼承（建立研究專案→藍圖死結修復） ----------
const researchProjectRepository = await read("lib/research-project-repository.ts");
assert.match(researchProjectRepository, /crossProject/u);
assert.match(researchProjectRepository, /WHERE workspace_id=\$1 AND id=\$2/u);
assert.match(researchProjectRepository, /runChildWhere/u);
assert.match(researchProjectRepository, /workspace_id=\$1 AND run_id=\$2/u);
assert.match(researchProjectRepository, /intakeOverride（建立表單的確認值）優先於導航\/選題快照；兩種模式都套用/u);
const guided = await read("components/GuidedResearchCenter.tsx");
assert.match(guided, /autoCreateError/u);
assert.match(guided, /if \(fromNavigatorFlow\) \{ try \{ const rpResponse = await fetch/u);
assert.match(guided, /\.\.\.\(navigatorRunId \? \{ navigatorRunId \} : \{\}\)/u);
assert.doesNotMatch(guided, /fromNavigatorFlow && navigatorRunId/u);

console.log("BLUEPRINT_FIX_GUIDE_CONTRACT=PASS");
console.log("GATE_FAILED_FIX_LOCATION_GUIDE=PASS");
console.log("OLD_MIKE_AUTOFILL_SUGGESTION=PASS");
console.log("ARRAY_SECTION_MANUAL_EDIT_FIX=PASS");
console.log("NAVIGATOR_RUN_CROSS_PROJECT_INHERIT=PASS");
console.log("VERSION=1.5.80");
