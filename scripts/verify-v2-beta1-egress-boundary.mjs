import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createV2Beta1Coordinator, createV2Beta1JourneyRequest } from "../lib/v2-beta1/runtime.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const originalFetch = globalThis.fetch;
let observedEgressAttempts = 0;
globalThis.fetch = async () => {
  observedEgressAttempts += 1;
  throw new Error("beta1_test_network_kill_switch");
};

try {
  const scenarios = [
    { scope: "egress:keyword-journal", input: { suffix: "egress-journal", entryMode: "KEYWORD", outputTarget: "SSCI", researchDirection: "回饋證據校準", materials: [] } },
    { scope: "egress:partial-journal", input: { suffix: "egress-partial", entryMode: "PARTIAL_MATERIAL", outputTarget: "SCI", researchDirection: "整合既有方法材料形成可驗證研究問題", materials: [{ materialId: "material-001", kind: "METHODS", title: "方法", content: "採混合方法檢驗機制；目前尚無結果資料。" }] } },
    { scope: "egress:keyword-taiwan", input: { suffix: "egress-taiwan", entryMode: "KEYWORD", outputTarget: "MOE", researchDirection: "XR 職業安全教育", materials: [] } },
  ];
  for (const scenario of scenarios) {
    const coordinator = createV2Beta1Coordinator();
    const snapshot = coordinator.getSnapshot(scenario.scope);
    const result = await coordinator.runJourney(createV2Beta1JourneyRequest(snapshot, scenario.input), scenario.scope);
    assert.equal(result.snapshot.externalMutationCount, 0);
    assert.equal(result.snapshot.onlineDatabaseWriteCount, 0);
    assert.equal(result.snapshot.formalResearchWriteCount, 0);
  }
  const beta1Files = (await readdir(path.join(root, "lib", "v2-beta1"))).filter((name) => /\.(?:ts|tsx|mjs)$/u.test(name));
  const forbiddenSurface = /\b(?:fetch|WebSocket)\s*\(|\b(?:http|https|net|tls)\.(?:request|connect)\s*\(/u;
  for (const name of beta1Files) assert.doesNotMatch(await readFile(path.join(root, "lib", "v2-beta1", name), "utf8"), forbiddenSurface, `server egress surface ${name}`);
  assert.equal(observedEgressAttempts, 0);
  console.log(JSON.stringify({ status: "PASS", scenarios: scenarios.length, networkKillSwitch: "ARMED", serverTestProcessObservedEgress: 0, staticServerEgressSurface: "ABSENT", formalResearchWrites: 0, onlineDatabaseWrites: 0, externalMutations: 0 }));
} finally {
  globalThis.fetch = originalFetch;
}
