import assert from "node:assert/strict";
import {
  hasNoGroupOrOtherWrite,
  packagedArtifactIntegrity,
  runtimePrivateDirectoryIntegrity,
  runtimePrivateOutputIntegrity,
} from "./operator/controlled-owner-policy.mjs";
import path from "node:path";

const expectedPath = "/runtime/operator/run-controlled-invite.sh";
const privateDirectory = "/tmp/oldmike-controlled-invite";
const outputPath = `${privateDirectory}/invitation.json`;
const parentChain = [
  { isDirectory: true, isSymbolicLink: false, mode: 0o755 },
  { isDirectory: true, isSymbolicLink: false, mode: 0o755 },
];

function packaged(overrides = {}) {
  return packagedArtifactIntegrity({
    expectedPath,
    actualPath: expectedPath,
    info: {
      isFile: true,
      isSymbolicLink: false,
      nlink: 1,
      uid: 1000,
      mode: 0o700,
    },
    canonicalPath: path.resolve(expectedPath),
    expectedSha256: "a".repeat(64),
    actualSha256: "a".repeat(64),
    parentChain,
    platform: "linux",
    ...overrides,
  });
}

assert.equal(packaged({}), true, "runtime UID 0 must accept packaged UID 1000");
assert.equal(packaged({ info: { isFile: true, isSymbolicLink: false, nlink: 1, uid: 1000, mode: 0o702 } }), false);
assert.equal(packaged({ actualSha256: "b".repeat(64) }), false);
assert.equal(packaged({ info: { isFile: true, isSymbolicLink: true, nlink: 1, uid: 1000, mode: 0o700 } }), false);
assert.equal(packaged({ info: { isFile: true, isSymbolicLink: false, nlink: 2, uid: 1000, mode: 0o700 } }), false);
assert.equal(packaged({ parentChain: [{ isDirectory: true, isSymbolicLink: false, mode: 0o757 }] }), false);
assert.equal(hasNoGroupOrOtherWrite(0o700, "linux"), true);
assert.equal(hasNoGroupOrOtherWrite(0o702, "linux"), false);

const runtimeUid = 0;
assert.equal(runtimePrivateDirectoryIntegrity({
  runtimeUid,
  expectedPath: privateDirectory,
  canonicalPath: path.resolve(privateDirectory),
  info: { isDirectory: true, isSymbolicLink: false, uid: 0, mode: 0o700 },
}), true);
assert.equal(runtimePrivateDirectoryIntegrity({
  runtimeUid,
  expectedPath: privateDirectory,
  canonicalPath: path.resolve(privateDirectory),
  info: { isDirectory: true, isSymbolicLink: false, uid: 1000, mode: 0o700 },
}), false);
assert.equal(runtimePrivateDirectoryIntegrity({
  runtimeUid,
  expectedPath: privateDirectory,
  canonicalPath: path.resolve(privateDirectory),
  info: { isDirectory: true, isSymbolicLink: false, uid: 0, mode: 0o755 },
}), false);
assert.equal(runtimePrivateOutputIntegrity({
  runtimeUid,
  privateDirectory,
  expectedPath: outputPath,
  canonicalPath: path.resolve(outputPath),
  info: { isFile: true, isSymbolicLink: false, nlink: 1, uid: 0, mode: 0o600 },
  expectedSha256: "c".repeat(64),
  actualSha256: "c".repeat(64),
}), true);
assert.equal(runtimePrivateOutputIntegrity({
  runtimeUid,
  privateDirectory,
  expectedPath: outputPath,
  canonicalPath: path.resolve(outputPath),
  info: { isFile: true, isSymbolicLink: false, nlink: 1, uid: 0, mode: 0o640 },
  expectedSha256: "c".repeat(64),
  actualSha256: "c".repeat(64),
}), false);

console.log("PACKAGED_UID_DIFFERENCE_POLICY=PASS");
console.log("PACKAGED_GROUP_OTHER_WRITE=PASS");
console.log("PACKAGED_HASH_POLICY=PASS");
console.log("PACKAGED_SYMLINK_HARDLINK_POLICY=PASS");
console.log("RUNTIME_PRIVATE_DIRECTORY_OWNER_POLICY=PASS");
console.log("RUNTIME_PRIVATE_DIRECTORY_MODE_POLICY=PASS");
console.log("RUNTIME_PRIVATE_OUTPUT_MODE_POLICY=PASS");
console.log("CONTROLLED_OWNER_CONTRACT=PASS");
