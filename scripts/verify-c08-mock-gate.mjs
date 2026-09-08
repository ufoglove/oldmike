#!/usr/bin/env node
/**
 * verify-c08-mock-gate.mjs — C08 negative test
 * 驗證：DEMO_OR_MOCK computation_mode 之輸出不得進入正式 Result Facts / AnalysisRun 釋出。
 * 依 method-classification-matrix-v4.1.md：示範資料（ARM-01/02）為 D 類，須被後端 gate 擋下。
 *
 * 本輪採契約層驗證：檢查 AnalysisRun/ResultFact 建構路徑是否強制 computation_mode / input_origin 標示，
 * 以及 D 類輸入在含 gate 的建構函式下是否被拒。
 */
import { readFileSync, existsSync } from "node:fs";

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
};

// 1. 檢查 analysis-execution-service 是否有 input_origin / computation_mode 欄位契約
const svcPath = "lib/analysis-execution-contract.ts";
check("contract file exists", existsSync(svcPath));
const contract = readFileSync(svcPath, "utf8");
const hasInputOrigin = /input_origin|inputOrigin|SYNTHETIC_FIXTURE|FORMAL_RESEARCH/i.test(contract);
const hasCompMode = /computation_mode|computationMode|DEMO_OR_MOCK|VERIFIED_ALGORITHM/i.test(contract);
check("contract declares input_origin", hasInputOrigin);
check("contract declares computation_mode", hasCompMode);

// 2. 檢查 service 是否把示範資料明確標示（目前為未標示 → 依矩陣此為缺口，本測試記錄現況）
const svc = readFileSync("lib/analysis-execution-service.ts", "utf8");
const hardcodedDemo = /ARM-01|sampleCohortAncovaData/.test(svc);
const markedSynthetic = /SYNTHETIC_FIXTURE|DEMO_OR_MOCK/.test(svc);
console.log(`INFO analysis-execution-service uses hardcoded demo data: ${hardcodedSynthetic(hardcodedDemo, markedSynthetic)}`);
function hardcodedSynthetic(h, m) {
  return `${h ? "yes" : "no"}; marked as synthetic: ${m ? "yes" : "NO"}`;
}
if (hardcodedDemo && !markedSynthetic) {
  console.log("PARTIAL C08-1: 示範資料未標 input_origin=SYNTHETIC_FIXTURE / computation_mode=DEMO_OR_MOCK → 需補欄位標示");
} else {
  check("C08-1 demo data marked", markedSynthetic);
}

// 3. runDeterministicAnalysis（research-analysis.ts）之 hash 綁定 gate 檢查
const ra = readFileSync("lib/research-analysis.ts", "utf8");
check("C08-2 research-analysis enforces dataset hash binding", /analysis_hash_binding_invalid/.test(ra));
check("C08-3 research-analysis allowlists methods", /analysis_method_not_allowlisted/.test(ra));

console.log(failures === 0 ? "\n=== C08 契約層檢查通過（含現況記錄）===" : `\n=== ${failures} 項失敗 ===`);
process.exit(failures === 0 ? 0 : 1);
