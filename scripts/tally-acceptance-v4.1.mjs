#!/usr/bin/env node
/**
 * tally-acceptance-v4.1.mjs — 逐列解析 acceptance-suite-v4.1-correction.md 第二節表格並統計結果。
 * 防止人工湊數：統計由本程式產生，非手寫。
 */
import fs from "node:fs";
const path = "docs/operations/V3-R04/acceptance-suite-v4.1-correction.md";
const text = fs.readFileSync(path, "utf8");
const lines = text.split("\n");
const rows = [];
for (const line of lines) {
  const m = line.match(/^\| (\d+) \|/);
  if (!m) continue;
  const id = Number(m[1]);
  if (id < 1 || id > 24) continue; // 只計第二節 24 項清冊（排除第一/四節的其他表格列）
  const res = line.split("|").map(s => s.trim());
  const result = (res[2] || "").replace(/\*/g, "").match(/^[A-Z]+/);
  rows.push({ id, result: result ? result[0] : "UNPARSED" });
}
const ids = rows.map(r => r.id);
const missing = Array.from({ length: 24 }, (_, i) => i + 1).filter(i => !ids.includes(i));
if (missing.length) { console.error("缺項:", missing); process.exit(1); }
if (ids.length !== 24 || new Set(ids).size !== 24) { console.error("分母錯誤: 共", ids.length, "列"); process.exit(1); }
const tally = {};
for (const r of rows) tally[r.result] = (tally[r.result] || 0) + 1;
console.log("統計（程式產生）：");
for (const [k, v] of Object.entries(tally)) console.log(`  ${k}: ${v} (${(v / 24 * 100).toFixed(1)}%)`);
console.log("  合計: 24 項，ID 1–24 無缺項、無重複");
const docClaimMatch = text.includes(`| PASS | ${tally.PASS ?? 0} |`);
console.log(`文件宣稱 PASS=${tally.PASS ?? 0} 與程式統計一致: ${docClaimMatch ? "是" : "否 → 文件需修正"}`);
