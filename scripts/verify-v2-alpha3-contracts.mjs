import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  V2_ALPHA3_BUILTIN_DOMAINS,
  V2_ALPHA3_CONNECTOR_CAPABILITIES,
  V2_ALPHA3_N8N_TEMPLATE_CONTRACTS,
  V2_ALPHA3_NEON_CACHE_CONTRACT,
  createBuiltinDomainSelection,
  createCustomDomainSelection,
  createInsightCard,
  dedupeNormalizedWorks,
  mapLegacyDomainAlias,
  parseChatTurnResult,
  parseLiteratureConnectorBatch,
  parseLiteratureSynthesis,
  sha256Canonical,
  validateAlpha2PromotionRequest,
  validateCustomProfileContent,
  verifyAlpha2PromotionResult,
} from "../lib/v2-alpha3/contracts.ts";
import { createV2Alpha3ChatCoordinator } from "../lib/v2-alpha3/runtime.ts";

let assertions = 0;
function equal(actual, expected, message) { assertions += 1; assert.deepEqual(actual, expected, message); }
function ok(value, message) { assertions += 1; assert.ok(value, message); }
function throws(operation, pattern, message) { assertions += 1; assert.throws(operation, pattern, message); }

const expectedIds = [
  "ai-cross-disciplinary",
  "ai-education",
  "ai-occupational-safety-training",
  "ai-environment-resource-management",
  "ai-energy-management",
  "xr-cross-disciplinary",
];
const expectedLabels = [
  "AI跨領域應用",
  "AI應用於教育",
  "AI應用於職業安全與教育訓練",
  "AI應用於環境工程與環境資源管理",
  "AI應用於能源管理",
  "VR/AR/XR跨領域應用",
];
equal(V2_ALPHA3_BUILTIN_DOMAINS.map((item) => item.id), expectedIds, "six stable domain ids");
equal(V2_ALPHA3_BUILTIN_DOMAINS.map((item) => item.label), expectedLabels, "six exact labels");
equal(mapLegacyDomainAlias("VR/AR/XR於教育之應用"), { domainId: "xr-cross-disciplinary", rawLabel: "VR/AR/XR於教育之應用", legacyFacet: "EDUCATION" }, "legacy XR education facet");
equal(mapLegacyDomainAlias("VR/AR/XR於職業安全與教育訓練之應用")?.legacyFacet, "OCCUPATIONAL_SAFETY_TRAINING", "legacy XR safety facet");

const legacyBefore = await readFile(new URL("../lib/research-config.ts", import.meta.url), "utf8");
ok(legacyBefore.includes("canonicalDomains"), "legacy domain authority remains present");

const builtin = createBuiltinDomainSelection("ai-education");
const profile = validateCustomProfileContent({ name: "跨域 AI 教學設計", includedKeywords: ["教師決策"], excludedKeywords: ["個人醫療資料"] });
const custom = createCustomDomainSelection({ profileId: "dp_fixture_custom", version: 2, name: profile.name, contentHash: profile.contentHash });
throws(() => validateCustomProfileContent({ name: "跨域", includedKeywords: ["AI"], excludedKeywords: ["ＡＩ"] }), /custom_domain_keyword_duplicate/u, "normalized keyword duplicate rejected");
ok(builtin.selectionHash !== custom.selectionHash, "selection hash binds exact profile");

const insight = createInsightCard({
  kind: "direction",
  title: "教師如何校準 AI 建議與課程證據",
  researchQuestion: "教師在何種證據條件下調整 AI 輔助教學決策？",
  mechanism: "證據可見性與信任校準共同影響決策修正。",
  value: "連結可觀察證據、專業判斷與可反駁的機制。",
  domainFit: "符合 AI 應用於教育的課程決策焦點。",
  evidenceBoundary: "UNVERIFIED",
  assumptions: ["目前僅為概念方向，尚未檢索文獻。"],
  nextAction: "發展成三個研究方向並比較可行性。",
});
const turn = parseChatTurnResult({ schemaId: "old-mike-v2-alpha3/chat-insights/1", domainSelection: builtin, insights: [insight], completionClass: "COMPLETE", additiveReceipt: "ignored" });
equal(turn.insights[0].hash, insight.hash, "insight card hash consumed exactly");
const isolated = parseChatTurnResult({ schemaId: "old-mike-v2-alpha3/chat-insights/1", domainSelection: builtin, insights: [insight, insight, { malformed: true }], completionClass: "COMPLETE" });
equal(isolated.insights.length, 1, "valid insight remains when siblings fail");
equal(isolated.issues, [{ index: 1, code: "INSIGHT_DUPLICATE" }, { index: 2, code: "INSIGHT_INVALID" }], "malformed sibling slots isolated exactly");
throws(() => parseChatTurnResult({ schemaId: "old-mike-v2-alpha3/chat-insights/1", domainSelection: builtin, insights: [{ malformed: true }], completionClass: "COMPLETE" }), /insight_zero_valid/u, "zero valid insight fails");

