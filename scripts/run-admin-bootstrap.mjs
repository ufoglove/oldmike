import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  AdminBootstrapBridgeError,
  runAdminBootstrapBridge,
} from "./operator/admin-bootstrap-bridge-provider.mjs";

function fixedOutput(result) {
  return `${Object.entries(result).map(([name, value]) => `${name}=${value}`).join("\n")}\n`;
}

async function main() {
  if (process.argv.length !== 2) throw new AdminBootstrapBridgeError("ADMIN_BOOTSTRAP_TRANSPORT_POLICY", "ARGV_POLICY");
  const operatorDirectory = path.dirname(fileURLToPath(import.meta.url));
  const result = await runAdminBootstrapBridge({
    operatorPath: path.join(operatorDirectory, "bootstrap-portal-administrator.mjs"),
  });
  process.stdout.write(fixedOutput(result));
}

const direct = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (direct) {
  main().catch((error) => {
    const controlled = error instanceof AdminBootstrapBridgeError
      ? error
      : new AdminBootstrapBridgeError("ADMIN_BOOTSTRAP_CHILD_FAILURE", "UNKNOWN");
    process.stdout.write(fixedOutput({
      ADMIN_BOOTSTRAP_BRIDGE: "FAIL",
      ADMIN_BOOTSTRAP: controlled.operatorCommitted ? "COMMITTED_STATE_UNKNOWN" : "FAIL",
      PASSWORD_HANDOFF_READY: "FAIL",
      FAILED_STAGE: controlled.stage,
      ERROR_CATEGORY: controlled.category,
      AUTOMATIC_RETRY: "DISABLED",
      EXIT_CODE: 2,
    }));
    process.exitCode = 2;
  });
}

