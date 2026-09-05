import "server-only";

import { logError } from "./server-log.ts";

// LanguageTool 自架機械錯誤層（僅供內網呼叫；文字不送出內網）。
// 位置：languagetool.zeabur.internal:8010（自架服務，無公開 domain）。
// 測試可用 LT_BASE_URL=http://127.0.0.1:<port> 指向 mock。

export type LanguageToolIssue = {
  offset: number;
  length: number;
  message: string;
  shortMessage: string;
  ruleId: string;
  category: string;
  replacements: string[];
};

export class LanguageToolClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LanguageToolClientError";
  }
}

export function languageToolConfigured(): boolean {
  const base = process.env.LT_BASE_URL;
  if (!base) return false;
  try {
    const url = new URL(base);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function endpointBase(): string | null {
  const base = process.env.LT_BASE_URL;
  if (!base) return null;
  try {
    return new URL(base).toString().replace(/\/$/u, "");
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function languageToolCheckParagraphs(paragraphs: string[]): Promise<{ issuesPerParagraph: LanguageToolIssue[][]; degradedParagraphs: number[] }> {
  const base = endpointBase();
  if (!base) throw new LanguageToolClientError("language_tool_not_configured");
  const issuesPerParagraph: LanguageToolIssue[][] = [];
  const degradedParagraphs: number[] = [];
  for (let index = 0; index < paragraphs.length; index++) {
    try {
      const issues = await languageToolCheckText(paragraphs[index], base);
      issuesPerParagraph.push(issues);
    } catch (error) {
      logError("languagetool_check", error, { paragraphIndex: index });
      issuesPerParagraph.push([]);
      degradedParagraphs.push(index);
    }
  }
  return { issuesPerParagraph, degradedParagraphs };
}

async function languageToolCheckText(text: string, base: string): Promise<LanguageToolIssue[]> {
  if (!text) return [];
  const params = new URLSearchParams();
  params.set("text", text);
  params.set("language", "en-US");
  let response: Response;
  try {
    response = await fetch(`${base}/v2/check`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
  } catch {
    throw new LanguageToolClientError("language_tool_unreachable");
  }
  if (response.status !== 200) throw new LanguageToolClientError(`language_tool_http_${response.status}`);
  let data: unknown;
  try {
    data = (await response.json()) as unknown;
  } catch {
    throw new LanguageToolClientError("language_tool_invalid_response");
  }
  if (!isRecord(data) || !Array.isArray(data.matches)) throw new LanguageToolClientError("language_tool_invalid_response");
  const issues: LanguageToolIssue[] = [];
  for (const item of data.matches.slice(0, 120)) {
    const row = isRecord(item) ? item : null;
    const rule = row && isRecord(row.rule) ? row.rule : null;
    const category = rule && isRecord(rule.category) ? rule.category : null;
    const offset = row && typeof row.offset === "number" ? row.offset : NaN;
    const length = row && typeof row.length === "number" ? row.length : NaN;
    const message = row && typeof row.message === "string" ? row.message : "";
    const shortMessage = row && typeof row.shortMessage === "string" ? row.shortMessage : message;
    const ruleId = rule && typeof rule.id === "string" ? rule.id : "unknown";
    const categoryName = category && typeof category.id === "string" ? category.id : "unknown";
    if (!message || !Number.isFinite(offset) || !Number.isFinite(length) || row === null) continue;
    const replacements = Array.isArray(row.replacements) ? row.replacements.map((r) => (isRecord(r) && typeof r.value === "string" ? r.value : "")).filter(Boolean).slice(0, 8) : [];
    issues.push({ offset, length, message, shortMessage, ruleId, category: categoryName, replacements });
  }
  return issues;
}
