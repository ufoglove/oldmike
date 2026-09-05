import "server-only";

import { assertOfficialSourceUrl } from "./journal-submission-contract.ts";

export const JOURNAL_SOURCE_NETWORK_CONTRACT_VERSION = "journal-source-network/1.0.0";

export type JournalSourceRequestDescriptor = {
  contractVersion: typeof JOURNAL_SOURCE_NETWORK_CONTRACT_VERSION;
  method: "GET";
  url: string;
  redirect: "error";
  credentials: "omit";
  cookies: false;
  javascript: false;
  authenticatedPageAccess: false;
  privateNetworkAccess: false;
  maximumBytes: 1_000_000;
  timeoutMs: 10_000;
  observationState: "UNVERIFIED";
  promptInjectionIsolation: true;
};

export function buildJournalSourceRequestDescriptor(sourceUrl: unknown): JournalSourceRequestDescriptor {
  return {
    contractVersion: JOURNAL_SOURCE_NETWORK_CONTRACT_VERSION,
    method: "GET",
    url: assertOfficialSourceUrl(sourceUrl),
    redirect: "error",
    credentials: "omit",
    cookies: false,
    javascript: false,
    authenticatedPageAccess: false,
    privateNetworkAccess: false,
    maximumBytes: 1_000_000,
    timeoutMs: 10_000,
    observationState: "UNVERIFIED",
    promptInjectionIsolation: true,
  };
}
