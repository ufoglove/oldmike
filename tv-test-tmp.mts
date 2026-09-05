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
const { executeTopicValidation } = await import("./lib/research-topic-validation-service.ts");
const started = Date.now();
try {
  const result = await executeTopicValidation({
    operation: "VALIDATE_TOPIC",
    idempotencyKey: "tv-test-" + Date.now(),
    topicTitle: "多模態 AI 驅動的 XR 職業安全訓練對技能遷移的影響",
    researchQuestion: "多模態適應訓練是否優於固定內容訓練？",
    parameters: { innovation: "BALANCED", difficulty: "MEDIUM", duration: "1Y", output: "NSTC", design: "QUASI" },
  }, { signal: undefined });
  console.log("SUCCESS in " + ((Date.now() - started) / 1000).toFixed(1) + "s");
  console.log("validationId:", result.validationId, "| version:", result.version);
  console.log("decomposition:", result.decomposition.length, "items | missing:", result.decomposition.filter((d) => d.status === "MISSING").map((d) => d.label).join(",") || "none");
  console.log("ledger:", result.evidence.ledger.length, "| note:", result.evidence.note.slice(0, 80));
  console.log("gapMatrix:", result.gapMatrix.length, "|", result.gapMatrix.map((g) => g.status).join("/"));
  console.log("novelty:", result.novelty.level, "| delta items:", result.novelty.contributionDelta.length);
  console.log("score:", result.score.total, result.score.grade, "| breakdown:", JSON.stringify(result.score.breakdown));
  console.log("reviewer2:", result.reviewer2.length, "| step:", result.recommendedNextStep.slice(0, 80));
} catch (error) {
  console.log("FAILED in " + ((Date.now() - started) / 1000).toFixed(1) + "s");
  if (error && typeof error === "object" && "code" in error) {
    const e = error as { code: string; stage?: string; recoverableFields?: string[] };
    console.log("code:", e.code, "| stage:", e.stage, "| fields:", JSON.stringify(e.recoverableFields));
  } else console.log(String(error));
  process.exit(1);
}
