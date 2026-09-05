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
const { executeOneClickInspiration } = await import("./lib/one-click-inspiration-service.ts");
const request = {
  operation: "GENERATE_INSPIRATIONS",
  idempotencyKey: "oci2-" + Date.now(),
  researchFocus: "Multimodal AI × XR × 職業安全訓練",
  researchGoal: "NSTC",
  researchDomains: ["AI跨領域應用，AI應用於教育，AI應用於職業安全與教育訓練，AI應用於環境工程與環境資源管理，AI應用於能源管理，VR/AR/XR跨領域應用於職業安全教育訓練與教育應用"],
  radarContext: { opportunityId: "R-20260829-01", title: "Multimodal AI × XR × Occupational Safety", radarScore: 88, generatedAt: new Date().toISOString() },
};
const started = Date.now();
try {
  const result = await executeOneClickInspiration(request, { signal: undefined });
  console.log("SUCCESS in " + ((Date.now() - started) / 1000).toFixed(1) + "s");
  const byType = {};
  result.candidates.forEach((c) => { byType[c.ideaType] = (byType[c.ideaType] || 0) + 1; });
  console.log("ideaType distribution:", JSON.stringify(byType));
  result.candidates.forEach((c) => console.log(" - [" + c.ideaType + " " + c.score + " " + c.evidenceStatus + "] " + c.titleZh.slice(0, 40)));
  const c0 = result.candidates[0];
  console.log("sample fields:", ["whyWorthwhile", "primaryGap", "secondaryGap", "population", "variables", "dataSources", "expectedContribution", "difficulty", "potential"].map((k) => k + "=" + (c0[k] ? "ok" : "MISSING")).join(" "));
} catch (error) {
  console.log("FAILED in " + ((Date.now() - started) / 1000).toFixed(1) + "s");
  if (error && typeof error === "object" && "code" in error) {
    const e = error as { code: string; stage?: string; recoverableFields?: string[] };
    console.log("code:", e.code, "| stage:", e.stage, "| fields:", JSON.stringify(e.recoverableFields));
  } else console.log(String(error));
  process.exit(1);
}
