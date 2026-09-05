import "server-only";

// 真實 Zotero Web API 整合（server-side only）
// Zotero API 文件：https://www.zotero.org/support/dev/web_api/v3/basics
// 認證：Zotero-API-Key header；Library：/users/{userID}/

export type ZoteroCollectionSummary = {
  key: string;
  name: string;
  parentCollection: string | null;
  numItems: number;
};

export type ZoteroSavedItem = {
  key: string;
  version: number;
};

export type ZoteroSaveResult = {
  successful: ZoteroSavedItem[];
  failed: { key: string; code: string; message: string }[];
};

export type ZoteroImportItem = {
  title: string;
  doi: string | null;
  url: string | null;
  publishedAt: string | null;
  citationCount: number | null;
  provider: string;
};

export type ZoteroLibraryItem = {
  key: string;
  itemType: string;
  title: string;
  creators: { creatorType: string; firstName?: string; lastName?: string; name?: string }[];
  year: number | null;
  publicationTitle: string | null;
  doi: string | null;
  abstractNote: string | null;
  url: string | null;
  tags: string[];
  collections: string[];
  version: number;
};

// 明確指定 library 的呼叫（v3）：production 一律帶 Zotero-API-Version: 3 header；
// 供「使用者自備 API Key（server-side 加密儲存）」與 env fallback 兩種模式共用。
async function libraryItems(apiKey: string, libraryType: "user" | "group", libraryId: string, collectionKey: string | null): Promise<ZoteroLibraryItem[]> {
  const base = "https://api.zotero.org";
  const scope = collectionKey ? `/collections/${encodeURIComponent(collectionKey)}` : "";
  const url = `${base}/${libraryType === "group" ? "groups" : "users"}/${encodeURIComponent(libraryId)}${scope}/items?limit=100&format=json&itemType=-attachment%20-note`;
  const response = await fetch(url, { method: "GET", headers: headers(apiKey), cache: "no-store", signal: AbortSignal.timeout(30_000) }).catch(() => {
    throw new ZoteroIntegrationError("zotero_transport_error", 503, "無法連線 Zotero API。");
  });
  const value = await readJsonResponse(response, "讀取 Zotero items");
  if (!Array.isArray(value)) throw new ZoteroIntegrationError("zotero_response_invalid", 502, "Zotero items 回應格式異常。");
  return value.map((entry) => {
    const item = record(entry);
    const data = record(item?.data);
    const meta = record(item?.meta);
    const creators = Array.isArray(data?.creators) ? data.creators as unknown[] : [];
    const tags = Array.isArray(data?.tags) ? data.tags as unknown[] : [];
    const collections = Array.isArray(data?.collections) ? data.collections as unknown[] : [];
    const date = typeof data?.date === "string" ? data.date : "";
    const yearMatch = date.match(/(\d{4})/u);
    return {
      key: String(item?.key ?? ""),
      itemType: String(data?.itemType ?? "journalArticle"),
      title: String(data?.title ?? ""),
      creators: creators.map((entry) => { const c = record(entry); return { creatorType: String(c?.creatorType ?? "author"), firstName: c?.firstName ? String(c.firstName) : undefined, lastName: c?.lastName ? String(c.lastName) : undefined, name: c?.name ? String(c.name) : undefined }; }),
      year: yearMatch ? Number(yearMatch[1]) : null,
      publicationTitle: data?.publicationTitle ? String(data.publicationTitle) : null,
      doi: data?.DOI ? String(data.DOI) : null,
      abstractNote: data?.abstractNote ? String(data.abstractNote) : null,
      url: data?.url ? String(data.url) : null,
      tags: tags.map((entry) => { const t = record(entry); return typeof t?.tag === "string" ? t.tag : ""; }).filter((tag) => tag.length > 0),
      collections: collections.map((entry) => String(entry)).filter((key) => key.length > 0),
      version: typeof meta?.version === "number" ? meta.version : 0,
    };
  }).filter((entry) => entry.title.length > 0);
}

export async function listZoteroLibraryItems(apiKey: string, libraryType: "user" | "group", libraryId: string, collectionKey: string | null): Promise<ZoteroLibraryItem[]> {
  return libraryItems(apiKey, libraryType, libraryId, collectionKey);
}

