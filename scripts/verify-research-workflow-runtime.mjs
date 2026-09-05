import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runtimeContractPass,
  verifyCompiledResearchRuntime,
  verifySourceResearchContract,
} from "./research-runtime-contract.mjs";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = path.resolve(process.env.RUNTIME_ARTIFACT_DIR || path.join(portalRoot, ".next", "standalone"));
const source = await verifySourceResearchContract(portalRoot);
const runtime = await verifyCompiledResearchRuntime(runtimeRoot);

for (const [name, pass] of Object.entries(source)) console.log(`${name}=${pass ? "PASS" : "FAIL"}`);
console.log(`SOURCE_ROUTE_CONTRACT=${runtimeContractPass(source) ? "PASS" : "FAIL"}`);
for (const [name, pass] of Object.entries(runtime)) console.log(`${name}=${pass ? "PASS" : "FAIL"}`);
const pass = runtimeContractPass(source) && runtimeContractPass(runtime);
console.log(`RESEARCH_WORKFLOW_RUNTIME_GATE=${pass ? "PASS" : "FAIL"}`);
console.log(`EXIT_CODE=${pass ? 0 : 2}`);
process.exit(pass ? 0 : 2);