const promotion = validateAlpha2PromotionRequest({ requestId: "promotion:fixture:0001", domainSelection: builtin, domainSelectionHash: builtin.selectionHash, insightCard: insight, insightCardHash: insight.hash, additive: true });
const selectedDirectionHash = sha256Canonical({ lane: "BALANCED_RECOMMENDED", title: insight.title });
ok(verifyAlpha2PromotionResult({ domainSelectionHash: promotion.domainSelectionHash, insightCardHash: promotion.insightCardHash, selectedDirectionHash, stageADomainSelectionHash: builtin.selectionHash, stageB: { sourceDirectionHash: selectedDirectionHash, domainSelectionHash: builtin.selectionHash }, fieldAssistDomainSelectionHash: builtin.selectionHash }), "promotion binding passes");
throws(() => verifyAlpha2PromotionResult({ domainSelectionHash: builtin.selectionHash, insightCardHash: insight.hash, selectedDirectionHash, stageADomainSelectionHash: builtin.selectionHash, stageB: { sourceDirectionHash: selectedDirectionHash, domainSelectionHash: custom.selectionHash }, fieldAssistDomainSelectionHash: builtin.selectionHash }), /promotion_domain_binding_mismatch/u, "cross-domain S0 rejected");
throws(() => verifyAlpha2PromotionResult({ domainSelectionHash: builtin.selectionHash, insightCardHash: insight.hash, selectedDirectionHash, stageADomainSelectionHash: builtin.selectionHash, stageB: { sourceDirectionHash: selectedDirectionHash, domainSelectionHash: builtin.selectionHash }, fieldAssistDomainSelectionHash: custom.selectionHash }), /field_assist_domain_binding_mismatch/u, "field assist cannot change domain");

const work = (overrides = {}) => ({ source: "OPENALEX", sourceDate: "2026-08-24", doi: "10.1000/example.1", stableSourceId: "W123", title: "Evidence calibration in teaching", year: 2025, firstAuthor: "Lin", citationCount: 4, confidence: "MEDIUM", evidenceClass: "OBSERVED", ...overrides });
const deduped = dedupeNormalizedWorks([
  work(),
  work({ source: "SEMANTIC_SCHOLAR", stableSourceId: "S2-1", doi: "https://doi.org/10.1000/EXAMPLE.1" }),
  work({ doi: null, stableSourceId: "W999", title: "A second work" }),
  work({ doi: null, stableSourceId: "W999", title: "A second work" }),
  work({ doi: null, stableSourceId: "W777", title: "Potential duplicate", year: 2024, firstAuthor: "Chen" }),
  work({ source: "SEMANTIC_SCHOLAR", doi: null, stableSourceId: "S777", title: "Potential duplicate", year: 2024, firstAuthor: "Chen" }),
]);
equal(deduped.accepted.length, 4, "DOI and stable ids dedupe before possible duplicate review");
equal(deduped.exactDuplicates.map((item) => item.authority), ["DOI", "STABLE_SOURCE_ID"], "dedupe authorities exact");
equal(deduped.possibleDuplicates.length, 1, "title/year/author remains review candidate");
throws(() => dedupeNormalizedWorks([work({ doi: null, stableSourceId: "https://example.test/raw" })]), /evidence_raw_url_forbidden/u, "raw URL cannot become stable id");
const openAlexBatch = parseLiteratureConnectorBatch({ schemaId: "old-mike-v2-alpha3/openalex-result/1", coverage: "PARTIAL", works: [work(), { malformed: true }], limitations: ["one malformed sibling isolated"], additive: true }, "OPENALEX");
equal(openAlexBatch.works.length, 1, "OpenAlex valid sibling retained");
equal(openAlexBatch.issues, [{ index: 1, code: "WORK_INVALID" }], "OpenAlex malformed sibling isolated");
const semanticBatch = parseLiteratureConnectorBatch({ schemaId: "old-mike-v2-alpha3/semantic-scholar-result/1", coverage: "COMPLETE", works: [work({ source: "SEMANTIC_SCHOLAR", stableSourceId: "S2-EXACT" })], limitations: [] }, "SEMANTIC_SCHOLAR");
equal(semanticBatch.works.length, 1, "Semantic Scholar batch exact");