// 網站 → Zotero：單篇、使用者明確確認後才寫入（不批量修改使用者的 Library）。
export async function saveSingleItemToZotero(apiKey: string, libraryType: "user" | "group", libraryId: string, collectionKey: string, input: ZoteroImportItem): Promise<ZoteroSaveResult> {
  const base = "https://api.zotero.org";
  const payload = [{
    itemType: "journalArticle",
    title: input.title.slice(0, 512),
    DOI: input.doi || undefined,
    url: input.url || undefined,
    date: input.publishedAt || undefined,
    collections: [collectionKey],
    tags: [{ tag: "oldmike-import" }],
    extra: input.citationCount !== null ? `Citation count: ${input.citationCount}` : undefined,
  }];
  const response = await fetch(`${base}/${libraryType === "group" ? "groups" : "users"}/${encodeURIComponent(libraryId)}/items`, {
    method: "POST", headers: headers(apiKey), cache: "no-store", body: JSON.stringify(payload), signal: AbortSignal.timeout(30_000),
  }).catch(() => { throw new ZoteroIntegrationError("zotero_transport_error", 503, "無法連線 Zotero API。"); });
  const value = await readJsonResponse(response, "儲存至 Zotero");
  const result = record(value);
  const successful = record(result?.successful) ?? {};
  const failed = record(result?.failed) ?? {};
  return {
    successful: Object.entries(successful).map(([key, entry]) => ({ key, version: typeof record(entry)?.version === "number" ? Number(record(entry)?.version) : 0 })),
    failed: Object.entries(failed).map(([key, entry]) => ({ key, code: String(record(entry)?.code ?? "unknown"), message: String(record(entry)?.message ?? "失敗") })),
  };
}

// Full-text（v3）— 本階段不實作索引；保留端點供「深度文獻閱讀」階段在合法權限與附件可用時使用。
export async function getItemFulltext(apiKey: string, libraryType: "user" | "group", libraryId: string, itemKey: string): Promise<{ content: string; indexedChars: number | null; totalChars: number | null }> {
  const base = "https://api.zotero.org";
  const url = `${base}/${libraryType === "group" ? "groups" : "users"}/${encodeURIComponent(libraryId)}/items/${encodeURIComponent(itemKey)}/fulltext`;
  const response = await fetch(url, { method: "GET", headers: headers(apiKey), cache: "no-store", signal: AbortSignal.timeout(30_000) }).catch(() => {
    throw new ZoteroIntegrationError("zotero_transport_error", 503, "無法連線 Zotero API。");
  });
  const value = await readJsonResponse(response, "讀取 Zotero full-text");
  const row = record(value);
  return {
    content: String(row?.content ?? ""),
    indexedChars: typeof row?.indexedChars === "number" ? row.indexedChars : null,
    totalChars: typeof row?.totalChars === "number" ? row.totalChars : null,
  };
}

export class ZoteroIntegrationError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "ZoteroIntegrationError";
    this.code = code;
    this.status = status;
  }
}

function zoteroConfig() {
  const apiKey = process.env.ZOTERO_API_KEY;
  const userId = process.env.ZOTERO_USER_ID;
  if (!apiKey || !userId) {
    throw new ZoteroIntegrationError("zotero_not_configured", 503, "Zotero 整合尚未設定（缺少 ZOTERO_API_KEY / ZOTERO_USER_ID）。");
  }
  return { apiKey, userId, base: "https://api.zotero.org" };
}

function headers(apiKey: string) {
  return {
    "Zotero-API-Key": apiKey,
    "Zotero-API-Version": "3",
    "Content-Type": "application/json",
    "User-Agent": "old-mike-research-portal/1.5.54",
  };
}

