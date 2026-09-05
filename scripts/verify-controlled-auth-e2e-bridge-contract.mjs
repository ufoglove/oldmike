import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTROLLED_EMAIL_ENV,
  BRIDGE_SUCCESS_OUTPUT,
  ControlledEmailBridgeError,
  normalizeControlledEmail,
  runControlledAuthE2E,
  serializeBridgeSuccess,
  transportControlledEmail,
} from "./run-controlled-auth-e2e.mjs";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bridgePath = path.join(portalRoot, "scripts", "run-controlled-auth-e2e.mjs");
const operatorPath = path.join(portalRoot, "scripts", "create-registration-invite.mjs");
const temporary = await mkdtemp(path.join(os.tmpdir(), "oldmike-controlled-email-contract-"));
const sentinel = ["bridge-contract-sentinel", ["example", "test"].join(".")].join("@");
const normalizedSentinel = sentinel.toLowerCase();

const results = {};
function record(name, pass) {
  results[name] = Boolean(pass);
}

async function expectCategory(name, expectedCategory, callback) {
  try {
    await callback();
    record(name, false);
  } catch (error) {
    record(name, error instanceof ControlledEmailBridgeError && error.category === expectedCategory);
  }
}

async function fixture(name, body) {
  const file = path.join(temporary, `${name}.mjs`);
  await writeFile(file, body, "utf8");
  return file;
}

async function operatorFixture(name, { extraProviderLine = false } = {}) {
  const directory = path.join(temporary, name);
  const operatorDirectory = path.join(directory, "operator-runtime");
  const helperDirectory = path.join(operatorDirectory, "operator");
  await mkdir(helperDirectory, { recursive: true });

  const providerBody = String.raw`
    import { appendFile, chmod, writeFile } from "node:fs/promises";
    const value = [];
    for await (const chunk of process.stdin) value.push(Buffer.from(chunk));
    if (Object.hasOwn(process.env, "AUTH_E2E_CONTROLLED_EMAIL")) process.exit(9);
    const argument = (name) => {
      const index = process.argv.indexOf("--" + name);
      return index >= 0 ? process.argv[index + 1] || "" : "";
    };
    await appendFile(process.env.BRIDGE_PROVIDER_MARKER, "1", "utf8");
    await writeFile(argument("artifact"), "{}", { encoding: "utf8", mode: 0o600 });
    await chmod(argument("artifact"), 0o600);
    await writeFile(argument("ledger"), "{}", { encoding: "utf8", mode: 0o600 });
    await chmod(argument("ledger"), 0o600);
    process.stdout.write("INVITE_OUTPUT_CONTRACT=PASS\n");
    process.stdout.write("INVITE_CREATE=PASS\n");
    process.stdout.write("ARTIFACT_STATE=READY_FOR_PRIVATE_DOWNLOAD\n");
    process.stdout.write("PRIVATE_FILE_READY=PASS\n");
    ${extraProviderLine ? 'process.stdout.write("EXIT_CODE=0\\n");' : ""}
  `;
  const verifierBody = String.raw`
    process.stdout.write("INVITE_OUTPUT_CONTRACT=PASS\n");
    process.stdout.write("INVITE_ARTIFACT_MODE=PASS\n");
    process.stdout.write("INVITE_ARTIFACT_ORIGIN=PASS\n");
    process.stdout.write("INVITE_ARTIFACT_PATH=PASS\n");
    process.stdout.write("INVITE_ARTIFACT_SINGLE_USE=PASS\n");
  `;
  const revokeBody = String.raw`
    import { appendFile, rm } from "node:fs/promises";
    const argument = (name) => {
      const index = process.argv.indexOf("--" + name);
      return index >= 0 ? process.argv[index + 1] || "" : "";
    };
    await appendFile(process.env.BRIDGE_REVOKE_MARKER, "1", "utf8");
    await rm(argument("artifact"), { force: true });
    await rm(argument("ledger"), { force: true });
    process.stdout.write("INVITE_REVOCATION=PASS\n");
    process.stdout.write("ACTIVE_UNUSED_BASELINE_RESTORED=PASS\n");
    process.stdout.write("PRIVATE_RECOVERY_FILES_REMOVED=PASS\n");
  `;
  const helperBody = String.raw`
    import { rm } from "node:fs/promises";
    import path from "node:path";
    const action = process.argv[2] || "";
    const runDirectory = process.argv[3] || "";
    if (action === "verify-ready") process.exit(0);
    if (action === "remove-status") {
      await rm(path.join(runDirectory, "operator-status.log"), { force: true });
      process.exit(0);
    }
    process.exit(2);
  `;

  await writeFile(path.join(operatorDirectory, "create-registration-invite.mjs"), providerBody, "utf8");
  await writeFile(path.join(operatorDirectory, "verify-registration-invite-artifact.mjs"), verifierBody, "utf8");
  await writeFile(path.join(operatorDirectory, "revoke-registration-invite.mjs"), revokeBody, "utf8");
  await writeFile(path.join(helperDirectory, "controlled-invite-runner-helper.mjs"), helperBody, "utf8");
  return {
    directory,
    operatorDirectory,
    providerMarker: path.join(directory, "provider-count.txt"),
    revokeMarker: path.join(directory, "revoke-count.txt"),
  };
}