const synthesis = parseLiteratureSynthesis({
  observed: { coverage: "PARTIAL", works: deduped.accepted.slice(0, 2), limitations: ["其中一個來源在本批次不可用。"] },
  forecasts: [
    { horizon: "YEARS_1_3", confidence: "MEDIUM", assumptions: ["公開 metadata 持續可取得"], invalidationConditions: ["研究主題定義改變"], statement: "短期方向為待驗證推估，不是已觀察趨勢。" },
    { horizon: "YEARS_4_6", confidence: "LOW", assumptions: ["方法逐步成熟"], invalidationConditions: ["治理限制改變"], statement: "中期方向需持續以新證據更新。" },
    { horizon: "YEARS_7_10", confidence: "LOW", assumptions: ["跨域基礎設施可用"], invalidationConditions: ["核心技術路徑失效"], statement: "長期方向僅作情境規劃。" },
  ],
  unrelatedAdditive: true,
});
equal(synthesis.observed.coverage, "PARTIAL", "partial coverage remains visible and successful");
equal(synthesis.forecasts.map((item) => item.horizon), ["YEARS_1_3", "YEARS_4_6", "YEARS_7_10"], "observed/forecast horizons separated");

equal(V2_ALPHA3_CONNECTOR_CAPABILITIES.CONSENSUS.state, "DISABLED_AUTH_AND_COST_UNPROVEN", "Consensus is capability-disabled");
equal(V2_ALPHA3_CONNECTOR_CAPABILITIES.GOOGLE_SCHOLAR.scraping, false, "Google Scholar scraping forbidden");
equal(V2_ALPHA3_NEON_CACHE_CONTRACT.synchronousResearchStartDependency, false, "Neon is nonblocking");
equal(V2_ALPHA3_N8N_TEMPLATE_CONTRACTS.length, 2, "exactly two inactive n8n templates");
const neonDescriptor = JSON.parse(await readFile(new URL("../platform-contracts/v2-alpha3-neon-literature-cache.json", import.meta.url), "utf8"));
equal(neonDescriptor.tables, V2_ALPHA3_NEON_CACHE_CONTRACT.tables, "Neon descriptor binds exact four cache tables");
equal(neonDescriptor.forbiddenFields, V2_ALPHA3_NEON_CACHE_CONTRACT.forbidden, "Neon descriptor binds exact data minimization fields");
equal(neonDescriptor.cacheProfiles, { ON_DEMAND: { freshHours: 24, staleHours: 168, purgeHours: 720 }, WEEKLY_DOMAIN_RADAR: { freshHours: 168, staleHours: 720, purgeHours: 2160 } }, "cache TTLs exact");
const n8nDescriptors = await Promise.all(["weekly-domain-refresh", "daily-retention"].map((name) => readFile(new URL(`../platform-contracts/n8n/v2-alpha3-${name}.inactive.json`, import.meta.url), "utf8").then(JSON.parse)));
equal(n8nDescriptors.map((item) => ({ templateId: item.templateId, state: item.status, input: item.payloadAllowlist[0], concurrency: item.concurrency, sourcePolling: item.sourcePolling })), V2_ALPHA3_N8N_TEMPLATE_CONTRACTS.map((item) => ({ ...item, state: "INACTIVE_NOT_IMPORTED" })), "inactive n8n descriptors exact");
ok(n8nDescriptors.every((item) => item.submissionPossibleReplay === "FORBIDDEN" && item.rawTerms === false && item.credentials === false), "n8n replay and raw-term boundaries");

let providerSubmissions = 0;
const coordinator = createV2Alpha3ChatCoordinator({ submit: async () => { providerSubmissions += 1; return { schemaId: "old-mike-v2-alpha3/chat-insights/1", domainSelection: builtin, insights: [insight], completionClass: "COMPLETE" }; } });
const request = { scope: "fixture-workspace:fixture-user", requestId: "chat:fixture:0001", domainSelection: builtin, message: "教師如何校準 AI 教學建議？" };
const first = await coordinator.run(request);
const replay = await coordinator.run(request);
equal(first.result.insights.length, 1, "chat result consumed");
equal(replay.replayed, true, "same request replays");
equal(providerSubmissions, 1, "one synthetic provider effect maximum");
await assert.rejects(() => coordinator.run({ ...request, message: "不同訊息" }), /chat_idempotency_conflict/u); assertions += 1;

console.log(`PASS V2_ALPHA3_CONTRACTS assertions=${assertions} scenario_groups=8 provider_submissions=${providerSubmissions} formal_writes=0 network_calls=0`);
