import "server-only";

import { callOpenClaw, type OpenClawMessage } from "./openclaw.ts";
import type { ResolvedModelRoute } from "./model-route-catalog.ts";
import { JOURNAL_DETAIL_CONTRACT_VERSION, type JournalDetailRequest } from "./submission-journal-detail-contract.ts";

export class JournalDetailProviderError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number) {
    super(code);
    this.name = "JournalDetailProviderError";
    this.code = code;
    this.status = status;
  }
}

const MAX_OUTPUT_BYTES = 300_000;

const providerBoundary = [
  "你是老麥（Old Mike）網站內的期刊深度查證元件（journal-detail）。對「單一候選期刊」做 Evidence-First 的官方來源查證，輸出嚴格 JSON。",
  "資料誠信：不得虛構 ISSN、Impact Factor、CiteScore、JCR/Scopus 分區、APC、審稿時間、接受率、Special Issue、DOI、Word Limit 或任何期刊規定。官方來源優先：期刊官網 → Guide for Authors → Editorial Policies → OA/APC 頁面 → Clarivate MJL/JCR → Scopus Sources → DOAJ → Crossref/OpenAlex。",
  "每個可變數值必須給 last_verified_at（ISO-8601）與 verification_status（verified_current | verified_but_previous_year | pending_new_announcement | conflicting_sources | unverified）。無法由官方來源確認的欄位：值填 null 且 verification_status=unverified；不得用第三方彙整當官方數值（可標示「第三方彙整，未與官方核對」）。",
  "JCR 分區必須含資料庫、年度、學科類別、Quartile；缺任一即標 unverified。APC 必須含幣別與 OA 類型（hybrid/full OA/subscription）；查不到金額寫「目前無法驗證」。",
  "最近相關文章：最多 5 篇，需與本研究主題相關；每篇含 title、year、doi（查不到 doi 標 null，不得編造）。",
  "Desk Reject Risk 只能是 low | low_to_moderate | moderate | high | insufficient_evidence；不得轉換成錄取率。",
  "建議 Title／Abstract 定位／Keywords 依提供的 topicContext 產生；不得覆蓋原始題目，只提供期刊導向改寫建議。",
  "輸出格式：只輸出一個 JSON 物件，不含 markdown、程式碼圍欄、註解或額外鍵，鍵名與型別必須完全符合 requiredResultShape。",
].join(" ");

export function buildJournalDetailPayload(request: JournalDetailRequest) {
  const bounded = (value: unknown, max: number) => typeof value === "string" && value.length > max ? `${value.slice(0, max)}…（原文已截斷）` : (typeof value === "string" ? value : "");
  return {
    contractVersion: JOURNAL_DETAIL_CONTRACT_VERSION,
    kind: "JOURNAL_DETAIL",
    journalName: request.journalName,
    targetYear: request.targetYear,
    topicContext: {
      titleZh: bounded(request.topicContext.chinese_title ?? request.topicContext.titleZh, 300),
      titleEn: bounded(request.topicContext.english_title ?? request.topicContext.titleEn, 400),
      abstract: bounded(request.topicContext.concept_abstract ?? request.topicContext.abstract, 6_000),
      researchGap: bounded(request.topicContext.research_gap ?? request.topicContext.researchGap, 4_000),
      researchQuestions: request.topicContext.research_questions ?? request.topicContext.researchQuestions ?? [],
      theory: request.topicContext.theory ?? [],
      method: bounded(request.topicContext.methodology ?? request.topicContext.method, 4_000),
      population: bounded(request.topicContext.population, 1_000),
      context: bounded(request.topicContext.context, 1_000),
      expectedContribution: bounded(request.topicContext.expected_contribution ?? request.topicContext.expectedOutcomes, 2_000),
      novelty: bounded(request.topicContext.novelty_analysis ?? request.topicContext.noveltyAnalysis, 4_000),
    },
    requiredResultShape: {
      journal_name: "",
      publisher: "",
      issn: null,
      official_url: "",
      guide_for_authors_url: null,
      aims_scope: "",
      article_types: [],
      word_limit: null,
      abstract_limit: null,
      reference_style: null,
      blind_review: null,
      ethics_requirements: "",
      data_policy: "",
      code_policy: null,
      ai_policy: null,
      reporting_guideline: null,
      oa_type: null,
      apc: { amount: null, currency: null, note: "" },
      jcr_status: { indexed: false, category: [], quartile: null, metric_year: null, verified: false },
      scopus_status: { indexed: false, citescore: null, quartile: null, year: null, verified: false },
      recent_relevant_articles: [{ title: "", year: null, doi: null }],
      special_issues: [{ title: "", deadline: null, verified: false }],
      desk_reject_risk: "insufficient_evidence",
      contribution_delta: "",
      suggested_title_zh: "",
      suggested_title_en: "",
      suggested_abstract_angle: "",
      suggested_keywords: [],
      major_risks: [],
      required_revisions: [],
      last_verified_at: "ISO-8601",
      verification_status: "unverified",
      evidence: [{ claim: "", source_url: "", verification_status: "unverified" }],
    },
  };
}

