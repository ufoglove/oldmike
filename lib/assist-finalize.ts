import type { EvidenceCenterResponse, HorizonRadarResponse, SourceRef, TopicLabResponse } from "./assist-contract.ts";
import { SOURCE_SEARCH_NOT_CONNECTED_EXACT, verifySourceCandidates, type SourceCandidate } from "./source-verifier.ts";

export type AssistVerificationFailure = { kind: "blocked"; message: string };

function sourceCandidates(sources: SourceRef[]): SourceCandidate[] {
  return sources.map((source) => ({
    title: source.title,
    url: source.url,
    sourceType: source.sourceType,
    status: "UNVERIFIED",
    publisher: source.publisher,
    publishedAt: source.publishedAt,
    doi: source.doi,
  }));
}

function key(source: Pick<SourceRef, "title" | "url">) {
  return `${source.url}\u0000${source.title}`;
}

function unverifiedSource(source: SourceRef): SourceRef {
  return { ...source, status: "UNVERIFIED", sourceIdentityStatus: "UNVERIFIED", claimSupportStatus: "CLAIM_UNVERIFIED", verificationMethod: "llm_claim_only", verificationOutcome: "UNVERIFIED" };
}

async function verifiedMap(sources: SourceRef[]) {
  const result = await verifySourceCandidates(sourceCandidates(sources));
  if (result.status === "blocked") return { failure: { kind: "blocked" as const, message: result.message || SOURCE_SEARCH_NOT_CONNECTED_EXACT } };
  return { sources: result.sources, byKey: new Map(result.sources.map((source) => [key(source), source])) };
}

export async function finalizeTopicLab(data: TopicLabResponse, requireFreshVerification = false): Promise<TopicLabResponse | AssistVerificationFailure> {
  if (data.status !== "success" || !data.candidates?.length) return data;
  if (!requireFreshVerification) {
    return { ...data, mode: "AI_PROPOSED", candidates: data.candidates.map((candidate) => ({ ...candidate, noveltyStatus: candidate.noveltyStatus === "SUPPORTED" ? "UNVERIFIED" : candidate.noveltyStatus, sources: candidate.sources.map(unverifiedSource) })) };
  }
  const all = data.candidates.flatMap((candidate) => candidate.sources);
  const verified = await verifiedMap(all);
  if (verified.failure) return verified.failure;
  const candidates = data.candidates.map((candidate) => ({ ...candidate, sources: candidate.sources.map((source) => verified.byKey.get(key(source)) || unverifiedSource(source)) }));
  if (candidates.some((candidate) => !candidate.sources.some((source) => source.sourceIdentityStatus === "SOURCE_METADATA_VERIFIED"))) {
    return { kind: "blocked", message: "Fresh verified 選題需要固定可信研究 API 的來源身分核對；Claim 仍需逐項人工核對。" };
  }
  return { ...data, mode: "UNVERIFIED", candidates };
}

export async function finalizeHorizon(data: HorizonRadarResponse): Promise<HorizonRadarResponse | AssistVerificationFailure> {
  if (data.status !== "success") return data;
  if (!data.items?.length) return { kind: "blocked", message: "前沿雷達沒有可由固定可信 API 核對的來源，已停止顯示趨勢。" };
  const all = data.items.flatMap((item) => item.sources);
  const verified = await verifiedMap(all);
  if (verified.failure) return verified.failure;
  const items = data.items.map((item) => ({ ...item, sources: item.sources.map((source) => verified.byKey.get(key(source)) || unverifiedSource(source)) }));
  // Metadata identity alone never verifies a trend or novelty claim.
  return { ...data, mode: "UNVERIFIED", items, message: "來源身分可分別核對；趨勢與新穎性 claim 尚未核對。" };
}

export async function finalizeEvidence(data: EvidenceCenterResponse): Promise<EvidenceCenterResponse | AssistVerificationFailure> {
  if (data.status !== "success") return data;
  if (!data.sources.length) return { kind: "blocked", message: "尚未取得可驗證來源，Evidence Center 已停止顯示文獻結論。" };
  const verified = await verifiedMap(data.sources);
  if (verified.failure) return verified.failure;
  const sources = data.sources.map((source) => verified.byKey.get(key(source)) || unverifiedSource(source));
  const ledger = data.ledger.map((row) => {
    const source = sources.find((item) => item.url === row.url || item.title === row.sourceTitle);
    if (!source) return { ...row, verificationStatus: "BLOCKED" as const, sourceIdentityStatus: "BLOCKED" as const, claimSupportStatus: "BLOCKED" as const, verificationMethod: "blocked" as const, verificationOutcome: "BLOCKED" as const, retrievedAt: "", resolvedUrl: row.url };
    return {
      ...row,
      verificationStatus: "UNVERIFIED" as const,
      sourceIdentityStatus: source.sourceIdentityStatus,
      claimSupportStatus: "CLAIM_UNVERIFIED" as const,
      verificationMethod: source.verificationMethod || "not_connected",
      retrievedAt: source.retrievedAt || "",
      resolvedUrl: source.resolvedUrl || source.url,
      doi: source.doi,
      verificationOutcome: source.verificationOutcome || source.sourceIdentityStatus,
    };
  });
  return { ...data, mode: "UNVERIFIED", sources, ledger, message: "來源身分與 claim 支持狀態分開顯示；claim 尚待可定位證據與人工核對。" };
}
