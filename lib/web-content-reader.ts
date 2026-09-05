import "server-only";

import { createHash } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import {
  resolvePublicResearchTarget,
  WebResearchPolicyError,
  type PublicResearchTarget,
  type ResearchDnsResolver,
} from "./outbound-research-policy.ts";

export const WEB_CONTENT_MAX_BYTES = 1_000_000;
export const WEB_CONTENT_MAX_TEXT_CHARS = 160_000;
export const WEB_CONTENT_TIMEOUT_MS = 12_000;
export const WEB_CONTENT_MAX_REDIRECTS = 3;

export type WebContentReaderErrorCode =
  | WebResearchPolicyError["code"]
  | "redirect_limit"
  | "invalid_redirect"
  | "web_source_timeout"
  | "web_source_unavailable"
  | "web_source_http_error"
  | "unsupported_content_type"
  | "content_too_large"
  | "empty_content";

export class WebContentReaderError extends Error {
  readonly code: WebContentReaderErrorCode;
  readonly status: number;

  constructor(code: WebContentReaderErrorCode, status: number) {
    super(code);
    this.name = "WebContentReaderError";
    this.code = code;
    this.status = status;
  }
}

export type WebContentSnapshot = {
  title: string;
  text: string;
  publishedAt?: string;
  finalUrl: string;
  canonicalUrl: string;
  retrievedAt: string;
  contentHash: string;
  bytes: number;
  contentType: string;
  status: "UNVERIFIED";
  limitations: string[];
};

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type ReadPublicWebContentOptions = {
  fetchImpl?: FetchLike;
  resolver?: ResearchDnsResolver;
  timeoutMs?: number;
  maxBytes?: number;
  now?: () => Date;
};

const redirectStatuses = new Set([301, 302, 303, 307, 308]);

function pinnedHttpsGet(target: PublicResearchTarget, signal: AbortSignal): Promise<Response> {
  const pinned = target.addresses[0];
  if (!pinned) return Promise.reject(new WebContentReaderError("blocked_dns_result", 400));
  return new Promise((resolve, reject) => {
    const request = httpsRequest({
      protocol: "https:",
      hostname: target.url.hostname,
      port: 443,
      path: `${target.url.pathname}${target.url.search}`,
      method: "GET",
      servername: isIP(target.url.hostname) ? undefined : target.url.hostname,
      rejectUnauthorized: true,
      agent: false,
      family: pinned.family,
      signal,
      headers: {
        Accept: "text/html, text/plain;q=0.9, application/json;q=0.8, application/xml;q=0.7, text/xml;q=0.7, text/csv;q=0.6",
        "Accept-Encoding": "identity",
        "User-Agent": "Old-Mike-Research-Portal-public-reader/1.0",
        Connection: "close",
      },
      lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family),
    }, (incoming) => {
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
        else if (value !== undefined) headers.set(name, value);
      }
      const status = incoming.statusCode || 502;
      const bodyForbidden = status === 101 || status === 204 || status === 205 || status === 304;
      try {
        const body = bodyForbidden ? null : Readable.toWeb(incoming) as unknown as ReadableStream<Uint8Array>;
        resolve(new Response(body, {
          status,
          statusText: incoming.statusMessage || "",
          headers,
        }));
      } catch (error) {
        incoming.destroy();
        reject(error);
      }
    });
    request.once("error", reject);
    request.end();
  });
}

