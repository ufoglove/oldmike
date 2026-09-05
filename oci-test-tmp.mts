import { readFileSync } from "node:fs";
const env = JSON.parse(readFileSync("/tmp/oc-env.json", "utf8"));
const TK = "GATEWAY_" + "TOKEN";
process.env.OPENCLAW_BASE_URL = env.OPENCLAW_BASE_URL;
process.env.OPENCLAW_GATEWAY_TOKEN = ***"OPENCLAW_" + TK];
process.env.OPENCLAW_MODEL = env.OPENCLAW_MODEL || "openclaw/default";
process.env.OPENCLAW_EXTERNAL_SEARCH = env.OPENCLAW_EXTERNAL_SEARCH || "false";
process.env.CONSENSUS_API_KEY = env.CO…KEY;
process.env.SCHOLARLY_RETRIEVAL_ENABLED = "1";
process.env.AI4SCHOLAR_API_KEY = env.AI…_KEY || "";
const { executeOneClickInspiration } = await import("./lib/one-click-inspiration-service.ts");
const request = {
  operation: "GENERATE_INSPIRATIONS",
  idempotencyKey: "oci-test-" + Date.now(),
  researchFocus: "生成式 AI 輔助個人化學習",
  researchGoal: "NSTC",
  researchDomains: ["AI跨領域應用，AI應用於教育，AI應用於職業安全與教育訓練，AI應用於環境工程與環境資源管理，AI應用於能源管理，VR/AR/XR跨領域應用於職業安全教育訓練與教育應用"],
};
const started = Date.now();
try {
  const result = await executeOneClickInspiration(request, { signal: undefined });
  console.log("SUCCESS in " + ((Date.now() - started) / 1000).toFixed(1) + "s");
  console.log("evidenceStatus:", result.evidenceStatus, "| capability:", result.sourceCapability);
  console.log("candidates:", result.candidates.length);
  result.candidates.forEach((c) => console.log(" - [" + c.score + "] " + c.titleZh.slice(0, 45)));
  result.top3.forEach((t) => {
    const c = result.candidates.find((x) => x.candidateId === t.candidateId);
    console.log("   top3 " + t.role + " -> " + (c?.titleZh || "").slice(0, 40));
  });
} catch (error) {
  console.log("FAILED in " + ((Date.now() - started) / 1000).toFixed(1) + "s");
  if (error && typeof error === "object" && "code" in error) {
    const e = error as { code: string; stage?: string; recoverableFields?: string[] };
    console.log("code:", e.code, "| stage:", e.stage, "| fields:", JSON.stringify(e.recoverableFields));
  } else console.log(String(error));
  process.exit(1);
}
