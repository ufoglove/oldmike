import { createHash } from "node:crypto";
import { access, lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packagedArtifactIntegrity, hasNoGroupOrOtherWrite } from "./operator/controlled-owner-policy.mjs";

function argument(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || "" : fallback;
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const runtimeRoot = path.resolve(argument("runtime-root", path.join(scriptDirectory, "..")));
const operatorRoot = path.join(runtimeRoot, "operator");
const runner = path.join(operatorRoot, "run-controlled-invite.sh");
const cli = path.join(operatorRoot, "create-registration-invite.mjs");
const manifestPath = path.join(operatorRoot, "operator", "operator-runtime-manifest.json");
const publicRoot = path.join(runtimeRoot, "public");

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

function contained(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function parentChain(file) {
  const chain = [];
  let current = path.dirname(path.resolve(file));
  while (contained(runtimeRoot, current) && current !== path.resolve(runtimeRoot)) {
    const info = await lstat(current).catch(() => null);
    chain.push(info && {
      isDirectory: info.isDirectory(),
      isSymbolicLink: info.isSymbolicLink(),
      mode: process.platform === "win32" ? 0 : info.mode & 0o777,
    });
    current = path.dirname(current);
  }
  return chain;
}

async function packagedCheck(file, relative, manifest) {
  const info = await lstat(file).catch(() => null);
  const canonicalPath = info ? await realpath(file).catch(() => "") : "";
  const digest = info?.isFile() ? createHash("sha256").update(await readFile(file)).digest("hex") : "";
  const parent = await parentChain(file);
  const expected = path.resolve(operatorRoot, ...relative.split("/"));
  return packagedArtifactIntegrity({
    expectedPath: expected,
    actualPath: file,
    info: info && {
      isFile: info.isFile(),
      isSymbolicLink: info.isSymbolicLink(),
      nlink: info.nlink,
      mode: info.mode & 0o777,
    },
    canonicalPath,
    expectedSha256: manifest.files?.[relative],
    actualSha256: digest,
    parentChain: parent,
  });
}

const labels = {
  CONTROLLED_RUNNER_PRESENT: false,
  CONTROLLED_RUNNER_APPROVED_PATH: false,
  CONTROLLED_RUNNER_REALPATH: false,
  CONTROLLED_RUNNER_NOT_SYMLINK: false,
  CONTROLLED_RUNNER_MODE: false,
  CONTROLLED_RUNNER_LINK_COUNT: false,
  CONTROLLED_RUNNER_SIZE: false,
  CONTROLLED_RUNNER_SHA256: false,
  CONTROLLED_RUNNER_PARENT_POLICY: false,
  OPERATOR_CLI_PACKAGED_INTEGRITY: false,
  CONTROLLED_RUNNER_NOT_PUBLIC: false,
  CONTROLLED_RUNNER_NOT_AUTO_EXECUTED: false,
  TERMINAL_ECHO_RECOVERY_CONTRACT: false,
  EMAIL_NOT_IN_ARGV: false,
  EMAIL_NOT_IN_ENV: false,
  EMAIL_NOT_IN_OUTPUT: false,
  EMAIL_NOT_IN_ARTIFACT: false,
  EMAIL_NOT_IN_LEDGER: false,
};

try {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const relative = "run-controlled-invite.sh";
  labels.CONTROLLED_RUNNER_PRESENT = await exists(runner);
  const info = labels.CONTROLLED_RUNNER_PRESENT ? await lstat(runner) : null;
  const canonical = info ? await realpath(runner) : "";
  labels.CONTROLLED_RUNNER_APPROVED_PATH = path.resolve(runner) === path.join(runtimeRoot, "operator", relative);
  labels.CONTROLLED_RUNNER_REALPATH = canonical === path.resolve(runner) && contained(operatorRoot, canonical);
  labels.CONTROLLED_RUNNER_NOT_SYMLINK = Boolean(info?.isFile() && !info.isSymbolicLink());
  labels.CONTROLLED_RUNNER_MODE = process.platform === "win32" || Boolean(info && hasNoGroupOrOtherWrite(info.mode & 0o777));
  labels.CONTROLLED_RUNNER_LINK_COUNT = Boolean(info && info.nlink === 1);
  labels.CONTROLLED_RUNNER_SIZE = Boolean(info && Number.isSafeInteger(manifest.sizes?.[relative]) && info.size === manifest.sizes[relative]);
  const digest = info ? createHash("sha256").update(await readFile(runner)).digest("hex") : "";
  labels.CONTROLLED_RUNNER_SHA256 = digest === manifest.files?.[relative];
  labels.CONTROLLED_RUNNER_PARENT_POLICY = (await packagedCheck(runner, relative, manifest)) === true;
  labels.OPERATOR_CLI_PACKAGED_INTEGRITY = await packagedCheck(cli, "create-registration-invite.mjs", manifest);
  labels.CONTROLLED_RUNNER_NOT_PUBLIC = !contained(publicRoot, runner);
  const server = await readFile(path.join(runtimeRoot, "server.js"), "utf8").catch(() => "");
  labels.CONTROLLED_RUNNER_NOT_AUTO_EXECUTED = !server.includes("run-controlled-invite.sh");
  const source = info ? await readFile(runner, "utf8") : "";
  labels.TERMINAL_ECHO_RECOVERY_CONTRACT = source.includes("IFS= read -r -s controlled_email </dev/tty") &&
    source.includes("stty echo </dev/tty") && source.includes("trap on_signal HUP INT TERM");
  labels.EMAIL_NOT_IN_ARGV = source.includes("--email-stdin") && !source.includes("--email \"");
  labels.EMAIL_NOT_IN_ENV = !/export\s+controlled_email|[A-Z_]*EMAIL=.*controlled_email/.test(source);
  labels.EMAIL_NOT_IN_OUTPUT = !/(?:printf|echo)[^\n]*controlled_email/.test(source.replace("printf '%s\\n' \"$controlled_email\" |", ""));
  const createSource = await readFile(path.join(operatorRoot, "create-registration-invite.mjs"), "utf8");
  labels.EMAIL_NOT_IN_ARTIFACT = !/const artifact = \{[\s\S]{0,800}\bemail\b/i.test(createSource);
  labels.EMAIL_NOT_IN_LEDGER = !/const ledger = \{[\s\S]{0,1200}\bemail\b/i.test(createSource);
} catch {
  // All failed labels remain redacted booleans.
}

const packagedPass = labels.CONTROLLED_RUNNER_PRESENT &&
  labels.CONTROLLED_RUNNER_APPROVED_PATH &&
  labels.CONTROLLED_RUNNER_REALPATH &&
  labels.CONTROLLED_RUNNER_NOT_SYMLINK &&
  labels.CONTROLLED_RUNNER_MODE &&
  labels.CONTROLLED_RUNNER_LINK_COUNT &&
  labels.CONTROLLED_RUNNER_SIZE &&
  labels.CONTROLLED_RUNNER_SHA256 &&
  labels.CONTROLLED_RUNNER_PARENT_POLICY &&
  labels.OPERATOR_CLI_PACKAGED_INTEGRITY &&
  labels.CONTROLLED_RUNNER_NOT_PUBLIC;
const helperSource = await readFile(path.join(operatorRoot, "operator", "controlled-invite-runner-helper.mjs"), "utf8").catch(() => "");
const runtimeOwnerPolicy = helperSource.includes("process.getuid") &&
  helperSource.includes("0o700") && helperSource.includes("0o600") &&
  helperSource.includes("isSymbolicLink") && helperSource.includes("realpath");
for (const [name, value] of Object.entries(labels)) console.log(`${name}=${value ? "PASS" : "FAIL"}`);
console.log(`PACKAGED_ARTIFACT_INTEGRITY=${packagedPass ? "PASS" : "FAIL"}`);
console.log(`RUNTIME_PRIVATE_DIRECTORY_INTEGRITY=${runtimeOwnerPolicy ? "PASS" : "FAIL"}`);
console.log(`RUNTIME_OWNER_POLICY=${runtimeOwnerPolicy ? "PASS" : "FAIL"}`);
const pass = packagedPass && runtimeOwnerPolicy &&
  labels.CONTROLLED_RUNNER_NOT_AUTO_EXECUTED &&
  labels.TERMINAL_ECHO_RECOVERY_CONTRACT &&
  labels.EMAIL_NOT_IN_ARGV && labels.EMAIL_NOT_IN_ENV &&
  labels.EMAIL_NOT_IN_OUTPUT && labels.EMAIL_NOT_IN_ARTIFACT && labels.EMAIL_NOT_IN_LEDGER;
console.log(`CONTROLLED_RUNNER_RUNTIME_GATE=${pass ? "PASS" : "FAIL"}`);
process.exit(pass ? 0 : 2);