async function resolveBeforeDeadline(
  input: string | URL,
  resolver: ResearchDnsResolver | undefined,
  deadline: number,
) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new WebContentReaderError("web_source_timeout", 504);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      resolvePublicResearchTarget(input, { resolver }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new WebContentReaderError("web_source_timeout", 504)), remaining);
      }),
    ]);
  } catch (error) {
    if (error instanceof WebResearchPolicyError) throw new WebContentReaderError(error.code, error.status);
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isAllowedXmlContentType(value: string) {
  return (
    value === "application/xml" ||
    value === "text/xml" ||
    value === "application/xhtml+xml" ||
    value === "application/rss+xml" ||
    value === "application/atom+xml"
  );
}

function allowedContentType(value: string) {
  return (
    value === "text/html" ||
    value === "text/plain" ||
    value === "application/json" ||
    value === "text/csv" ||
    isAllowedXmlContentType(value)
  );
}

function contentTypeFrom(response: Response) {
  return (response.headers.get("content-type") || "").split(";", 1)[0]?.trim().toLowerCase() || "";
}

function isTimeoutError(error: unknown) {
  const name = typeof error === "object" && error && "name" in error ? String((error as { name?: unknown }).name) : "";
  return name === "TimeoutError" || name === "AbortError";
}

async function cancelBody(response: Response) {
  try {
    await response.body?.cancel();
  } catch {
    // Connection cleanup is best effort and never changes the response policy.
  }
}

async function readStreamLimited(response: Response, maxBytes: number) {
  const declaredLength = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await cancelBody(response);
    throw new WebContentReaderError("content_too_large", 413);
  }
  if (!response.body) throw new WebContentReaderError("empty_content", 422);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      if (!item.value?.byteLength) continue;
      total += item.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new WebContentReaderError("content_too_large", 413);
      }
      chunks.push(item.value);
    }
  } catch (error) {
    if (error instanceof WebContentReaderError) throw error;
    if (isTimeoutError(error)) throw new WebContentReaderError("web_source_timeout", 504);
    throw new WebContentReaderError("web_source_unavailable", 502);
  }
  if (total === 0) throw new WebContentReaderError("empty_content", 422);
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
}

function decodeEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] !== "#") return named[entity.toLowerCase()] ?? match;
    const numeric = entity[1]?.toLowerCase() === "x"
      ? Number.parseInt(entity.slice(2), 16)
      : Number.parseInt(entity.slice(1), 10);
    if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 0x10ffff) return " ";
    try {
      return String.fromCodePoint(numeric);
    } catch {
      return " ";
    }
  });
}

function normalizeText(value: string, limit = WEB_CONTENT_MAX_TEXT_CHARS) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, limit);
}

function stripMarkup(value: string) {
  return normalizeText(decodeEntities(value
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<(?:noscript|template|svg|canvas)\b[^>]*>[\s\S]*?<\/(?:noscript|template|svg|canvas)\s*>/gi, " ")
    .replace(/<\/?(?:p|div|section|article|main|header|footer|aside|nav|h[1-6]|li|tr|br|hr)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")));
}

function htmlTitle(value: string) {
  const match = value.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  return match ? normalizeText(decodeEntities(match[1].replace(/<[^>]+>/g, " ")), 300) : "";
}

function htmlPublishedAt(value: string) {
  const patterns = [
    /<meta\b[^>]*(?:property|name)=["'](?:article:published_time|date|datePublished|citation_publication_date)["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:article:published_time|date|datePublished|citation_publication_date)["'][^>]*>/i,
    /<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/i,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match?.[1]) continue;
    const parsed = new Date(match[1]);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return undefined;
}

function xmlTitle(value: string) {
  const match = value.match(/<(?:[a-z][\w.-]*:)?title\b[^>]*>([\s\S]*?)<\/(?:[a-z][\w.-]*:)?title\s*>/i);
  return match ? normalizeText(decodeEntities(match[1].replace(/<[^>]+>/g, " ")), 300) : "";
}

function collectJsonText(value: unknown, output: string[], state: { nodes: number }, depth = 0) {
  if (state.nodes >= 5_000 || depth > 12) return;
  state.nodes += 1;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    output.push(String(value));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonText(item, output, state, depth + 1));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      output.push(key);
      collectJsonText(item, output, state, depth + 1);
    }
  }
}

function extractText(decoded: string, contentType: string, finalUrl: URL) {
  if (contentType === "text/html") {
    return { title: htmlTitle(decoded), text: stripMarkup(decoded), publishedAt: htmlPublishedAt(decoded) };
  }
  if (contentType === "application/json") {
    try {
      const parsed = JSON.parse(decoded) as unknown;
      const output: string[] = [];
      collectJsonText(parsed, output, { nodes: 0 });
      const title = parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? normalizeText(String((parsed as Record<string, unknown>).title || (parsed as Record<string, unknown>).name || ""), 300)
        : "";
      return { title, text: normalizeText(output.join("\n")) };
    } catch {
      throw new WebContentReaderError("empty_content", 422);
    }
  }
  if (isAllowedXmlContentType(contentType)) {
    return { title: xmlTitle(decoded), text: stripMarkup(decoded) };
  }
  const text = normalizeText(decoded);
  const firstLine = text.split("\n").find(Boolean) || "";
  return { title: normalizeText(firstLine, 300), text };
}

