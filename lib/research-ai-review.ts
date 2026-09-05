import "server-only";

import { callOpenClaw, type OpenClawMessage } from "./openclaw.ts";

export type AiReviewOutcome = {
  kind: "ok" | "unavailable";
  note?: string;
  content?: string;
};

function parseJsonBlock(content: string): Record<string, unknown> | null {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/u);
  const candidate = fenced ? fenced[1] : content;
  try {
    const parsed = JSON.parse(candidate.trim());
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch { /* fallthrough */ }
  // 嘗試取出第一個 {...}
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>; } catch { /* ignore */ }
  }
  return null;
}

async function runAi(messages: OpenClawMessage[], sessionKey: string, operation: "ASSIST_LITERATURE_REVIEW" | "ASSIST_GAP_ANALYSIS" | "ASSIST_THEORY_ANALYSIS" | "ASSIST_DESIGN_ANALYSIS", actorId: string): Promise<AiReviewOutcome> {
  try {
    const result = await callOpenClaw(messages, sessionKey, operation, undefined);
    if (result.kind !== "success" || !result.content) {
      return { kind: "unavailable", note: result.kind === "invalid-config" ? "AI 服務未設定（OPENCLAW_BASE_URL/OPENCLAW_GATEWAY_TOKEN）。" : "AI 審閱目前無法執行；請稍後重試。" };
    }
    return { kind: "ok", content: result.content };
  } catch (error) {
    return { kind: "unavailable", note: error instanceof Error ? `AI 審閱失敗：${error.message.slice(0, 200)}` : "AI 審閱失敗。" };
  }
}

const SYSTEM_BASE = "你是老麥（Old Mike），一位嚴謹的跨領域科研方法與文獻審閱助手。所有輸出必須是 JSON（不加前言、不用 markdown），且：只使用提供的資料，不得虛構文獻/作者/DOI/數據；所有建議標示 PROVISIONAL；不得使用 OBSERVED/FOUND/SIGNIFICANT/SUPPORTED BY RESULTS 等已定案字眼。";

// ---------- 文獻深審：角色＋證據＋分析卡建議 ----------
export async function aiReviewLiterature(input: { actorId: string; title: string; authors: unknown[]; year: number | null; journal: string | null; doi: string | null; url: string | null; tags: string[]; readingStatus: string; evidenceStatus: string; projectTitle: string }): Promise<AiReviewOutcome> {
  const messages: OpenClawMessage[] = [
    { role: "system", content: SYSTEM_BASE + " 任務：文獻角色與證據審閱。輸出 JSON：{ \"roles\": string[], \"evidence\": string, \"analysisCard\": { \"researchProblem\": string, \"theory\": string, \"population\": string, \"method\": string, \"variables\": string, \"mainFindings\": string, \"limitations\": string, \"futureResearch\": string, \"researchGap\": string, \"supportsMyProject\": string, \"differsFromMyProject\": string, \"usefulForSections\": string[] }, \"rationale\": string }。roles 限 CORE/GAP/THEORY/METHOD/MEASUREMENT/SIMILAR_STUDY/SUPPORTING/DISCUSSION/BACKGROUND。evidence 限 VERIFIED/SUPPORTED/INFERRED/UNVERIFIED（只能依現有資料推斷，通常 SUPPORTED）。analysisCard 各欄簡短（1-2 句），不得虛構。all values 皆 PROVISIONAL。" },
    { role: "user", content: `專案題目：${input.projectTitle}\n文獻：title="${input.title}"\nauthors=${JSON.stringify(input.authors)}\nyear=${input.year ?? "unknown"}\njournal=${input.journal ?? "unknown"}\ndoi=${input.doi ?? "unknown"}\nurl=${input.url ?? "unknown"}\ntags=${JSON.stringify(input.tags)}\n目前閱讀狀態=${input.readingStatus}\n目前證據狀態=${input.evidenceStatus}\n請依以上資料（僅限此處提供的資訊）審閱並輸出 JSON 建議。` },
  ];
  const outcome = await runAi(messages, `literature-review:${input.actorId}`, "ASSIST_LITERATURE_REVIEW", input.actorId);
  if (outcome.kind !== "ok" || !outcome.content) return outcome;
  const parsed = parseJsonBlock(outcome.content);
  if (!parsed) return { kind: "ok", content: outcome.content, note: "AI 回覆無法解析為 JSON；已保留原文供參考。" };
  return { kind: "ok", content: JSON.stringify(parsed) };
}

