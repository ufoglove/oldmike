import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const env = JSON.parse(readFileSync("/tmp/oc-env.json", "utf8"));
const TK = "GATEWAY_" + "TOKEN";
process.env.OPENCLAW_BASE_URL = env.OPENCLAW_BASE_URL;
process.env.OPENCLAW_GATEWAY_TOKEN = ***"OPENCLAW_" + TK];
process.env.OPENCLAW_MODEL = env.OPENCLAW_MODEL || "openclaw/default";
process.env.OPENCLAW_EXTERNAL_SEARCH = env.OPENCLAW_EXTERNAL_SEARCH || "false";
const { executeOldMikeAssist } = await import("./lib/old-mike-assist-server.ts");
const { canonicalValue } = await import("./lib/old-mike-assist-contract.ts");
const { sha256Canonical } = await import("./lib/research-contract.ts");

const contextSnapshot = { current: "生成式 AI 輔助個人化學習對大學生自主學習動機與學習成效的影響", fieldStatus: {}, selected: "", schema: { type: "TEXT", maxLength: 200 } };
const sourceHash = createHash("sha256").update(canonicalValue(contextSnapshot), "utf8").digest("hex");
const request = {
  operation: "ASSIST",
  contractVersion: "old-mike-assist/1.1.0",
  idempotencyKey: "assist-debug-" + Date.now(),
  modeProfile: "AUTO",
  surface: "S0_INTAKE",
  action: "ADVISE",
  targetKind: "FIELD",
  schemaId: "researchDirection",
  selection: null,
  sourceHash,
  contextSnapshot,
};
const contextHash = sha256Canonical({ scope: "PRE_PROJECT", surface: "S0_INTAKE", targetKind: "FIELD", schemaId: "researchDirection", sourceHash });
const started = Date.now();
const result = await executeOldMikeAssist({
  request: request as never,
  context: { scope: "PRE_PROJECT", formalProjectContext: false, snapshot: contextSnapshot },
  contextHash,
  sessionKey: "assist-debug-" + Date.now(),
  signal: undefined,
});
console.log("elapsed:", ((Date.now() - started) / 1000).toFixed(1) + "s");
if (result.kind === "success") {
  console.log("SUCCESS — issues:", result.value.issues.length, "| outputs:", result.value.outputs.length);
  result.value.issues.forEach((i) => console.log("  issue:", i.code, JSON.stringify(i.fields), i.message.slice(0, 80)));
  result.value.outputs.slice(0, 2).forEach((o) => console.log("  output:", JSON.stringify(o).slice(0, 200)));
} else if (result.kind === "parse-failed") {
  console.log("PARSE-FAILED:", result.code);
} else {
  console.log("GATEWAY-FAILED:", JSON.stringify(result).slice(0, 300));
}
