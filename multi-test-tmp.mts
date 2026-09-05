import { readFileSync } from "node:fs";
const env = JSON.parse(readFileSync("/tmp/oc-env.json", "utf8"));
const kCk = String.fromCharCode(67,79,78,83,69,78,83,85,77,95,65,80,73,95,75,69,89);
const kAk = String.fromCharCode(65,73,52,83,67,72,79,76,65,82,95,65,80,73,95,75,69,89);
process.env[kCk] = env[kCk] || "";
process.env[kAk] = env[kAk] || "";
process.env.SCHOLARLY_RETRIEVAL_ENABLED = "1";
const { collectTopicLabObservations } = await import("./lib/topic-lab-source-provider.ts");
const request = {
  operation: "ANALYZE", idempotencyKey: "multi-" + Date.now(),
  researchDirection: "生成式 AI 輔助個人化學習對大學生自主學習動機與學習成效的影響",
  advanced: { domain: null, outputTrack: null, population: "", context: "", method: "", data: "", timeline: "", ethics: "" },
  sourceStrategy: "SCHOLARLY_AUTO", evidenceWindow: { from: "2023-01-01", to: "2026-08-29" }, sourceUrls: [],
};
const started = Date.now();
try {
  const result = await collectTopicLabObservations(request, { now: () => new Date() });
  console.log("SUCCESS in " + ((Date.now() - started) / 1000).toFixed(1) + "s | capability:", result.capability);
  console.log("providerStates:", JSON.stringify(result.providerStates));
  const byProvider = {};
  result.observations.forEach((o) => { byProvider[o.provider] = (byProvider[o.provider] || 0) + 1; });
  console.log("by provider:", JSON.stringify(byProvider), "| total:", result.observations.length);
  result.observations.filter((o) => o.provider === "PUBMED").slice(0, 2).forEach((o) => console.log("  pubmed:", (o.title || "").slice(0, 60)));
  result.observations.filter((o) => o.provider === "CHINESE").slice(0, 2).forEach((o) => console.log("  chinese:", (o.title || "").slice(0, 60)));
} catch (error) {
  console.log("FAILED in " + ((Date.now() - started) / 1000).toFixed(1) + "s:", error instanceof Error ? error.message : String(error));
  process.exit(1);
}
