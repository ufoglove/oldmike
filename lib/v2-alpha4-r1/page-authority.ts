import "server-only";

import { sha256Zotero } from "./zotero-contracts.ts";

export const V2_ALPHA4_R1_PROJECT_REF_HASH = sha256Zotero("fixture-workspace-v2:fixture-alpha4-r1-project");
export const V2_ALPHA4_R1_ROUTE_CONTRACT = "old-mike-v2-alpha4-r1/zotero-route/1" as const;
