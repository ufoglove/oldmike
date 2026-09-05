import { mkdtemp, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findBash, findPtyPython, shellPath } from "./controlled-runner-test-support.mjs";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = path.join(portalRoot, ".next", "standalone");
const runner = path.join(runtimeRoot, "operator", "run-controlled-invite.sh");
const driver = path.join(portalRoot, "scripts", "verify-controlled-runner-pty.py");
const bash = findBash();
const python = findPtyPython();

function environment(temp, databaseUrl) {
  return {
    ...process.env,
    TMPDIR: shellPath(temp),
    DATABASE_URL: databaseUrl,
    BETTER_AUTH_SECRET: "controlled-runner-runtime-test-secret-value-32-bytes",
    BETTER_AUTH_URL: "https://127.0.0.1:3991",
  };
}

async function ptyCase(mode, databaseUrl) {
  const temporary = await mkdtemp(path.join(os.tmpdir(), `oldmike-runner-${mode}-`));
  try {
    return spawnSync(python, [driver, bash, shellPath(runner), mode, runtimeRoot], {
      cwd: portalRoot,
      env: environment(temporary, databaseUrl),
      encoding: "utf8",
      windowsHide: true,
      timeout: 60_000,
    });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

const toolsPass = Boolean(bash && python);
const valid = toolsPass ? await ptyCase("valid-fail", "postgresql://runner:runner@127.0.0.1:1/runner") : null;
const debugOne = process.argv.includes("--debug-one");
const invalid = !debugOne && toolsPass ? await ptyCase("invalid", "postgresql://runner:runner@127.0.0.1:1/runner") : null;
const empty = !debugOne && toolsPass ? await ptyCase("empty", "postgresql://runner:runner@127.0.0.1:1/runner") : null;
const noTty = toolsPass ? spawnSync(bash, [shellPath(runner)], {
  cwd: runtimeRoot,
  env: environment(shellPath(os.tmpdir()), "postgresql://runner:runner@127.0.0.1:1/runner"),
  input: "",
  encoding: "utf8",
  windowsHide: true,
  timeout: 15_000,
}) : null;

function ptyPass(result) {
  return result?.status === 0 && result.stdout.includes("PTY_HIDDEN_INPUT=PASS") &&
    result.stdout.includes("TERMINAL_ECHO_RECOVERY=PASS") && result.stdout.includes("EMAIL_LEAK_SCAN=PASS");
}

for (const [name, result] of [["VALID", valid], ["INVALID", invalid], ["EMPTY", empty]]) {
  if (!ptyPass(result) && result?.stdout) {
    for (const line of result.stdout.split(/\r?\n/).filter((value) => /^(?:(?:PTY|TERMINAL|EMAIL|CONTROLLED_RUNNER|RUNNER)_[A-Z_]+|INVITE_CREATE|PRIVATE_FILE_READY|FAILED_STAGE|EXIT_CODE)=/.test(value))) {
      console.log(`${name}_${line}`);
    }
  }
}

const results = {
  PTY_HIDDEN_INPUT: ptyPass(valid),
  TERMINAL_ECHO_RECOVERY: ptyPass(valid),
  INVALID_INPUT_PREWRITE_REJECTED: ptyPass(invalid),
  EMPTY_INPUT_PREWRITE_REJECTED: ptyPass(empty),
  NO_TTY_FAIL_CLOSED: noTty?.status === 2 && noTty.stdout.includes("PRIVATE_FILE_READY=FAIL"),
  EMAIL_LEAK_SCAN: [valid, invalid, empty].every(ptyPass),
};

for (const [name, pass] of Object.entries(results)) console.log(`${name}=${pass ? "PASS" : "FAIL"}`);
const pass = Object.values(results).every(Boolean);
console.log(`CONTROLLED_RUNNER_EXECUTION_GATE=${pass ? "PASS" : "FAIL"}`);
process.exit(pass ? 0 : 2);
