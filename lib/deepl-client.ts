import "server-only";

import { logError, logLine } from "./server-log.ts";

// DeepL API client（獨立翻譯引擎選項用）。
// 安全原則：
// - API Key 只從環境變數 DEEPL_API_KEY 讀取，永不寫入 DB、程式碼或前端。
// - DEEPL_BASE_URL 僅允許測試用本機 override（127.0.0.1/localhost http）。
// - 送出的文字會傳送至 DeepL（第三方）伺服器；由呼叫端負責向使用者揭露。

export type DeepLTask = "TRANSLATE_ZH_EN" | "TRANSLATE_EN_ZH_TW";

export class DeepLProviderError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number) {
    super(code);
    this.name = "DeepLProviderError";
    this.code = code;
    this.status = status;
  }
}

function apiKey(): string | null {
  const key = process.env.DEEPL_API_KEY;
  return typeof key === "string" && key.trim().length >= 16 ? key.trim() : null;
}

export function deepLConfigured(): boolean {
  return apiKey() !== null;
}

function endpointBase(): string {
  const override = process.env.DEEPL_BASE_URL;
  if (override) {
    try {
      const url = new URL(override);
      if (url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost")) return override.replace(/\/$/u, "");
    } catch { /* 忽略無效 override */ }
  }
  const key = apiKey() ?? "";
  // :fx 後綴 = DeepL API Free → api-free；其餘付費 → api.deepl.com
  return key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
}

async function deeplJson(path: string, body: Record<string, unknown>, maximumBytes = 200_000): Promise<{ status: number; data: unknown }> {
  const key = apiKey();
  if (!key) throw new DeepLProviderError("deepl_not_configured", 503);
  let response: Response;
  try {
    response = await fetch(`${endpointBase()}${path}`, {
      method: "POST",
      headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
      cache: "no-store",
    });
  } catch {
    logError("deepl_transport", new Error("deepL fetch failed"), { path });
    throw new DeepLProviderError("deepl_upstream_error", 502);
  }
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > maximumBytes) throw new DeepLProviderError("deepl_response_invalid", 502);
  if (response.status !== 200) {
    const message = text.slice(0, 300);
    if (response.status === 456) {
      logLine("warn", "deepl_quota", message.slice(0, 120), { status: response.status });
      throw new DeepLProviderError("deepl_quota_exceeded", 502);
    }
    if (response.status === 429) throw new DeepLProviderError("deepl_rate_limited", 502);
    if (response.status === 401 || response.status === 403) {
      logLine("error", "deepl_auth", "DeepL auth rejected", { status: response.status });
      throw new DeepLProviderError("deepl_auth_failed", 502);
    }
    logLine("error", "deepl_upstream", message.slice(0, 120), { status: response.status });
    throw new DeepLProviderError("deepl_upstream_error", 502);
  }
  try {
    return { status: response.status, data: JSON.parse(text) as unknown };
  } catch {
    throw new DeepLProviderError("deepl_response_invalid", 502);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// 逐段翻譯。回傳與輸入段落一對一的譯文陣列。
export async function deepLTranslateParagraphs(input: { task: DeepLTask; paragraphs: string[] }): Promise<string[]> {
  if (!input.paragraphs.length || input.paragraphs.length > 60) throw new DeepLProviderError("deepl_request_too_large", 413);
  const body: Record<string, unknown> = {
    text: input.paragraphs,
    target_lang: input.task === "TRANSLATE_EN_ZH_TW" ? "ZH-HANT" : "EN",
  };
  // 繁中（臺灣）輸入：不指定 source_lang，交由 DeepL 自動偵測（ZH-HANT 不支援作為 source code）
  if (input.task === "TRANSLATE_EN_ZH_TW") body.source_lang = "EN";
  const { data } = await deeplJson("/v2/translate", body);
  if (!isRecord(data) || !Array.isArray(data.translations) || data.translations.length !== input.paragraphs.length) throw new DeepLProviderError("deepl_response_invalid", 502);
  return data.translations.map((item) => {
    const row = isRecord(item) ? item : null;
    const text = row && typeof row.text === "string" ? row.text : "";
    if (!text) throw new DeepLProviderError("deepl_response_invalid", 502);
    return text;
  });
}
