import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertReleaseVersionMatch,
  readReleaseContract,
  releaseArtifactLabel,
  releaseContractHash,
  releaseIdentity,
} from "./release-identity-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = await readReleaseContract(path.join(root, "release-identity.json"));
const identity = releaseIdentity(contract);
const hash = releaseContractHash(contract);
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const staleFixture = JSON.parse(await readFile(path.join(root, "scripts", "fixtures", "release-identity", "stale-version.json"), "utf8"));
const healthSource = await readFile(path.join(root, "app", "api", "health", "route.ts"), "utf8");
const nextConfig = await readFile(path.join(root, "next.config.ts"), "utf8");

assert.match(hash, /^[a-f0-9]{64}$/);
assert.equal(identity, `${contract.service}/${contract.version}/${hash}`);
assert.equal(assertReleaseVersionMatch(contract, packageJson.version, "PACKAGE_JSON"), contract.version);
assert.equal(staleFixture.version, "1.5.29");
assert.throws(
  () => assertReleaseVersionMatch(contract, staleFixture.version, "STALE_VERSION_FIXTURE"),
  /RELEASE_VERSION_MISMATCH:STALE_VERSION_FIXTURE/u,
);
assert.equal(releaseArtifactLabel(contract), `${contract.version}-${contract.buildId.toLowerCase()}`);
assert.match(healthSource, /RELEASE_IDENTITY/);
assert.match(healthSource, /releaseIdentity:\s*RELEASE_IDENTITY/);
assert.match(healthSource, /no-store, no-cache, must-revalidate, max-age=0/);
assert.match(healthSource, /CDN-Cache-Control/);
assert.match(nextConfig, /deploymentId:\s*releaseContractHash/);
assert.match(nextConfig, /buildId:\s*releaseContract\.buildId/);
assert.doesNotMatch(identity, /token|secret|password|postgres(?:ql)?:\/\//i);

console.log(`RELEASE_IDENTITY=${identity}`);
console.log("RELEASE_IDENTITY_CONTRACT=PASS");
console.log("RELEASE_VERSION_SINGLE_AUTHORITY=PASS");
console.log("STALE_VERSION_NEGATIVE_FIXTURE=PASS");
console.log("HEALTH_NO_STORE_CONTRACT=PASS");
