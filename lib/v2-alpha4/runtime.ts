import "server-only";

import type { V2Alpha3DomainSelection } from "../v2-alpha3/contracts.ts";
import { S0_FIELD_NAMES } from "../s0-fields.ts";
import {
  createResearchIntentBinding,
  parseFiveLensReview,
  parseJournalIdentityAuthority,
  parseJournalPolicySnapshot,
  parseJournalRecentCorpus,
  parseReviewResponseLedger,
  parseS0Fields,
  sha256Alpha4,
  type V2Alpha4TargetSelection,
} from "./contracts.ts";

type Request = { scope?: string; requestId?: string; domainSelection: V2Alpha3DomainSelection; targetSelection: V2Alpha4TargetSelection; researchDirection: string };

function boundedDirection(value: unknown) {
  if (typeof value !== "string") throw new Error("alpha4_direction_invalid");
  const normalized = value.replace(/\r\n?/gu, "\n").trim();
  if (normalized.length < 4 || normalized.length > 1000) throw new Error("alpha4_direction_invalid");
  return normalized;
}

function finding(lens: string, index: number, severity: "CRITICAL" | "MAJOR" | "MINOR", title: string) {
  const base = { findingId: `${lens.toLocaleLowerCase("en-US")}-${index}`, severity, title, evidenceAnchor: `text: manuscript §${index} \"合成示範段落保留可查核定位\"`, recommendation: "依證據邊界補強論證，並在修訂帳本標記精確位置。" };
  return base;
}

