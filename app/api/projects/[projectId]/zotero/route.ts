import "server-only";

import { NextResponse } from "next/server";
import { originAllowed } from "@/lib/auth-http";
import { guardSensitiveAuthRateLimit } from "@/lib/persistent-rate-limit";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { ZoteroIntegrationError, listZoteroLibraryItems, saveSingleItemToZotero } from "@/lib/zotero-integration";
import {
  ResearchProjectRepositoryError,
  ResearchProjectStorageUnavailable,
  addLiteratureToProject,
  clearZoteroConnection,
  getResearchProject,
  getZoteroConnection,
  listProjectLiterature,
  markZoteroSynced,
  saveZoteroConnection,
} from "@/lib/research-project-repository";
import { listZoteroProjectBindings, markProjectBindingsDisconnected, upsertZoteroProjectBinding } from "@/lib/zotero-binding-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }

async function readBody(request: Request, maximumBytes = 16_000) {
  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > maximumBytes) return null;
  const body = await request.text();
  if (!body || Buffer.byteLength(body, "utf8") > maximumBytes) return null;
  try { return JSON.parse(body) as unknown; } catch { return null; }
}

function toItem(item: { key: string; itemType: string; title: string; creators: { creatorType: string; firstName?: string; lastName?: string; name?: string }[]; year: number | null; publicationTitle: string | null; doi: string | null; abstractNote: string | null; url: string | null; tags: string[]; collections: string[]; version: number }) {
  return {
    title: item.title,
    authors: item.creators.map((creator) => ({ given: creator.firstName, family: creator.lastName ?? creator.name })),
    year: item.year,
    journal: item.publicationTitle,
    doi: item.doi,
    abstract: item.abstractNote,
    itemType: item.itemType,
    url: item.url,
    tags: item.tags,
    zoteroItemKey: item.key,
    source: "ZOTERO_IMPORT" as const,
  };
}

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!originAllowed(request)) return json({ ok: false, code: "origin_rejected", error: "要求來源不符合安全政策。" }, 403);
  try {
    const { projectId } = await context.params;
    const authenticated = await requireAuthenticatedUser();
    if (!authenticated.ok) return authenticated.response;
    const tenant = await resolveResearchTenant(authenticated.session.user.id, projectId);
    if (!tenant) return json({ ok: false, code: "research_project_not_found" }, 404);
    const connection = await getZoteroConnection(tenant, authenticated.session.user.id);
    const project = await getResearchProject(tenant).catch(() => null);
    const bindings = await listZoteroProjectBindings(tenant).catch(() => []);
    return json({
      ok: true,
      connection: connection ? { libraryType: connection.libraryType, libraryId: connection.libraryId, collectionKey: connection.collectionKey, collectionName: connection.collectionName, authMethod: connection.authMethod, lastSyncedAt: connection.lastSyncedAt, syncStatus: connection.syncStatus, hasApiKey: Boolean(connection.apiKey) } : null,
      bindings,
      projectZotero: project?.zotero ?? null,
    });
  } catch (error) { return publicError(error); }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!originAllowed(request)) return json({ ok: false, code: "origin_rejected", error: "要求來源不符合安全政策。" }, 403);
  try {
    const { projectId } = await context.params;
    const authenticated = await requireAuthenticatedUser();
    if (!authenticated.ok) return authenticated.response;
    const tenant = await resolveResearchTenant(authenticated.session.user.id, projectId);
    if (!tenant) return json({ ok: false, code: "research_project_not_found" }, 404);
    const body = await readBody(request);
    if (!record(body) || typeof body.action !== "string") return json({ ok: false, code: "invalid_zotero_action", error: "請求格式不正確。" }, 400);
    const userId = authenticated.session.user.id;
    const limited = await guardSensitiveAuthRateLimit({ scope: "zotero:action", identifier: `${userId}:${projectId}`, windowSeconds: 600, max: 60 });
    if (limited) return limited;

    switch (body.action) {
      case "connect": {
        const apiKey = typeof body.apiKey === "string" && body.apiKey.trim().length >= 8 && body.apiKey.trim().length <= 256 ? body.apiKey.trim() : "";
        const libraryType = body.libraryType === "group" ? "group" as const : "user" as const;
        const libraryId = typeof body.libraryId === "string" && body.libraryId.trim() ? body.libraryId.trim().slice(0, 100) : "";
        if (!apiKey || !libraryId) return json({ ok: false, code: "invalid_zotero_connect", error: "必須提供 Zotero API Key 與 Library ID。" }, 400);
        // 連線前先驗證 key 有效（讀取 library items）
        await listZoteroLibraryItems(apiKey, libraryType, libraryId, null);
        await saveZoteroConnection(tenant, {
          userId,
          connection: {
            libraryType,
            libraryId,
            collectionKey: typeof body.collectionKey === "string" && body.collectionKey.trim() ? body.collectionKey.trim().slice(0, 100) : null,
            collectionName: typeof body.collectionName === "string" && body.collectionName.trim() ? body.collectionName.trim().slice(0, 255) : null,
            authMethod: "API_KEY",
            apiKey,
          },
        });
        await markZoteroSynced(tenant, { userId, status: "CONNECTED", libraryType, libraryId, collectionKey: typeof body.collectionKey === "string" ? body.collectionKey.trim() : undefined });
        await upsertZoteroProjectBinding(tenant, { userId, libraryType, libraryId, collectionKey: typeof body.collectionKey === "string" ? body.collectionKey.trim() : null, collectionName: typeof body.collectionName === "string" ? body.collectionName.trim() : null, bindingStatus: "CONNECTED" }).catch(() => undefined);
        return json({ ok: true, note: "Zotero 已連線；API Key 僅存於伺服器端（加密）。" });
      }
      case "disconnect": {
        await clearZoteroConnection(tenant, { userId });
        await markProjectBindingsDisconnected(tenant, userId).catch(() => undefined);
        return json({ ok: true, note: "已斷開 Zotero；網站內既有文獻與研究資料未刪除。" });
      }
      case "sync": {
        const connection = await getZoteroConnection(tenant, userId);
        if (!connection?.apiKey) return json({ ok: false, code: "zotero_not_connected", error: "尚未連線 Zotero。" }, 422);
        await markZoteroSynced(tenant, { userId, status: "SYNCING" });
        try {
          const items = await listZoteroLibraryItems(connection.apiKey, connection.libraryType as "user" | "group", connection.libraryId, connection.collectionKey);
          let imported = 0;
          for (const item of items) {
            await addLiteratureToProject(tenant, { userId, item: { ...toItem(item), zoteroCollectionKey: connection.collectionKey ?? undefined, zoteroLibraryType: connection.libraryType as "user" | "group", zoteroLibraryId: connection.libraryId }, link: { readingStatus: "DISCOVERED", evidenceStatus: "UNVERIFIED" } });
            imported += 1;
          }
          await markZoteroSynced(tenant, { userId, status: "SYNCED", libraryType: connection.libraryType, libraryId: connection.libraryId, collectionKey: connection.collectionKey ?? undefined });
          await upsertZoteroProjectBinding(tenant, { userId, libraryType: connection.libraryType as "user" | "group", libraryId: connection.libraryId, collectionKey: connection.collectionKey ?? null, collectionName: connection.collectionName ?? null, bindingStatus: "SYNCED", lastSuccessfulSyncAt: new Date(), lastError: null }).catch(() => undefined);
          return json({ ok: true, imported, note: `已從 Zotero 同步 ${imported} 筆文獻（含去重）。` });
        } catch (syncError) {
          // 同步中途失敗：回寫 SYNC_ERROR，避免狀態卡在 SYNCING
          try { await markZoteroSynced(tenant, { userId, status: "SYNC_ERROR" }); } catch { /* 狀態回寫失敗不遮罩原始錯誤 */ }
          await upsertZoteroProjectBinding(tenant, { userId, libraryType: connection.libraryType as "user" | "group", libraryId: connection.libraryId, collectionKey: connection.collectionKey ?? null, collectionName: connection.collectionName ?? null, bindingStatus: "SYNC_FAILED", lastError: syncError instanceof Error ? syncError.message.slice(0, 300) : "sync_failed" }).catch(() => undefined);
          throw syncError;
        }
      }
      case "export": {
        // 網站 → Zotero：僅在單篇明確確認（點「加入Zotero」）後寫入
        const literatureId = typeof body.literatureId === "string" && body.literatureId.trim() ? body.literatureId.trim() : "";
        if (!literatureId) return json({ ok: false, code: "invalid_literature_id", error: "缺少文獻 ID。" }, 400);
        const connection = await getZoteroConnection(tenant, userId);
        if (!connection?.apiKey) return json({ ok: false, code: "zotero_not_connected", error: "尚未連線 Zotero。" }, 422);
        if (!connection.collectionKey) return json({ ok: false, code: "zotero_collection_missing", error: "尚未指定 Zotero Collection：請按「Zotero 已連線・管理」重新連線並填入 Collection Key（Zotero 網頁 → 建立資料夾 → 資料夾資訊 → Copy Key）。" }, 422);
        const items = await listProjectLiterature(tenant);
        const item = items.find((entry) => entry.literatureId === literatureId);
        if (!item) return json({ ok: false, code: "literature_not_linked", error: "文獻不存在於此專案。" }, 404);
        const result = await saveSingleItemToZotero(connection.apiKey, connection.libraryType as "user" | "group", connection.libraryId, connection.collectionKey, {
          title: item.title,
          doi: item.doi,
          url: item.url,
          publishedAt: item.year ? String(item.year) : null,
          citationCount: item.citationCount,
          provider: "portal",
        });
        if (result.failed.length) return json({ ok: false, code: "zotero_export_failed", error: `Zotero 拒絕寫入：${result.failed[0].message}` }, 502);
        const savedKey = result.successful[0]?.key;
        if (savedKey) {
          await addLiteratureToProject(tenant, { userId, item: { title: item.title, doi: item.doi, url: item.url, source: "WEB_SEARCH", zoteroItemKey: savedKey, zoteroCollectionKey: connection.collectionKey }, link: {}, auditAction: "LITERATURE_ADDED" });
        }
        await markZoteroSynced(tenant, { userId, status: "SYNCED", collectionKey: connection.collectionKey ?? undefined });
        return json({ ok: true, zoteroItemKey: savedKey ?? null, note: "已加入 Zotero（單篇、經你確認）。" });
      }
      default:
        return json({ ok: false, code: "invalid_zotero_action", error: "不支援的操作。" }, 422);
    }
  } catch (error) { return publicError(error); }
}

function publicError(error: unknown) {
  if (error instanceof ZoteroIntegrationError) return json({ ok: false, code: error.code, error: error.message }, error.status);
  if (error instanceof ResearchProjectRepositoryError) return json({ ok: false, code: error.code, error: "Zotero 操作未通過契約。" }, error.status);
  if (error instanceof ResearchProjectStorageUnavailable || error instanceof ResearchStorageUnavailable) return json({ ok: false, code: "research_project_storage_unavailable", error: "Zotero 整合目前不可用。" }, 503);
  const code = typeof (error as { code?: unknown } | null)?.code === "string" ? String((error as { code: string }).code) : "";
  if (code === "42P01" || code === "42703" || code === "3D000") return json({ ok: false, code: "research_project_storage_unavailable", error: "Zotero 整合目前不可用。" }, 503);
  const detail = error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 300) : "unknown_error";
  return json({ ok: false, code: "zotero_unavailable", error: `老麥目前無法完成這項操作（${detail}）；正式資料沒有被變更。` }, 503);
}
