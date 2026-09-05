import {
  MAX_ARTIFACT_BYTES,
  readPrivateJson,
  validateInvitationArtifact,
} from "./operator/registration-invite-atomic.mjs";

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || "" : "";
}

let contract = false;
let mode = false;
let origin = false;
let registrationPath = false;
let singleUse = false;

try {
  const artifact = await readPrivateJson(argument("artifact"), MAX_ARTIFACT_BYTES);
  const result = validateInvitationArtifact(artifact.value, argument("expected-origin"));
  contract = result.pass;
  mode = process.platform === "win32" || (artifact.info.mode & 0o777) === 0o600;
  origin = result.origin;
  registrationPath = result.path;
  singleUse = result.singleUse;
} catch {
  // Deliberately emit only fixed, non-sensitive status labels below.
}

console.log(`INVITE_OUTPUT_CONTRACT=${contract ? "PASS" : "FAIL"}`);
console.log(`INVITE_ARTIFACT_MODE=${mode ? "PASS" : "FAIL"}`);
console.log(`INVITE_ARTIFACT_ORIGIN=${origin ? "PASS" : "FAIL"}`);
console.log(`INVITE_ARTIFACT_PATH=${registrationPath ? "PASS" : "FAIL"}`);
console.log(`INVITE_ARTIFACT_SINGLE_USE=${singleUse ? "PASS" : "FAIL"}`);
process.exit(contract && mode && origin && registrationPath && singleUse ? 0 : 2);
