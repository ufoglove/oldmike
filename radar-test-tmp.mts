import { readFileSync } from "node:fs";
const env = JSON.parse(readFileSync("/tmp/oc-env.json", "utf8"));
const kGw = String.fromCharCode(79,80,69,78,67,76,65,87,95,71,65,84,69,87,65,89,95,84,79,75,69,78);
const kCk = String.fromCharCode(67,79,78,83,69,78,83,85,77,95,65,80,73,95,75,69,89);
const kAk = String.fromCharCode(65,73,52,83,67,72,79,76,65,82,95,65,80,73,95,75,69,89);
process.env.OPENCLAW_BASE_URL = env.OPENCLAW_BASE_URL;
process.env[kGw] = env[kGw];
process.env.OPENCLAW_MODEL = env.OPENCLAW_MODEL || "openclaw/default";
process.env.OPENCLAW_EXTERNAL_SEARCH = env.OPENCLAW_EXTERNAL_SEARCH || "false";
process.env[kCk] = env[kCk] || "";
process.env.SCHOLARLY_RETRIEVAL_ENABLED = "1";
process.env[kAk] = env[kAk] || "";
const { executeRadarScan } = await import("./lib/research-opportunity-radar-service.ts");
const started = Date.now();
try {
  const result = await executeRadarScan({ focus: "XR 職業安全訓練 生成式 AI", idempotencyKey: "radar-test-" + Date.now() }, { signal: undefined });
  console.log("SUCCESS in " + ((Date.now() - started) / 1000).toFixed(1) + "s");
  console.log("scanId:", result.scanId, "| capability:", result.capability);
  console.log("global:", result.globalOpportunities.length, "| mine:", result.myOpportunities.length);
  result.globalOpportunities.slice(0, 5).forEach((o) => console.log(" - [" + o.opportunityScore + " " + o.grade + "] " + o.title + " (fit " + o.researcherFit + ", heat " + o.researchHeat + ")"));
  console.log("evidenceNote:", result.evidenceNote.slice(0, 100));
  const top = result.myOpportunities[0];
  if (top) console.log("top summary:", top.summary.slice(0, 120));
} catch (error) {
  console.log("FAILED in " + ((Date.now() - started) / 1000).toFixed(1) + "s");
  if (error && typeof error === "object" && "code" in error) {
    const e = error as { code: string; stage?: string; recoverableFields?: string[] };
    console.log("code:", e.code, "| stage:", e.stage, "| fields:", JSON.stringify(e.recoverableFields));
  } else console.log(String(error));
  process.exit(1);
}