export function createSyntheticAlpha4Workspace(request: Request) {
  const researchDirection = boundedDirection(request.researchDirection);
  const intent = createResearchIntentBinding({ domainSelection: request.domainSelection, targetSelection: request.targetSelection });
  const collection = request.targetSelection.targetId === "SCI" ? "SCIE" : "SSCI";
  const lanes = [
    { lane: "EVIDENCE_FIRST", suffix: "的證據校準與可反駁決策路徑", question: "哪些可觀察證據支持或反駁教師調整決策的機制？", method: "序列式混合方法與事前分析契約" },
    { lane: "BALANCED_RECOMMENDED", suffix: "的作用機制、情境邊界與實務結果", question: "何種機制與情境條件連結證據使用與課程決策結果？", method: "多層次設計結合訪談與文件證據" },
    { lane: "FRONTIER_INNOVATION", suffix: "的失效邊界與反直覺影響", question: "何時證據提示反而造成過度信任或決策僵化？", method: "負向案例比較與機制追蹤" },
  ] as const;
  const directions = lanes.map((lane, index) => ({
    researchIntentHash: intent.researchIntentHash,
    directionId: `alpha4-direction-${index + 1}`,
    lane: lane.lane,
    workingTitle: `${researchDirection}${lane.suffix}`.slice(0, 150),
    researchQuestion: lane.question,
    researchValue: index === 1 ? "兼顧理論、方法與期刊讀者需求，並保留反駁條件。" : "以可驗證機制與清楚邊界形成差異化貢獻。",
    mechanismTheory: "證據可見性、信任校準與專業判斷共同形成可檢驗路徑。",
    targetContext: "高等教育教師與課程決策情境；實際樣本仍待研究者確認。",
    methodDesign: lane.method,
    contribution: "提出可重現、可反駁且不超出現有證據的機制解釋。",
    recommended: index === 1,
    hash: "",
  })).map((item) => ({ ...item, hash: sha256Alpha4({ ...item, hash: undefined }) }));
  const selected = directions[1];
  const journalSeeds = [
    { id: "journal-balanced", title: "Journal of Evidence-Calibrated Teaching", issn: "1234-5678", recommended: true, status: "READY" },
    { id: "journal-method", title: "International Journal of Learning Evidence", issn: "2345-6789", recommended: false, status: "NEEDS_FIX" },
    { id: "journal-context", title: "Studies in Educational Decision Systems", issn: "3456-789X", recommended: false, status: "STALE" },
  ] as const;
  const journalSets = directions.map((direction, setIndex) => ({
    directionId: direction.directionId,
    journals: journalSeeds.map((seed, index) => {
      const journalId = `${seed.id}-${setIndex + 1}`;
      const identity = parseJournalIdentityAuthority({ schemaId: "old-mike-v2-alpha4/journal-identity/1", journalId, title: seed.title, issn: [seed.issn], issnL: seed.issn, verifiedCollection: collection, verifiedAt: "2026-08-24T08:00:00.000Z", sourceDate: "2026-08-01", snapshotHash: sha256Alpha4({ seed: journalId, authority: "synthetic-mjl" }), freshness: index === 2 ? "STALE" : "CURRENT", targetId: request.targetSelection.targetId });
      const policy = parseJournalPolicySnapshot({ schemaId: "old-mike-v2-alpha4/journal-policy/1", journalId, scope: ["evidence-informed teaching", "educational decision mechanisms"], articleTypes: ["Original Research"], authorGuide: { wordLimit: "SYNTHETIC_VERIFY_OFFICIAL_SOURCE", reporting: "SYNTHETIC_VERIFY_OFFICIAL_SOURCE" }, ethicsPolicy: "研究涉及參與者時須提出倫理與同意聲明。", aiPolicy: "依當期官方指引揭露協助方式。", dataPolicy: "須提供資料可用性聲明。", feeAndOa: "費用與開放取用資訊須於提交前重新核對。", submissionChecklist: ["title page", "anonymous manuscript", "cover letter"], verifiedAt: "2026-08-24T08:00:00.000Z", sourceDate: "2026-08-20", snapshotHash: sha256Alpha4({ seed: journalId, authority: "synthetic-policy" }), freshness: index === 2 ? "STALE" : "CURRENT" });
      const corpus = parseJournalRecentCorpus({ schemaId: "old-mike-v2-alpha4/journal-recent-corpus/1", journalId, publicLabel: "近期已發表內容的可觀察模式", period: { from: "2024-01-01", to: "2026-07-31" }, itemCount: 24 - index * 3, observedTopics: ["教師決策", "證據校準"], observedMethods: ["混合方法", "質性訪談"], observedPopulations: ["高等教育教師"], observedArticleTypes: ["Original Research"], officialIssueCount: 6, officialSpecialCollections: ["合成特刊 fixture：證據與教學決策"], officialCalls: ["合成徵稿 fixture：提交前必須重新核對官方頁面"], sourceDate: "2026-08-20", snapshotHash: sha256Alpha4({ seed: journalId, authority: "synthetic-official-issues-calls" }), freshness: index === 2 ? "STALE" : "CURRENT", confidence: index === 2 ? "LOW" : "MEDIUM", counterEvidence: ["近期文章亦包含與本題不同的方法與情境。"] });
      return { researchIntentHash: intent.researchIntentHash, directionId: direction.directionId, journalId, title: seed.title, recommended: seed.recommended, status: seed.status, identity, policy, corpus, fit: { schemaId: "old-mike-v2-alpha4/journal-fit/1", researchIntentHash: intent.researchIntentHash, directionId: direction.directionId, journalId, status: seed.status, recommended: seed.recommended, blueprint: { audienceScopeFit: "讀者關注可解釋的教育決策與可重現證據。", contribution: direction.contribution, theoryMechanism: direction.mechanismTheory, methodsReportingGuideline: "依研究設計選擇適用報告指引，提交前核對官方版本。", dataAnalysis: "分析計畫與可得資料一一對應。", expectedResultEmphasis: "呈現機制、邊界、反證與不確定性。", exactAdaptations: ["將題目與摘要聚焦於證據校準機制"], deskRejectRisks: ["範圍對齊未以最新官方 Aims & Scope 複核"], assumptions: ["目前資料與樣本為待確認假設"], invalidationConditions: ["官方收錄或政策快照失效"], closestFitAlternatives: journalSeeds.filter((other) => other.id !== seed.id).map((other) => other.title) } } };
    }),
  }));
  const journals = journalSets[1].journals;
  const s0Fields = parseS0Fields({
    workingTitle: selected.workingTitle, domain: request.domainSelection.label, outputTrack: request.targetSelection.targetId,
    problemContext: `研究者原始方向：「${researchDirection}」。現有工作情境需要辨識證據提示如何影響教師修正課程決策；此為待研究驗證的問題背景，不代表既有結果。`,
    targetUsers: "高等教育教師與課程設計者；實際納入條件與場域由研究者確認。", expectedContribution: selected.contribution,
    existingData: "目前僅有研究方向與合成官方來源 fixture，尚無實際研究資料。", availableData: "可規劃蒐集訪談、課程文件與決策歷程；取得性須另行確認。",
    methodIdea: selected.methodDesign, timeline: "分階段完成設計、倫理審查、資料蒐集、分析、撰寫與查核；日期尚待確認。",
    constraints: "樣本取得、量測品質、研究時間與官方期刊規範仍待確認。", ethicsPrivacyRisks: "涉及人類參與者時須取得適用倫理核准與知情同意，並落實資料最小化。",
    unresolvedItems: "樣本框、量測工具、資料取得權限、作者分工、費用與最新官方提交規範均待確認。",
  });
  const s0 = { schemaId: "old-mike-v2-alpha4/s0/1", researchIntentHash: intent.researchIntentHash, sourceDirectionId: selected.directionId, selectedJournalId: journals[0].journalId, fields: s0Fields, completeFieldCount: S0_FIELD_NAMES.length };
  const reports = [
    { lens: "EIC", findings: [finding("EIC", 1, "MINOR", "期刊讀者與貢獻需更聚焦")] },
    { lens: "METHODOLOGY", findings: [finding("METHODOLOGY", 1, "MAJOR", "量測與分析契約需預先固定")] },
    { lens: "DOMAIN", findings: [finding("DOMAIN", 1, "MINOR", "領域術語需一致")] },
    { lens: "PERSPECTIVE", findings: [finding("PERSPECTIVE", 1, "MINOR", "外部效度邊界需明示")] },
    { lens: "DEVILS_ADVOCATE", findings: [finding("DEVILS_ADVOCATE", 1, "CRITICAL", "替代解釋尚未被可檢驗地排除")] },
  ].map((report) => ({ ...report, reportHash: sha256Alpha4(report) }));
  const review = parseFiveLensReview({ schemaId: "old-mike-v2-alpha4/five-lens-review/1", readOnly: true, reports, daCriticalAdjudications: [{ findingId: "devils_advocate-1", status: "RESOLVED", rationale: "第二輪修訂加入負向案例與替代解釋檢驗，並保留未解限制。" }] });
  const responseLedger = parseReviewResponseLedger({ schemaId: "old-mike-v2-alpha4/review-response/1", allCommentsAccountedFor: true, items: review.reports.flatMap((report) => report.findings.map((item) => ({ findingId: item.findingId, response: item.severity === "CRITICAL" ? "已加入反證設計並說明殘餘不確定性。" : "已依證據定位修訂或說明限制。", changeLocation: `修訂稿／${report.lens} 對應段落`, disposition: "CHANGED" }))) });
  const citationAudit = { schemaId: "old-mike-v2-alpha4/citation-audit/1", status: "READY", entries: [{ citationId: "fixture-citation-1", existence: "PASS", metadata: "PASS", context: "PASS", sourceSnapshotHash: sha256Alpha4("citation-fixture"), note: "合成 fixture 的存在、metadata 與語境三軸均通過。" }] };
  const manuscript = { schemaId: "old-mike-v2-alpha4/manuscript/1", researchIntentHash: intent.researchIntentHash, manuscriptHash: sha256Alpha4({ title: selected.workingTitle, revision: 2 }), title: selected.workingTitle, sections: { results: "結果欄位等待實際資料；不得生成研究發現。", discussion: "討論將依實際結果與反證撰寫。", methods: selected.methodDesign, introduction: "以可辯護缺口與可查核來源為界。", abstract: "提交前由完整稿件重建。" }, statements: { authorship: "CRediT 分工待作者確認。", ethics: "適用倫理核准與同意狀態須於提交前確認。", dataAvailability: "資料可用性聲明待實際資料治理決定。", aiDisclosure: "老麥協助範圍須於提交前揭露並由作者負責。", conflictOfInterest: "利益衝突狀態待全體作者確認。", funding: "資助來源與案號待作者確認。" }, formalWriteCount: 0 };
  const submissionAudit = { schemaId: "old-mike-v2-alpha4/submission-audit/1", journalIdentityFreshness: "CURRENT", policyFreshness: "CURRENT", evidenceAnalysisComplete: true, fatalReviewerFindingCount: 0, citationAuditStatus: "READY", mandatoryStatementsComplete: true, coverLetterClaimsTraceable: true, reviewCommentsAccountedFor: true, revisionLoopCount: 2, humanGateConfirmed: false, externalSubmissionEnabled: false };
  return {
    contractVersion: "old-mike-v2-alpha4/workspace/1", researchIntent: intent, researchIntentHash: intent.researchIntentHash,
    chat: { researchIntentHash: intent.researchIntentHash, artifactClass: "DOMAIN_TARGET_DIRECTION" }, evidenceRequest: { researchIntentHash: intent.researchIntentHash, sourceStrategy: "SYNTHETIC_OFFICIAL_FIXTURES_ONLY" },
    directions, recommendation: { researchIntentHash: intent.researchIntentHash, directionId: selected.directionId, journalId: journals[0].journalId, rationale: "平衡方案兼顧證據、機制、可行性與期刊讀者，仍需人類核對。" },
    journals, journalSets, selectedJournal: { researchIntentHash: intent.researchIntentHash, journalId: journals[0].journalId }, s0,
    manuscript, review, revisionLoopCount: 2, citationAudit, responseLedger, submissionAudit,
    coverLetter: { researchIntentHash: intent.researchIntentHash, claims: [{ claim: "稿件探討證據校準與教師決策機制。", sourceArtifactHash: manuscript.manuscriptHash }], traceable: true },
    futureProjectImport: { researchIntentHash: intent.researchIntentHash, humanGateRequired: true, confirmed: false },
    formalResearchWriteCount: 0, externalSubmissionCount: 0, liveSourceCalls: 0, providerCalls: 0,
  };
}

