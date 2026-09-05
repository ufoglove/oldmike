import "server-only";

import { taskGatewayHash } from "./task-gateway-contract.ts";

export type AuthorizedProjectTaskContextBase = {
  tenantId: string;
  projectId: string;
  project: {
    title: string;
    status: "ACTIVE";
    storageBackend: "POSTGRES_INDEX_PENDING_SAFE_STORAGE" | "OPENCLAW_CONTROLLED";
  };
  documents: Array<{
    logicalId: string;
    version: number;
    type: "RESEARCH_PLAN" | "MANUSCRIPT" | "RESPONSE_TO_REVIEWERS";
    title: string;
    stage: string;
    contentHash: string;
    body: string;
  }>;
  workflowEvents: Array<{
    fromStage: string;
    toStage: string;
    stageDetail: string | null;
    eventHash: string;
  }>;
};

export type AuthorizedProjectTaskContext = AuthorizedProjectTaskContextBase & { contextHash: string };

export function authorizedProjectContextHash(value: AuthorizedProjectTaskContextBase) {
  return taskGatewayHash(value);
}
