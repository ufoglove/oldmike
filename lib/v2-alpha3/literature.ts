import {
  dedupeNormalizedWorks,
  parseLiteratureConnectorBatch,
  parseDomainSelection,
  parseLiteratureSynthesis,
  sha256Canonical,
  type V2Alpha3DomainSelection,
  type V2Alpha3NormalizedWork,
} from "./contracts.ts";

export function buildV2Alpha3LiteratureJobPlan(input: { domainSelection: V2Alpha3DomainSelection; query: string }) {
  const domain = parseDomainSelection(input.domainSelection);
  const query = input.query.replace(/\r\n?/gu, "\n").trim();
  if (!query || query.length > 1_000) throw new Error("literature_query_invalid");
  const queryHash = sha256Canonical({ domainSelectionHash: domain.selectionHash, query });
  return {
    contractVersion: "old-mike-v2-alpha3/literature-job-plan/1" as const,
    queryHash,
    domainSelectionHash: domain.selectionHash,
    jobs: [
      { operation: "ALPHA3_OPENALEX_QUERY" as const, role: "CONNECTOR_CHILD" as const, effectMaximum: 1, inputResultHashes: [] as string[] },
      { operation: "ALPHA3_SEMANTIC_SCHOLAR_QUERY" as const, role: "CONNECTOR_CHILD" as const, effectMaximum: 1, inputResultHashes: [] as string[] },
      { operation: "ALPHA3_LITERATURE_SYNTHESIS" as const, role: "SYNTHESIS" as const, effectMaximum: 1, inputResultHashes: ["OPENALEX_RESULT_HASH", "SEMANTIC_SCHOLAR_RESULT_HASH"] },
    ],
    multiExternalEffectJobCount: 0,
    synchronousNeonDependency: false,
    n8nDependency: false,
  };
}

export function buildManualGoogleScholarSearchLink(input: { domainLabel: string; query: string }) {
  const domain = input.domainLabel.trim(); const query = input.query.trim();
  if (!domain || !query || domain.length > 120 || query.length > 1_000) throw new Error("manual_search_input_invalid");
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(`${domain} ${query}`)}`;
}

export function synthesizeLocalLiteratureFixtures(input: { domainSelection: V2Alpha3DomainSelection; query: string }) {
  const plan = buildV2Alpha3LiteratureJobPlan(input);
  const openAlex = parseLiteratureConnectorBatch({ schemaId: "old-mike-v2-alpha3/openalex-result/1", coverage: "COMPLETE", works: [
    { source: "OPENALEX", sourceDate: "2026-08-24", doi: "10.5555/alpha3.fixture.1", stableSourceId: "W-FIXTURE-001", title: "Evidence calibration in domain-bound research", year: 2025, firstAuthor: "Lin", citationCount: null, confidence: "MEDIUM", evidenceClass: "OBSERVED" },
    { source: "OPENALEX", sourceDate: "2026-08-24", doi: null, stableSourceId: "W-FIXTURE-002", title: "Mechanism-first research design under uncertainty", year: 2024, firstAuthor: "Chen", citationCount: 2, confidence: "LOW", evidenceClass: "OBSERVED" },
  ], limitations: [], additiveReceipt: "ignored" }, "OPENALEX");
  const semanticScholar = parseLiteratureConnectorBatch({ schemaId: "old-mike-v2-alpha3/semantic-scholar-result/1", coverage: "PARTIAL", works: [
    { source: "SEMANTIC_SCHOLAR", sourceDate: "2026-08-24", doi: "10.5555/alpha3.fixture.1", stableSourceId: "S2-FIXTURE-001", title: "Evidence calibration in domain-bound research", year: 2025, firstAuthor: "Lin", citationCount: null, confidence: "MEDIUM", evidenceClass: "OBSERVED" },
    { source: "SEMANTIC_SCHOLAR", sourceDate: "2026-08-24", doi: null, stableSourceId: "S2-FIXTURE-002", title: "Mechanism-first research design under uncertainty", year: 2024, firstAuthor: "Chen", citationCount: null, confidence: "LOW", evidenceClass: "OBSERVED" },
  ], limitations: ["Synthetic source coverage is partial."] }, "SEMANTIC_SCHOLAR");
  const deduped = dedupeNormalizedWorks([...openAlex.works, ...semanticScholar.works]);
  const synthesis = parseLiteratureSynthesis({
    observed: { coverage: "PARTIAL", works: deduped.accepted, limitations: ["這是本機合成 metadata；未執行任何即時學術來源查詢。", "來源覆蓋不完整，疑似重複項目需人工核對。"] },
    forecasts: [
      { horizon: "YEARS_1_3", confidence: "MEDIUM", assumptions: ["後續可取得公開 metadata"], invalidationConditions: ["主要構念或場域改變"], statement: "短期方向僅是依目前概念與本機 metadata 形成的待驗證推估。" },
      { horizon: "YEARS_4_6", confidence: "LOW", assumptions: ["方法與資料治理逐步成熟"], invalidationConditions: ["實證結果不支持核心機制"], statement: "中期方向需要新的觀察證據才能提高信心。" },
      { horizon: "YEARS_7_10", confidence: "LOW", assumptions: ["跨域基礎設施與研究倫理可持續"], invalidationConditions: ["技術路徑或政策環境根本改變"], statement: "長期方向只作情境規劃，不是趨勢事實。" },
    ],
  });
  return { plan, synthesis, sourceBatches: [{ source: openAlex.source, coverage: openAlex.coverage, acceptedCount: openAlex.works.length, invalidCount: openAlex.issues.length }, { source: semanticScholar.source, coverage: semanticScholar.coverage, acceptedCount: semanticScholar.works.length, invalidCount: semanticScholar.issues.length }], dedupe: { exactDuplicateCount: deduped.exactDuplicates.length, possibleDuplicateReviewCount: deduped.possibleDuplicates.length }, connectorCoverage: { OPENALEX: "SYNTHETIC_COMPLETE", SEMANTIC_SCHOLAR: "SYNTHETIC_PARTIAL", CONSENSUS: "DISABLED_AUTH_AND_COST_UNPROVEN" }, networkCalls: 0, scholarlyEgress: 0 };
}