function messages(request: JournalDetailRequest): OpenClawMessage[] {
  return [
    { role: "system", content: providerBoundary },
    { role: "user", content: JSON.stringify(buildJournalDetailPayload(request)) },
  ];
}

function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function exactKeys(value: Record<string, unknown>, expected: readonly string[]) { const a = Object.keys(value).sort(); const w = [...expected].sort(); return a.length === w.length && a.every((key, index) => key === w[index]); }
function assertString(value: unknown, field: string, max = 20_000) { if (typeof value !== "string" || value.trim().length < 1 || Buffer.byteLength(value, "utf8") > max) throw new JournalDetailProviderError(`invalid_response:${field}`, 502); }
function assertArray(value: unknown, field: string, max = 50) { if (!Array.isArray(value) || value.length > max) throw new JournalDetailProviderError(`invalid_response:${field}`, 502); }

const RISKS = ["low", "low_to_moderate", "moderate", "high", "insufficient_evidence"] as const;
const VSTATUS = ["verified_current", "verified_but_previous_year", "pending_new_announcement", "conflicting_sources", "unverified"] as const;

export type JournalDetailOutput = Record<string, unknown>;

export function parseJournalDetailOutput(value: unknown): JournalDetailOutput {
  if (!record(value)) throw new JournalDetailProviderError("invalid_response", 502);
  const allowed = ["journal_name", "publisher", "issn", "official_url", "guide_for_authors_url", "aims_scope", "article_types", "word_limit", "abstract_limit", "reference_style", "blind_review", "ethics_requirements", "data_policy", "code_policy", "ai_policy", "reporting_guideline", "oa_type", "apc", "jcr_status", "scopus_status", "recent_relevant_articles", "special_issues", "desk_reject_risk", "contribution_delta", "suggested_title_zh", "suggested_title_en", "suggested_abstract_angle", "suggested_keywords", "major_risks", "required_revisions", "last_verified_at", "verification_status", "evidence"];
  if (!exactKeys(value, allowed)) throw new JournalDetailProviderError("invalid_response:keys", 502);
  assertString(value.journal_name, "journal_name", 500);
  assertString(value.last_verified_at, "last_verified_at", 64);
  if (typeof value.verification_status !== "string" || !VSTATUS.includes(value.verification_status as (typeof VSTATUS)[number])) throw new JournalDetailProviderError("invalid_response:verification_status", 502);
  if (typeof value.desk_reject_risk !== "string" || !RISKS.includes(value.desk_reject_risk as (typeof RISKS)[number])) throw new JournalDetailProviderError("invalid_response:desk_reject_risk", 502);
  assertArray(value.article_types, "article_types", 30);
  assertArray(value.recent_relevant_articles, "recent_relevant_articles", 5);
  assertArray(value.special_issues, "special_issues", 20);
  assertArray(value.suggested_keywords, "suggested_keywords", 8);
  assertArray(value.major_risks, "major_risks", 20);
  assertArray(value.required_revisions, "required_revisions", 20);
  assertArray(value.evidence, "evidence", 50);
  return value as JournalDetailOutput;
}

function parseJson(content: string) {
  if (Buffer.byteLength(content, "utf8") > MAX_OUTPUT_BYTES || content.includes("```")) throw new JournalDetailProviderError("invalid_response", 502);
  try { return JSON.parse(content) as unknown; } catch { throw new JournalDetailProviderError("invalid_response", 502); }
}

export async function runJournalDetailWithOpenClaw(input: {
  request: JournalDetailRequest;
  actorId: string;
  route: ResolvedModelRoute;
}): Promise<JournalDetailOutput> {
  const result = await callOpenClaw(messages(input.request), `journal-detail:${input.actorId}`, "SUBMISSION_NAVIGATOR", input.route);
  if (result.kind === "not-configured") throw new JournalDetailProviderError("journal_detail_service_not_ready", 503);
  if (result.kind === "invalid-config") throw new JournalDetailProviderError("journal_detail_service_policy_error", 503);
  if (result.kind !== "success") throw new JournalDetailProviderError("journal_detail_service_unavailable", 502);
  return parseJournalDetailOutput(parseJson(result.content));
}
