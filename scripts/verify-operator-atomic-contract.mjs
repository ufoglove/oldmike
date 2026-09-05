import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ARTIFACT_CONTRACT_VERSION,
  MAX_ARTIFACT_BYTES,
  REGISTRATION_PATH,
  assertStateTransition,
  atomicWritePrivateJson,
  readPrivateJson,
  validateInvitationArtifact,
} from "./operator/registration-invite-atomic.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "oldmike-atomic-contract-"));
const privateDirectory = path.join(temporaryRoot, "private");
await mkdir(privateDirectory, { mode: 0o700 });
const origin = "https://oldmike-research.zeabur.app";
const credential = "A".repeat(43);
const valid = {
  contractVersion: ARTIFACT_CONTRACT_VERSION,
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  singleUse: true,
  portalOrigin: origin,
  registrationPath: REGISTRATION_PATH,
  inviteCredential: credential,
};

try {
  assert.equal(validateInvitationArtifact(valid, origin).pass, true);
  assert.equal(validateInvitationArtifact({ ...valid, unexpected: true }, origin).pass, false, "extra fields must fail");
  assert.equal(validateInvitationArtifact({ ...valid, inviteCredential: `${credential} https://second.invalid` }, origin).pass, false, "second URL must fail");
  assert.equal(validateInvitationArtifact({ ...valid, portalOrigin: "http://oldmike-research.zeabur.app" }, origin).pass, false);
  assert.equal(validateInvitationArtifact({ ...valid, portalOrigin: "https://wrong.example" }, origin).pass, false);
  assert.equal(validateInvitationArtifact({ ...valid, registrationPath: "/other" }, origin).pass, false);

  const artifact = path.join(privateDirectory, "invite.json");
  const written = await atomicWritePrivateJson(artifact, valid, MAX_ARTIFACT_BYTES);
  assert.ok(written.bytes > 0 && written.bytes <= MAX_ARTIFACT_BYTES);
  const roundTrip = await readPrivateJson(artifact, MAX_ARTIFACT_BYTES);
  assert.deepEqual(roundTrip.value, valid);
  if (process.platform !== "win32") assert.equal(roundTrip.info.mode & 0o777, 0o600);

  const oversized = { ...valid, inviteCredential: "A".repeat(MAX_ARTIFACT_BYTES + 1) };
  await assert.rejects(() => atomicWritePrivateJson(path.join(privateDirectory, "oversized.json"), oversized, MAX_ARTIFACT_BYTES));

  const missingParentOutput = path.join(temporaryRoot, "missing", "artifact.json");
  await assert.rejects(() => atomicWritePrivateJson(missingParentOutput, valid, MAX_ARTIFACT_BYTES));
  await assert.rejects(() => stat(missingParentOutput), /ENOENT/);

  const target = path.join(privateDirectory, "target.json");
  await writeFile(target, "{}", { mode: 0o600 });
  const link = path.join(privateDirectory, "link.json");
  try {
    await symlink(target, link, "file");
    await assert.rejects(() => atomicWritePrivateJson(link, valid, MAX_ARTIFACT_BYTES));
  } catch (error) {
    if (!["EPERM", "EACCES", "UNKNOWN"].includes(error?.code)) throw error;
  }

  let state = "NOT_CREATED";
  for (const next of [
    "DB_ROW_TRACKED",
    "ARTIFACT_VALIDATED",
    "READY_FOR_PRIVATE_DOWNLOAD",
    "DOWNLOADED_LOCAL_SECURE",
    "REMOTE_REMOVED",
    "INVITE_CONSUMED_OR_REVOKED",
    "LOCAL_REMOVED",
  ]) state = assertStateTransition(state, next);
  assert.equal(state, "LOCAL_REMOVED");
  assert.throws(() => assertStateTransition("NOT_CREATED", "READY_FOR_PRIVATE_DOWNLOAD"));

  const schema = JSON.parse(await readFile(path.join(root, "scripts", "operator", "registration-invite-artifact.schema.json"), "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual([...schema.required].sort(), Object.keys(valid).sort());
  assert.equal(schema.properties.singleUse.const, true);
  assert.equal(schema.properties.registrationPath.const, "/register");

  const runtimeManifest = JSON.parse(await readFile(path.join(root, "scripts", "operator", "operator-runtime-manifest.json"), "utf8"));
assert.equal(runtimeManifest.contractVersion, "old-mike.operator-runtime-manifest.v3");
  for (const [relative, expectedHash] of Object.entries(runtimeManifest.files)) {
    const contents = await readFile(path.join(root, "scripts", ...relative.split("/")));
    assert.equal(createHash("sha256").update(contents).digest("hex"), expectedHash, `${relative} must match the fixed runtime allowlist`);
  }

  const createSource = await readFile(path.join(root, "scripts", "create-registration-invite.mjs"), "utf8");
  const verifierSource = await readFile(path.join(root, "scripts", "verify-registration-invite-artifact.mjs"), "utf8");
  assert.match(createSource, /atomicWritePrivateJson/);
  assert.match(createSource, /post_commit/);
  assert.match(createSource, /compensateExact/);
  assert.match(createSource, /BETTER_AUTH_URL/);
  assert.match(createSource, /artifactSha256 !== sha256Buffer/);
  assert.doesNotMatch(createSource, /Recipient:|Invite URL \(shown once\)/);
  assert.doesNotMatch(verifierSource, /console\.log\([^\n]*(?:inviteCredential|portalOrigin|contents)/);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

console.log("operator output atomic contract: PASS (strict JSON, atomic private write, state machine, no secret-bearing output)");
