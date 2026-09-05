import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  AdminBootstrapBridgeError,
  recoverCommittedAdminBootstrapHandoff,
} from "./operator/admin-bootstrap-bridge-provider.mjs";

function fixedOutput(result) {
  return `${Object.entries(result).map(([name, value]) => `${name}=${value}`).join("\n")}\n`;
}

async function main() {
  if (process.argv.length !== 2) throw new AdminBootstrapBridgeError("ADMIN_BOOTSTRAP_TRANSPORT_POLICY", "ARGV_POLICY");
  process.stdout.write(fixedOutput(await recoverCommittedAdminBootstrapHandoff()));
}

const direct = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (direct) {
  main().catch((error) => {
    const controlled = error instanceof AdminBootstrapBridgeError
      ? error
      : new AdminBootstrapBridgeError("ADMIN_BOOTSTRAP_RECOVERY_FAILED", "UNKNOWN");
    process.stdout.write(fixedOutput({
      ADMIN_BOOTSTRAP_HANDOFF_RECOVERY: "FAIL",
      OPERATOR_REEXECUTED: "NO",
      PASSWORD_HANDOFF_READY: "FAIL",
      FAILED_STAGE: controlled.stage,
      ERROR_CATEGORY: controlled.category,
      EXIT_CODE: 2,
    }));
    process.exitCode = 2;
  });
}

