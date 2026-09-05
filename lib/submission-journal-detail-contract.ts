import "server-only";

export const JOURNAL_DETAIL_CONTRACT_VERSION = "submission-journal-detail/1.0.0" as const;

export class JournalDetailContractError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) {
    super(code);
    this.name = "JournalDetailContractError";
    this.code = code;
    this.status = status;
  }
}

export type JournalDetailRequest = {
  contractVersion: typeof JOURNAL_DETAIL_CONTRACT_VERSION;
  kind: "JOURNAL_DETAIL";
  runId: string;
  journalName: string;
  targetYear: string;
  topicContext: Record<string, unknown>;
};

function text(value: unknown, field: string, max = 500) {
  if (typeof value !== "string") throw new JournalDetailContractError(`invalid_${field}`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) throw new JournalDetailContractError(`invalid_${field}`);
  return trimmed;
}

export function parseJournalDetailRequest(value: unknown): JournalDetailRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new JournalDetailContractError("invalid_request_shape");
  const row = value as Record<string, unknown>;
  if (row.contractVersion !== JOURNAL_DETAIL_CONTRACT_VERSION || row.kind !== "JOURNAL_DETAIL") throw new JournalDetailContractError("invalid_contract_version");
  return {
    contractVersion: JOURNAL_DETAIL_CONTRACT_VERSION,
    kind: "JOURNAL_DETAIL",
    runId: text(row.runId, "run_id", 200),
    journalName: text(row.journalName, "journal_name", 500),
    targetYear: text(row.targetYear, "target_year", 16),
    topicContext: row.topicContext && typeof row.topicContext === "object" && !Array.isArray(row.topicContext) ? (row.topicContext as Record<string, unknown>) : {},
  };
}