function baseEnvironment(value = sentinel) {
  return {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    ComSpec: process.env.ComSpec,
    WINDIR: process.env.WINDIR,
    [CONTROLLED_EMAIL_ENV]: value,
  };
}

async function transport(providerPath, options = {}) {
  let spawnCount = 0;
  let observation;
  const environment = options.environment ?? baseEnvironment();
  const result = await transportControlledEmail({
    rawEmail: options.rawEmail ?? environment[CONTROLLED_EMAIL_ENV],
    environment,
    providerPath,
    providerArguments: options.providerArguments ?? [],
    timeoutMs: options.timeoutMs ?? 5_000,
    shell: options.shell ?? false,
    emailFilePath: options.emailFilePath ?? "",
    spawnImplementation(executable, args, spawnOptions) {
      spawnCount += 1;
      return spawn(executable, args, spawnOptions);
    },
    onProviderSpawned(value) { observation = value; },
  });
  return { result, environment, spawnCount, observation };
}

try {
  const digestProvider = await fixture("digest-provider", String.raw`
    import { createHash } from "node:crypto";
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
    const input = Buffer.concat(chunks);
    const digest = createHash("sha256").update(input).digest("hex");
    const inherited = Object.hasOwn(process.env, "AUTH_E2E_CONTROLLED_EMAIL");
    process.stdout.write("INPUT_SHA256=" + digest + "\n");
    process.stdout.write("CONTROLLED_ENV_PRESENT=" + (inherited ? "YES" : "NO") + "\n");
  `);
  const expectedInput = `${normalizedSentinel}\n`;
  const positive = await transport(digestProvider);
  const expectedDigest = createHash("sha256").update(expectedInput).digest("hex");
  record("VALID_ENVIRONMENT", positive.result.stdout.includes(`INPUT_SHA256=${expectedDigest}`));
  record("CHILD_STDIN_EXACT_NORMALIZED_LF", positive.result.stdout.includes(`INPUT_SHA256=${expectedDigest}`));
  record("CHILD_ENV_SCRUBBED", positive.result.stdout.includes("CONTROLLED_ENV_PRESENT=NO") &&
    !Object.hasOwn(positive.observation.childEnvironment, CONTROLLED_EMAIL_ENV));
  record("SHELL_FALSE", positive.observation.shell === false);
  record("OPERATOR_EXECUTED_ONCE", positive.spawnCount === 1);
  record("PARENT_ENV_REMOVED_AFTER_SPAWN", !Object.hasOwn(positive.environment, CONTROLLED_EMAIL_ENV));
  record("EMAIL_NOT_IN_ARGV", !positive.observation.childArguments.some((value) => value.includes(normalizedSentinel)));
  record("EMAIL_NOT_IN_OUTPUT", !`${positive.result.stdout}\n${positive.result.stderr}`.includes(normalizedSentinel));

  const v158SuccessOutput = [
    "CONTROLLED_EMAIL_BRIDGE=PASS",
    "CONTROLLED_EMAIL_TRANSPORT=PASS",
    "CHILD_ENV_SCRUBBED=PASS",
    "INVITE_CREATE=PASS",
    "ARTIFACT_STATE=READY_FOR_PRIVATE_DOWNLOAD",
    "PRIVATE_FILE_READY=PASS",
    "EXIT_CODE=0",
  ];
  record("V158_FIXED_OUTPUT_MISMATCH_REPRODUCED",
    JSON.stringify(v158SuccessOutput) !== JSON.stringify(BRIDGE_SUCCESS_OUTPUT) &&
    !v158SuccessOutput.includes("ARTIFACT_VERIFY=PASS") &&
    !v158SuccessOutput.includes("RECOVERY_LEDGER=PASS"));

  const successFixture = await operatorFixture("top-level-success");
  const successEnvironment = {
    ...baseEnvironment(),
    BETTER_AUTH_URL: "https://portal.example.test",
    TMPDIR: successFixture.directory,
    BRIDGE_PROVIDER_MARKER: successFixture.providerMarker,
    BRIDGE_REVOKE_MARKER: successFixture.revokeMarker,
  };
  const bridgeSuccess = await runControlledAuthE2E({
    environment: successEnvironment,
    operatorDirectory: successFixture.operatorDirectory,
    timeoutMs: 5_000,
  });
  const serializedSuccess = serializeBridgeSuccess(bridgeSuccess);
  record("BRIDGE_SUCCESS_OUTPUT_CONTRACT",
    serializedSuccess === `${BRIDGE_SUCCESS_OUTPUT.join("\n")}\n` &&
    serializedSuccess.includes("ARTIFACT_VERIFY=PASS\n") &&
    serializedSuccess.includes("RECOVERY_LEDGER=PASS\n"));
  record("BRIDGE_SUCCESS_OUTPUT_REDACTED", !serializedSuccess.includes(sentinel));
  record("TOP_LEVEL_PROVIDER_EXECUTED_ONCE", await readFile(successFixture.providerMarker, "utf8") === "1");
  await rm(path.join(successFixture.directory, "oldmike-controlled-invite"), {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });

  const recoveryFixture = await operatorFixture("post-create-output-failure", { extraProviderLine: true });
  const recoveryEnvironment = {
    ...baseEnvironment(),
    BETTER_AUTH_URL: "https://portal.example.test",
    TMPDIR: recoveryFixture.directory,
    BRIDGE_PROVIDER_MARKER: recoveryFixture.providerMarker,
    BRIDGE_REVOKE_MARKER: recoveryFixture.revokeMarker,
  };
  let recoveryError;
  try {
    await runControlledAuthE2E({
      environment: recoveryEnvironment,
      operatorDirectory: recoveryFixture.operatorDirectory,
      timeoutMs: 5_000,
    });
  } catch (error) {
    recoveryError = error;
  }
  record("POST_CREATE_OUTPUT_FAILURE_CLASSIFIED",
    recoveryError instanceof ControlledEmailBridgeError &&
    recoveryError.category === "CONTROLLED_EMAIL_PROVIDER_OUTPUT_CONTRACT" &&
    recoveryError.stage === "PROVIDER_OUTPUT_CONTRACT");
  record("POST_CREATE_EXACT_REVOKE",
    recoveryError?.recoveryExactRevoke === "PASS" &&
    await readFile(recoveryFixture.revokeMarker, "utf8") === "1");
  record("POST_CREATE_PRIVATE_CLEANUP",
    recoveryError?.privateRecoveryFilesRemoved === "PASS" &&
    await access(path.join(recoveryFixture.directory, "oldmike-controlled-invite")).then(() => false, () => true));
  record("POST_CREATE_NO_AUTOMATIC_RETRY", await readFile(recoveryFixture.providerMarker, "utf8") === "1");

  const missingEnvironment = baseEnvironment();
  delete missingEnvironment[CONTROLLED_EMAIL_ENV];
  const missingDirect = spawnSync(process.execPath, [bridgePath], {
    cwd: path.dirname(bridgePath),
    env: missingEnvironment,
    encoding: "utf8",
    windowsHide: true,
    timeout: 5_000,
  });
  const expectedMissingOutput = [
    "INVITE_CREATE=FAIL",
    "ARTIFACT_VERIFY=FAIL",
    "RECOVERY_LEDGER=FAIL",
    "PRIVATE_FILE_READY=FAIL",
    "FAILED_STAGE=CONTROLLED_EMAIL_INPUT",
    "ERROR_CATEGORY=CONTROLLED_EMAIL_NOT_INJECTED",
    "RECOVERY_EXACT_REVOKE=NOT_REQUIRED",
    "PRIVATE_RECOVERY_FILES_REMOVED=PASS",
    "AUTOMATIC_RETRY=DISABLED",
    "EXIT_CODE=2",
  ];
  record("BRIDGE_FAILURE_OUTPUT_CONTRACT",
    missingDirect.status === 2 && missingDirect.stderr === "" &&
    missingDirect.stdout === `${expectedMissingOutput.join("\n")}\n`);

  await expectCategory("MISSING_ENV_FAIL_CLOSED", "CONTROLLED_EMAIL_NOT_INJECTED", () =>
    transportControlledEmail({
      rawEmail: undefined,
      environment: baseEnvironment(),
      providerPath: digestProvider,
      providerArguments: [],
    }));
  await expectCategory("EMPTY_ENV_FAIL_CLOSED", "CONTROLLED_EMAIL_INVALID", () =>
    transportControlledEmail({ rawEmail: "", environment: baseEnvironment(""), providerPath: digestProvider, providerArguments: [] }));

  for (const [name, value, category] of [
    ["INVALID_EMAIL_FAIL_CLOSED", "invalid", "CONTROLLED_EMAIL_INVALID"],
    ["LEADING_AMBIGUITY_FAIL_CLOSED", ` ${sentinel}`, "CONTROLLED_EMAIL_INVALID"],
    ["TRAILING_AMBIGUITY_FAIL_CLOSED", `${sentinel} `, "CONTROLLED_EMAIL_INVALID"],
    ["CR_FAIL_CLOSED", `${sentinel}\r`, "CONTROLLED_EMAIL_CONTROL_CHARACTER"],
    ["LF_FAIL_CLOSED", `${sentinel}\n`, "CONTROLLED_EMAIL_CONTROL_CHARACTER"],
    ["NUL_FAIL_CLOSED", `${sentinel}\u0000`, "CONTROLLED_EMAIL_CONTROL_CHARACTER"],
    ["CONTROL_CHARACTER_FAIL_CLOSED", `${sentinel}\u0007`, "CONTROLLED_EMAIL_CONTROL_CHARACTER"],
    ["OVERSIZED_FAIL_CLOSED", `${"a".repeat(245)}@example.test`, "CONTROLLED_EMAIL_INVALID"],
  ]) {
    await expectCategory(name, category, () => Promise.resolve(normalizeControlledEmail(value)));
  }

  const timeoutProvider = await fixture("timeout-provider", "setTimeout(() => process.exit(0), 10000);\n");
  await expectCategory("CHILD_TIMEOUT_FAIL_CLOSED", "CONTROLLED_EMAIL_BRIDGE_TIMEOUT", () =>
    transport(timeoutProvider, { timeoutMs: 50 }));

  const nonzeroProvider = await fixture("nonzero-provider", "process.stdin.resume(); process.stdin.on('end', () => process.exit(7));\n");
  await expectCategory("CHILD_NONZERO_FAIL_CLOSED", "CONTROLLED_EMAIL_CHILD_FAILURE", () => transport(nonzeroProvider));

  const signalProvider = await fixture("signal-provider", "process.stdin.resume(); process.stdin.on('end', () => process.kill(process.pid, 'SIGTERM'));\n");
  await expectCategory("CHILD_SIGNAL_FAIL_CLOSED", "CONTROLLED_EMAIL_CHILD_FAILURE", () => transport(signalProvider));

  await expectCategory("EMAIL_ARGV_FAIL_CLOSED", "CONTROLLED_EMAIL_TRANSPORT_POLICY", () =>
    transport(digestProvider, { providerArguments: [normalizedSentinel] }));
  await expectCategory("SHELL_TRUE_FAIL_CLOSED", "CONTROLLED_EMAIL_TRANSPORT_POLICY", () =>
    transport(digestProvider, { shell: true }));
  await expectCategory("EMAIL_FILE_FAIL_CLOSED", "CONTROLLED_EMAIL_TRANSPORT_POLICY", () =>
    transport(digestProvider, { emailFilePath: path.join(temporary, "forbidden-email.txt") }));

  const leakingProvider = await fixture("leaking-provider", String.raw`
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
    process.stdout.write(Buffer.concat(chunks));
  `);
  await expectCategory("STDOUT_LEAK_FAIL_CLOSED", "CONTROLLED_EMAIL_OUTPUT_LEAK", () => transport(leakingProvider));

  const stderrLeakingProvider = await fixture("stderr-leaking-provider", String.raw`
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
    process.stderr.write(Buffer.concat(chunks));
  `);
  await expectCategory("STDERR_LEAK_FAIL_CLOSED", "CONTROLLED_EMAIL_OUTPUT_LEAK", () => transport(stderrLeakingProvider));

  const bridgeSource = await readFile(bridgePath, "utf8");
  const operatorSource = await readFile(operatorPath, "utf8");
  record("OPERATOR_STDIN_ONLY_UNCHANGED", operatorSource.includes("email_stdin_required") &&
    operatorSource.includes("process.stdin.isTTY") && !operatorSource.includes(CONTROLLED_EMAIL_ENV));
  record("BRIDGE_USES_SPAWN", /\bspawn\(/.test(bridgeSource) && !/\bexec(?:Sync|FileSync)?\(/.test(bridgeSource));
  record("BRIDGE_NO_TTY_OR_SHELL_COMMAND", !/(?:\/dev\/tty|\bstty\b|heredoc|Invoke-Expression|cmd \/c)/i.test(bridgeSource));
  record("BRIDGE_NO_EMAIL_TEMP_FILE", !/writeFile\([^\n]*(?:rawEmail|normalizedEmail)/.test(bridgeSource));
  record("PROVIDER_ENV_REMOVAL_CONTRACT", bridgeSource.includes(`delete childEnvironment[CONTROLLED_EMAIL_ENV]`) &&
    bridgeSource.includes(`delete environment[CONTROLLED_EMAIL_ENV]`));
  record("TRANSPORT_SHELL_FALSE_CONTRACT", bridgeSource.includes("shell: false"));
  record("SINGLE_PROVIDER_INVOCATION_CONTRACT", (bridgeSource.match(/await transportControlledEmail\(\{/g) ?? []).length === 1);

  const privateOutputs = path.join(temporary, "private-outputs");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(privateOutputs));
  const files = ["artifact.json", "ledger.json", "audit.log", "runtime.log"];
  for (const file of files) await writeFile(path.join(privateOutputs, file), "REDACTED=PASS\n", "utf8");
  const noLeak = (await Promise.all(files.map((file) => readFile(path.join(privateOutputs, file), "utf8"))))
    .every((value) => !value.includes(sentinel) && !value.includes(normalizedSentinel));
  record("ARTIFACT_LEDGER_AUDIT_LOG_LEAK_SCAN", noLeak);

  const forbidden = path.join(privateOutputs, "negative-artifact.json");
  await writeFile(forbidden, sentinel, "utf8");
  const negativeDetected = (await readFile(forbidden, "utf8")).includes(sentinel);
  record("NEGATIVE_PRIVATE_FILE_LEAK_DETECTED", negativeDetected);
  await rm(forbidden, { force: true });

  const sourceScanTargets = [bridgePath, operatorPath];
  const sourceScan = (await Promise.all(sourceScanTargets.map((file) => readFile(file, "utf8"))))
    .every((value) => !value.includes(sentinel) && !value.includes(normalizedSentinel));
  record("SOURCE_SENTINEL_SCAN", sourceScan);
} finally {
  await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

for (const [name, pass] of Object.entries(results)) console.log(`${name}=${pass ? "PASS" : "FAIL"}`);
const allPass = Object.values(results).length >= 30 && Object.values(results).every(Boolean);
console.log(`CONTROLLED_EMAIL_BRIDGE_CONTRACT=${allPass ? "PASS" : "FAIL"}`);
process.exit(allPass ? 0 : 2);