async function readJsonResponse(response: Response, context: string): Promise<unknown> {
  const text = await response.text().catch(() => "");
  let value: unknown;
  try { value = text ? JSON.parse(text) : null; } catch { value = null; }
  if (!response.ok) {
    const message = record(value)?.message ? String(record(value)?.message) : `${context}失敗（HTTP ${response.status}）`;
    const code = response.status === 429 ? "zotero_rate_limited" : response.status === 403 ? "zotero_forbidden" : "zotero_upstream_error";
    throw new ZoteroIntegrationError(code, response.status, message);
  }
  return value;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export async function listZoteroCollections(): Promise<ZoteroCollectionSummary[]> {
  const { apiKey, userId, base } = zoteroConfig();
  const url = `${base}/users/${encodeURIComponent(userId)}/collections?limit=100&format=json`;
  const response = await fetch(url, { method: "GET", headers: headers(apiKey), cache: "no-store", signal: AbortSignal.timeout(15_000) }).catch(() => {
    throw new ZoteroIntegrationError("zotero_transport_error", 503, "無法連線 Zotero API。");
  });
  const value = await readJsonResponse(response, "讀取 Zotero collections");
  if (!Array.isArray(value)) throw new ZoteroIntegrationError("zotero_response_invalid", 502, "Zotero collections 回應格式異常。");
  return value.map((entry) => {
    const item = record(entry);
    const data = record(item?.data);
    const meta = record(item?.meta);
    return {
      key: String(item?.key ?? ""),
      name: String(data?.name ?? "未命名 collection"),
      parentCollection: data?.parentCollection ? String(data.parentCollection) : null,
      numItems: typeof meta?.numItems === "number" ? meta.numItems : 0,
    };
  }).filter((entry) => entry.key.length > 0);
}

export async function createZoteroCollection(name: string): Promise<string> {
  const { apiKey, userId, base } = zoteroConfig();
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 255) throw new ZoteroIntegrationError("zotero_collection_name_invalid", 422, "Collection 名稱需為 1–255 字元。");
  const response = await fetch(`${base}/users/${encodeURIComponent(userId)}/collections`, {
    method: "POST", headers: headers(apiKey), cache: "no-store",
    body: JSON.stringify([{ name: trimmed, parentCollection: false }]),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => { throw new ZoteroIntegrationError("zotero_transport_error", 503, "無法連線 Zotero API。"); });
  const value = await readJsonResponse(response, "建立 Zotero collection");
  const result = record(value);
  const successful = record(result?.successful);
  if (!successful) throw new ZoteroIntegrationError("zotero_collection_create_failed", 502, "Zotero 未回傳建立的 collection。");
  const firstKey = Object.keys(successful)[0];
  if (!firstKey) throw new ZoteroIntegrationError("zotero_collection_create_failed", 502, "Zotero 未回傳建立的 collection key。");
  return firstKey;
}

export async function saveItemsToZotero(items: ZoteroImportItem[], collectionKey: string): Promise<ZoteroSaveResult> {
  const { apiKey, userId, base } = zoteroConfig();
  if (items.length === 0) throw new ZoteroIntegrationError("zotero_items_empty", 422, "沒有可儲存的文獻。");
  if (items.length > 50) throw new ZoteroIntegrationError("zotero_items_too_many", 422, "單次最多儲存 50 筆文獻。");
  const payload = items.map((item) => ({
    itemType: "journalArticle",
    title: item.title.slice(0, 512),
    DOI: item.doi || undefined,
    url: item.url || undefined,
    date: item.publishedAt || undefined,
    collections: [collectionKey],
    tags: [{ tag: `oldmike:${item.provider}` }, { tag: "oldmike-import" }],
    extra: item.citationCount !== null ? `Citation count: ${item.citationCount}` : undefined,
  }));
  const response = await fetch(`${base}/users/${encodeURIComponent(userId)}/items`, {
    method: "POST", headers: headers(apiKey), cache: "no-store",
    body: JSON.stringify(payload), signal: AbortSignal.timeout(30_000),
  }).catch(() => { throw new ZoteroIntegrationError("zotero_transport_error", 503, "無法連線 Zotero API。"); });
  const value = await readJsonResponse(response, "儲存至 Zotero");
  const result = record(value);
  const successful = record(result?.successful) ?? {};
  const failed = record(result?.failed) ?? {};
  return {
    successful: Object.entries(successful).map(([key, entry]) => {
      const version = record(entry)?.version;
      return { key, version: typeof version === "number" ? version : 0 };
    }),
    failed: Object.entries(failed).map(([key, entry]) => {
      const meta = record(entry);
      return { key, code: String(meta?.code ?? "unknown"), message: String(meta?.message ?? "失敗") };
    }),
  };
}