// ---------- Gap 深審：claims 建議 ----------
export async function aiReviewGap(input: { actorId: string; projectTitle: string; researchGap: string; researchQuestions: string[]; literature: { title: string; evidenceStatus: string }[] }): Promise<AiReviewOutcome> {
  const messages: OpenClawMessage[] = [
    { role: "system", content: SYSTEM_BASE + " 任務：研究缺口（Gap）分析建議。輸出 JSON：{ \"gapClaims\": [{ \"gapId\": string, \"gapType\": string, \"claim\": string, \"evidenceStrength\": string, \"validationStatus\": \"PROPOSED\" }], \"rationale\": string }。gapType 限 THEORETICAL/EMPIRICAL/METHODOLOGICAL/POPULATION/CONTEXT/TECHNOLOGY/IMPLEMENTATION。claim 必須直接來自提供的 researchGap/RQ/文獻，不得自創文獻。" },
    { role: "user", content: `專案：${input.projectTitle}\nResearch Gap：${input.researchGap}\nResearch Questions：${input.researchQuestions.map((q, i) => `RQ${i + 1}: ${q}`).join("\\n")}\n專案文獻（僅題名）：${input.literature.map((l) => `- ${l.title}（${l.evidenceStatus}）`).join("\\n")}\n請輸出 JSON 建議（全部 PROVISIONAL）。` },
  ];
  const outcome = await runAi(messages, `gap-analysis:${input.actorId}`, "ASSIST_GAP_ANALYSIS", input.actorId);
  if (outcome.kind !== "ok" || !outcome.content) return outcome;
  const parsed = parseJsonBlock(outcome.content);
  if (!parsed) return { kind: "ok", content: outcome.content, note: "AI 回覆無法解析為 JSON；已保留原文供參考。" };
  return { kind: "ok", content: JSON.stringify(parsed) };
}

// ---------- 理論深審：核心理論＋機制＋構念＋假設建議 ----------
export async function aiReviewTheory(input: { actorId: string; projectTitle: string; researchGap: string; researchQuestions: string[]; intervention: string; outcomes: string[]; variables: string[]; theoryHints: string[]; literature: { title: string; evidenceStatus: string }[] }): Promise<AiReviewOutcome> {
  const messages: OpenClawMessage[] = [
    { role: "system", content: SYSTEM_BASE + " 任務：核心理論與機制建議。輸出 JSON：{ \"coreTheory\": { \"theoryKey\": string, \"theoryName\": string, \"reason\": string, \"mechanismRole\": string } | null, \"mechanismPaths\": [{ \"pathId\": string, \"sourceConstruct\": string, \"targetConstruct\": string, \"relationshipType\": string, \"expectedDirection\": string, \"mechanismExplanation\": string, \"theoryKey\": string, \"relatedRqKey\": string, \"status\": \"PROPOSED\" }], \"constructs\": [{ \"constructId\": string, \"canonicalName\": string, \"conceptualDefinition\": string, \"role\": string }], \"rationale\": string }。規則：不要為了複雜堆疊理論；只建議真正解釋介入→結果機制的理論；若無適合正式理論，coreTheory 給 null 並在 rationale 說明（可選 CONCEPTUAL_FRAMEWORK_ONLY）；constructs 只建議提供的 variables 或 RQ 中明顯構念；不得虛構文獻。" },
    { role: "user", content: `專案：${input.projectTitle}\nResearch Gap：${input.researchGap}\nRQ：${input.researchQuestions.map((q, i) => `RQ${i + 1}: ${q}`).join("\\n")}\n介入/技術：${input.intervention}\n預期結果：${input.outcomes.join("；")}\n候選構念/變數：${input.variables.join("；") || "無"}\n既有理論提示：${input.theoryHints.join("；") || "無"}\n專案文獻（題名）：${input.literature.map((l) => `- ${l.title}`).join("\\n")}\n請輸出 JSON 建議（全部 PROVISIONAL）。` },
  ];
  const outcome = await runAi(messages, `theory-analysis:${input.actorId}`, "ASSIST_THEORY_ANALYSIS", input.actorId);
  if (outcome.kind !== "ok" || !outcome.content) return outcome;
  const parsed = parseJsonBlock(outcome.content);
  if (!parsed) return { kind: "ok", content: outcome.content, note: "AI 回覆無法解析為 JSON；已保留原文供參考。" };
  return { kind: "ok", content: JSON.stringify(parsed) };
}

