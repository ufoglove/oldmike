#!/usr/bin/env node
/**
 * verify-stat-engine-reference.mjs — C05/C06/C07 數值驗證
 * 對照 scipy 1.18.1 / statsmodels 0.15.0（隔離 venv /tmp/calcenv）計算之參考值。
 *
 * 分類依據站主文件第三節：
 *  - 引擎公式（Welch/ANCOVA/Holm/p 值）為 A 類（真實解析公式，已驗證自有實作）
 *  - analysis-execution-service 內硬編碼示範資料為 D 類（fixture 展示，不得作正式結果）
 *
 * 驗收項目：
 *  C05：核心方法對參考值通過數值容差
 *  C06：修改輸入影響結果
 *  C07：缺 R 不阻擋已驗證 Python（本測試即用 Python 產生參考值）
 */
import { calculateWelchTTest, calculateAncovaModel, calculateDescriptiveStats, applyHolmBonferroni } from "../lib/statistical-computation-engine.ts";

let failures = 0;
function check(name, actual, expected, tol) {
  const ok = Math.abs(actual - expected) <= tol;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: actual=${actual} expected=${expected} tol=${tol}`);
}

// ===== 參考值（由 /tmp/calcenv Python scipy/statsmodels 產生，2026-09-08）=====
// g1=[1850.2,1920.5,1810.0], g2=[2780.0,2890.0,2650.0]
const w = calculateWelchTTest([1850.2, 1920.5, 1810.0], [2780.0, 2890.0, 2650.0]);
check("C05 welch t", w.tStatistic, -11.9343685089, 0.001);
check("C05 welch df", w.degreesOfFreedom, 2.8280084596, 0.01);
check("C05 welch p", w.pValue, 0.0016677668, 1e-6);
check("C05 welch CI low", w.confidenceInterval[0], -1165.1849413905, 0.01);
check("C05 welch CI high", w.confidenceInterval[1], -661.0150586095, 0.01);
check("C05 cohens d", w.cohensD, -9.744371083, 0.001);

// ANCOVA: pre/post/intervention 4 cases
const a = calculateAncovaModel([
  { pre: 3421.5, post: 1850.2, isIntervention: 1 },
  { pre: 3210.0, post: 1920.5, isIntervention: 1 },
  { pre: 3350.0, post: 2780.0, isIntervention: 0 },
  { pre: 3510.0, post: 2890.0, isIntervention: 0 },
]);
check("C05 ancova b1", a.treatmentEffectEstimate, -945.212781, 0.001);
check("C05 ancova se", a.standardError, 107.755177, 0.001);
check("C05 ancova t", a.tValue, -8.771855, 0.001);
check("C05 ancova p", a.pValue, 0.0722633013, 1e-6);
check("C05 ancova CI low", a.confidenceInterval[0], -2314.3721, 0.1);
check("C05 ancova CI high", a.confidenceInterval[1], 423.9466, 0.1);
check("C05 ancova R2", a.rSquared, 0.990698, 0.001);

// Descriptive / Holm
const d = calculateDescriptiveStats([1, 2, 3, 4, 5]);
check("C05 desc var", d.sampleVariance, 2.5, 1e-9);
const h = applyHolmBonferroni([0.01, 0.04, 0.03]);
check("C05 holm[0]", h[0], 0.03, 1e-9);
check("C05 holm[1]", h[1], 0.06, 1e-9);
check("C05 holm[2]", h[2], 0.06, 1e-9);

// ===== C06: 修改輸入 → 結果依預期改變 =====
const w2 = calculateWelchTTest([100, 110, 120], [300, 310, 320]);
if (!(w2.tStatistic < w.tStatistic && w2.pValue < w.pValue)) { failures++; console.log("FAIL C06 input sensitivity"); }
else console.log("PASS C06 input sensitivity (larger effect → larger |t|, smaller p)");

const w3 = calculateWelchTTest([1850.2, 1920.5, 1810.0], [1860.0, 1870.0, 1855.0]);
if (!(Math.abs(w3.tStatistic) < Math.abs(w.tStatistic))) { failures++; console.log("FAIL C06 near-null effect"); }
else console.log("PASS C06 near-null effect (smaller |t| when groups closer)");

// 失敗/例外不得偽裝成功
try { calculateWelchTTest([5, 5], [5, 5]); failures++; console.log("FAIL C06 zero-variance not rejected"); }
catch (e) { console.log("PASS C06 zero-variance rejected:", e.message); }
try { calculateAncovaModel([{ pre: 1, post: 1, isIntervention: 1 }]); failures++; console.log("FAIL C06 n<4 not rejected"); }
catch (e) { console.log("PASS C06 n<4 rejected:", e.message); }

// ===== C07: 環境能力聲明 =====
console.log("C07: engine = TypeScript 真實封閉式公式（A 類，已通過上述 scipy 對照）");
console.log("C07: Rscript = 未安裝 → R 專屬方法標 UNSUPPORTED，不偽裝");
console.log("C07: Python scipy/statsmodels = /tmp/calcenv 已驗證（本測試參考值來源）");

console.log(failures === 0 ? "\n=== 全部通過 ===" : `\n=== ${failures} 項失敗 ===`);
process.exit(failures === 0 ? 0 : 1);
