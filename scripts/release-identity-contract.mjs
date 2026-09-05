import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export const RELEASE_IDENTITY_CONTRACT_VERSION = "old-mike.release-identity.v2";

export function canonicalReleaseContract(contract) {
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
    throw new Error("RELEASE_IDENTITY_RESULT_SHAPE");
  }
  const expectedKeys = [
    "buildId",
    "contractVersion",
    "postgresSchema",
    "researchWorkflowContractVersion",
    "service",
    "version",
  ];
  if (JSON.stringify(Object.keys(contract).sort()) !== JSON.stringify(expectedKeys)) {
    throw new Error("RELEASE_IDENTITY_EXTRA_OR_MISSING_FIELD");
  }
  const canonical = {
    contractVersion: contract.contractVersion,
    service: contract.service,
    version: contract.version,
    buildId: contract.buildId,
    researchWorkflowContractVersion: contract.researchWorkflowContractVersion,
    postgresSchema: contract.postgresSchema,
  };
  if (
    canonical.contractVersion !== RELEASE_IDENTITY_CONTRACT_VERSION ||
    canonical.service !== "old-mike-research-portal" ||
    !/^\d+\.\d+\.\d+$/u.test(canonical.version) ||
    !/^[A-Z][A-Z0-9-]{0,31}$/u.test(canonical.buildId) ||
    !/^\d+\.\d+\.\d+$/u.test(canonical.researchWorkflowContractVersion) ||
    !/^\d{4}$/u.test(canonical.postgresSchema)
  ) {
    throw new Error("RELEASE_IDENTITY_CONTRACT_INVALID");
  }
  return canonical;
}

export function releaseContractHash(contract) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalReleaseContract(contract)), "utf8")
    .digest("hex");
}

export function releaseIdentity(contract) {
  const canonical = canonicalReleaseContract(contract);
  return `${canonical.service}/${canonical.version}/${releaseContractHash(canonical)}`;
}

export function assertReleaseVersionMatch(contract, observedVersion, field = "OBSERVED_VERSION") {
  const canonical = canonicalReleaseContract(contract);
  if (observedVersion !== canonical.version) {
    throw new Error(`RELEASE_VERSION_MISMATCH:${field}`);
  }
  return observedVersion;
}

export function releaseArtifactLabel(contract) {
  const canonical = canonicalReleaseContract(contract);
  return `${canonical.version}-${canonical.buildId.toLowerCase()}`;
}

export function releaseArchiveAuthority(contract) {
  const canonical = canonicalReleaseContract(contract);
  const artifactLabel = releaseArtifactLabel(canonical);
  return Object.freeze({
    artifactLabel,
    directoryName: `.release-v${artifactLabel}-final`,
    portalArchiveName: `Old_Mike_Research_Portal_v${artifactLabel}.zip`,
    workspaceArchiveName: `Old_Mike_Codex_Workspace_v${artifactLabel}.zip`,
  });
}

export async function readReleaseContract(filename) {
  return canonicalReleaseContract(JSON.parse(await readFile(filename, "utf8")));
}