export function createV2Alpha4Coordinator(deps: { generate: (request: Request) => Promise<ReturnType<typeof createSyntheticAlpha4Workspace>> }) {
  const settled = new Map<string, { requestHash: string; result: ReturnType<typeof createSyntheticAlpha4Workspace> }>();
  const inFlight = new Map<string, Promise<{ replayed: false; result: ReturnType<typeof createSyntheticAlpha4Workspace> }>>();
  return {
    async run(request: Request) {
      if (!request.scope || !request.requestId) throw new Error("alpha4_request_authority_invalid");
      const key = `${request.scope}:${request.requestId}`;
      const requestHash = sha256Alpha4({ domainSelection: request.domainSelection, targetSelection: request.targetSelection, researchDirection: boundedDirection(request.researchDirection) });
      const prior = settled.get(key);
      if (prior) {
        if (prior.requestHash !== requestHash) throw new Error("alpha4_idempotency_conflict");
        return { replayed: true as const, result: prior.result };
      }
      const active = inFlight.get(key);
      if (active) return active;
      const task = (async () => {
        const result = await deps.generate(request);
        settled.set(key, { requestHash, result });
        return { replayed: false as const, result };
      })();
      inFlight.set(key, task);
      try { return await task; } finally { inFlight.delete(key); }
    },
  };
}