function fallbackTitle(url: URL) {
  const path = decodeURIComponent(url.pathname).replace(/[/_-]+/g, " ").trim();
  return normalizeText(path ? `${url.hostname} — ${path}` : url.hostname, 300);
}

export async function readPublicWebContent(input: string | URL, options: ReadPublicWebContentOptions = {}): Promise<WebContentSnapshot> {
  const fetchImpl = options.fetchImpl;
  const timeoutMs = Math.max(1, Math.min(options.timeoutMs || WEB_CONTENT_TIMEOUT_MS, 30_000));
  const maxBytes = Math.max(1, Math.min(options.maxBytes || WEB_CONTENT_MAX_BYTES, WEB_CONTENT_MAX_BYTES));
  const deadline = Date.now() + timeoutMs;
  let target = await resolveBeforeDeadline(input, options.resolver, deadline);
  let current = target.url;

  let response: Response | undefined;
  for (let redirects = 0; redirects <= WEB_CONTENT_MAX_REDIRECTS; redirects += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new WebContentReaderError("web_source_timeout", 504);
    try {
      const signal = AbortSignal.timeout(remaining);
      response = fetchImpl
        ? await fetchImpl(current.toString(), {
            method: "GET",
            redirect: "manual",
            credentials: "omit",
            cache: "no-store",
            headers: {
              Accept: "text/html, text/plain;q=0.9, application/json;q=0.8, application/xml;q=0.7, text/xml;q=0.7, text/csv;q=0.6",
              "Accept-Encoding": "identity",
              "User-Agent": "Old-Mike-Research-Portal-public-reader/1.0",
            },
            signal,
          })
        : await pinnedHttpsGet(target, signal);
    } catch (error) {
      if (isTimeoutError(error)) throw new WebContentReaderError("web_source_timeout", 504);
      throw new WebContentReaderError("web_source_unavailable", 502);
    }

    if (!redirectStatuses.has(response.status)) break;
    await cancelBody(response);
    if (redirects >= WEB_CONTENT_MAX_REDIRECTS) throw new WebContentReaderError("redirect_limit", 502);
    const location = response.headers.get("location");
    if (!location) throw new WebContentReaderError("invalid_redirect", 502);
    try {
      target = await resolveBeforeDeadline(new URL(location, current), options.resolver, deadline);
      current = target.url;
    } catch (error) {
      if (error instanceof TypeError) throw new WebContentReaderError("invalid_redirect", 502);
      throw error;
    }
  }

  if (!response) throw new WebContentReaderError("web_source_unavailable", 502);
  if (response.status < 200 || response.status >= 300) {
    await cancelBody(response);
    throw new WebContentReaderError("web_source_http_error", 502);
  }

  const contentType = contentTypeFrom(response);
  if (!allowedContentType(contentType)) {
    await cancelBody(response);
    throw new WebContentReaderError("unsupported_content_type", 415);
  }

  const body = await readStreamLimited(response, maxBytes);
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(body);
  const extracted = extractText(decoded, contentType, current);
  if (!extracted.text) throw new WebContentReaderError("empty_content", 422);

  const retrievedAt = (options.now || (() => new Date()))().toISOString();
  const finalUrl = current.toString();
  return {
    title: extracted.title || fallbackTitle(current),
    text: extracted.text,
    publishedAt: extracted.publishedAt,
    finalUrl,
    canonicalUrl: finalUrl,
    retrievedAt,
    contentHash: createHash("sha256").update(body).digest("hex"),
    bytes: body.byteLength,
    contentType,
    status: "UNVERIFIED",
    limitations: [
      "公開 HTTPS 內容一律視為不可信且未經驗證。",
      "未執行 JavaScript；動態、登入後或付費內容可能不完整。",
      "摘要與建議僅供研究規劃，使用前仍須回到原始來源人工核對。",
    ],
  };
}
