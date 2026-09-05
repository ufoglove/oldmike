import { createHash } from "node:crypto";
import releaseContract from "@/release-identity.json";

export const RELEASE_IDENTITY_CONTRACT_VERSION = "old-mike.release-identity.v2";

const canonicalContract = {
  contractVersion: releaseContract.contractVersion,
  service: releaseContract.service,
  version: releaseContract.version,
  buildId: releaseContract.buildId,
  researchWorkflowContractVersion: releaseContract.researchWorkflowContractVersion,
  postgresSchema: releaseContract.postgresSchema,
};

if (
  canonicalContract.contractVersion !== RELEASE_IDENTITY_CONTRACT_VERSION ||
  canonicalContract.service !== "old-mike-research-portal" ||
  !/^\d+\.\d+\.\d+$/u.test(canonicalContract.version) ||
  !/^[A-Z][A-Z0-9-]{0,31}$/u.test(canonicalContract.buildId) ||
  !/^\d+\.\d+\.\d+$/u.test(canonicalContract.researchWorkflowContractVersion) ||
  !/^\d{4}$/u.test(canonicalContract.postgresSchema)
) {
  throw new Error("RELEASE_IDENTITY_CONTRACT_INVALID");
}

export const RELEASE_CONTRACT_HASH = createHash("sha256")
  .update(JSON.stringify(canonicalContract), "utf8")
  .digest("hex");

export const RELEASE_IDENTITY =
  `${canonicalContract.service}/${canonicalContract.version}/${RELEASE_CONTRACT_HASH}`;

export const RELEASE_VERSION = canonicalContract.version;
export const RELEASE_BUILD_ID = canonicalContract.buildId;
