import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ZoteroIntegrationError, listZoteroCollections, createZoteroCollection, saveItemsToZotero, type ZoteroImportItem } from "@/lib/zotero-integration";

export const dynamic = "force-dynamic";

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > 100_000) throw new ZoteroIntegrationError("request_too_large", 413, "請求超過大小限制。");
  const raw = await request.text().catch(() => "");
  if (!raw || raw.length > 100_000) throw new ZoteroIntegrationError("invalid_body", 400, "請求格式不正確。");
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not_object");
    return parsed as Record<string, unknown>;
  } catch {
    throw new ZoteroIntegrationError("invalid_json", 400, "請求不是有效 JSON。");
  }
}

export async function GET() {
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) return authenticated.response;
  try {
    const collections = await listZoteroCollections();
    return NextResponse.json({ ok: true, collections }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ZoteroIntegrationError) return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, code: "zotero_unavailable", error: "Zotero 整合目前無法使用。" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) return authenticated.response;
  try {
    const body = await readBody(request);
    const action = String(body.action ?? "");
    if (action === "CREATE_COLLECTION") {
      const name = String(body.name ?? "");
      const key = await createZoteroCollection(name);
      return NextResponse.json({ ok: true, collectionKey: key }, { headers: { "Cache-Control": "no-store" } });
    }
    if (action === "SAVE_ITEMS") {
      const collectionKey = String(body.collectionKey ?? "");
      if (!/^[A-Z0-9]{8}$/u.test(collectionKey)) throw new ZoteroIntegrationError("zotero_collection_key_invalid", 422, "Collection key 格式不正確。");
      const rawItems = Array.isArray(body.items) ? body.items : [];
      const items: ZoteroImportItem[] = rawItems.map((entry) => {
        const item = typeof entry === "object" && entry !== null ? entry as Record<string, unknown> : {};
        return {
          title: String(item.title ?? ""),
          doi: item.doi ? String(item.doi) : null,
          url: item.url ? String(item.url) : null,
          publishedAt: item.publishedAt ? String(item.publishedAt) : null,
          citationCount: typeof item.citationCount === "number" ? item.citationCount : null,
          provider: String(item.provider ?? "unknown"),
        };
      }).filter((item) => item.title.length > 0);
      const result = await saveItemsToZotero(items, collectionKey);
      return NextResponse.json({ ...result }, { headers: { "Cache-Control": "no-store" } });
    }
    throw new ZoteroIntegrationError("zotero_action_invalid", 422, "不支援的操作。");
  } catch (error) {
    if (error instanceof ZoteroIntegrationError) return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, code: "zotero_unavailable", error: "Zotero 整合目前無法使用。" }, { status: 503 });
  }
}