// ---------- 研究設計深審：設計＋樣本＋測量＋分析建議 ----------
export async function aiReviewDesign(input: { actorId: string; projectTitle: string; researchQuestions: string[]; hypotheses: string[]; constructs: { constructId: string; canonicalName: string; role: string }[]; route: string; methodology: string; literature: { title: string; evidenceStatus: string }[] }): Promise<AiReviewOutcome> {
  const messages: OpenClawMessage[] = [
    { role: "system", content: SYSTEM_BASE + " 任務：研究設計與分析計畫建議。輸出 JSON：{ \"designKey\": string, \"designName\": string, \"reason\": string, \"studyIdentity\": { \"studyType\": string, \"unitOfAnalysis\": string, \"researchSetting\": string, \"numberOfSites\": string, \"studyDuration\": string, \"confirmatoryOrExploratory\": string }, \"arms\": [{ \"groupId\": string, \"groupName\": string, \"intervention\": string, \"expectedN\": string, \"assignmentMethod\": string }], \"timePoints\": [{ \"tpId\": string, \"label\": string, \"note\": string }], \"measurementRequirements\": [{ \"constructId\": string, \"variableRole\": string, \"measurementType\": string, \"status\": string }], \"plannedAnalyses\": [{ \"rqKey\": string, \"method\": string, \"primaryOrSecondary\": string, \"effectSize\": string | null }], \"rationale\": string }。規則：方法必須回應 RQ；不得猜測樣本數/效果量（expectedN 給 null 或 '待 Power Analysis'）；measurementType 限 Questionnaire/Knowledge Test/Skill Assessment/Behavioral Performance/Reaction Time/System Log/Interview/Observation/Eye Tracking/EDA/EEG/HRV/Motion Data/AI Model Metric；不得虛構文獻。" },
    { role: "user", content: `專案：${input.projectTitle}\nRQ：${input.researchQuestions.map((q, i) => `RQ${i + 1}: ${q}`).join("\\n")}\n假設/命題：${input.hypotheses.join("；") || "無"}\n構念：${input.constructs.map((c) => `${c.canonicalName}（${c.role}）`).join("；")}\n投稿/申請路線：${input.route}\n方法方向：${input.methodology}\n專案文獻（題名）：${input.literature.map((l) => `- ${l.title}`).join("\\n")}\n請輸出 JSON 建議（全部 PROVISIONAL）。` },
  ];
  const outcome = await runAi(messages, `design-analysis:${input.actorId}`, "ASSIST_DESIGN_ANALYSIS", input.actorId);
  if (outcome.kind !== "ok" || !outcome.content) return outcome;
  const parsed = parseJsonBlock(outcome.content);
  if (!parsed) return { kind: "ok", content: outcome.content, note: "AI 回覆無法解析為 JSON；已保留原文供參考。" };
  return { kind: "ok", content: JSON.stringify(parsed) };
}
