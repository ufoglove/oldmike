import "server-only";

import { alpha3OriginAllowed, alpha3Response, boundedAlpha3Json } from "@/lib/v2-alpha3/http";
import { resolveV2Alpha3Principal } from "@/lib/v2-alpha3/runtime";
import {
  ZOTERO_EXACT_UI_ACTIONS,
  ZOTERO_PROJECT_COLLECTIONS,
  applyVersionedZoteroItemUpdate,
  createCitationStyleSnapshot,
  createSyntheticZoteroBindings,
  createSyntheticZoteroReceipt,
  encodeBibTeX,
  encodeCslJson,
  encodeRis,
  parseOfflineCitationInterchange,
  renderTargetJournalBibliography,
  sha256Zotero,
  type CitationInterchangeFormat,
  type ZoteroSyncReceipt,
} from "@/lib/v2-alpha4-r1/zotero-contracts";
import { V2_ALPHA4_R1_PROJECT_REF_HASH, V2_ALPHA4_R1_ROUTE_CONTRACT } from "@/lib/v2-alpha4-r1/page-authority";

type Action = "IMPORT" | "SAVE" | "SYNC" | "INSERT_CITATION" | "EXPORT_BIBLIOGRAPHY";
const actionMap: Record<Action, typeof ZOTERO_EXACT_UI_ACTIONS[number]> = { IMPORT: "從 Zotero 匯入", SAVE: "儲存到 Zotero", SYNC: "同步此專案", INSERT_CITATION: "插入引用", EXPORT_BIBLIOGRAPHY: "匯出參考文獻" };
const settled = new Map<string, { requestHash: string; response: unknown }>();
const fixtureMetadata = { title: "Evidence calibration in teacher decisions", year: 2025, firstAuthor: "Lin", authors: ["Lin, Mei"], journal: "Journal of Evidence", doi: "10.1000/fixture.1", pmid: null, arxiv: null, isbn: null };

function enabled() {
  return process.env.NODE_ENV === "development" && process.env.TEST_FIXTURE === "1" && process.env.OLD_MIKE_V2_ALPHA4_R1_LOCAL_PROTOTYPE === "1";
}

export async function POST(request: Request) {
  if (!enabled()) return alpha3Response({ ok: false, code: "not_found" }, 404);
  if (!alpha3OriginAllowed(request)) return alpha3Response({ ok: false, code: "origin_rejected" }, 403);
  const authority = await resolveV2Alpha3Principal(request);
  if (!authority.ok) return alpha3Response({ ok: false, code: authority.code }, authority.status);
  try {
    const input = await boundedAlpha3Json(request) as Record<string, unknown>;
    const action = String(input.action ?? "") as Action;
    if (!Object.hasOwn(actionMap, action)) throw new Error("zotero_action_invalid");
    const requestId = String(input.requestId ?? "");
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/u.test(requestId)) throw new Error("zotero_request_id_invalid");
    if (input.projectRefHash !== V2_ALPHA4_R1_PROJECT_REF_HASH) throw new Error("zotero_project_authority_invalid");
    const collectionLabel = String(input.collectionLabel ?? "");
    if (!(ZOTERO_PROJECT_COLLECTIONS as readonly string[]).includes(collectionLabel)) throw new Error("zotero_collection_selection_required");
    const requestHash = sha256Zotero({ action, projectRefHash: input.projectRefHash, collectionLabel, format: input.format ?? null, expectedVersion: input.expectedVersion ?? null });
    const key = `${authority.principal.workspaceId}:${authority.principal.userId}:${requestId}`;
    const prior = settled.get(key);
    if (prior) {
      if (prior.requestHash !== requestHash) return alpha3Response({ ok: false, code: "zotero_idempotency_conflict" }, 409);
      return alpha3Response({ ...(prior.response as Record<string, unknown>), replayed: true, liveApiCallCount: 0 }, 200);
    }

    const bindings = createSyntheticZoteroBindings({ projectRefHash: V2_ALPHA4_R1_PROJECT_REF_HASH, collectionLabel });
    if (bindings.collection.libraryKey !== bindings.library.libraryKey || bindings.item.collectionKey !== bindings.collection.collectionKey) throw new Error("zotero_collection_scope_invalid");
    let receipt: ZoteroSyncReceipt;
    let item = bindings.item;
    let interchange: unknown = null;
    let citation: unknown = null;
    let bibliography: unknown = null;
    if (action === "IMPORT") {
      const format = String(input.format ?? "CSL_JSON") as CitationInterchangeFormat;
      const source = format === "RIS" ? encodeRis([fixtureMetadata]) : format === "BIBTEX" ? encodeBibTeX([fixtureMetadata]) : encodeCslJson([fixtureMetadata]);
      interchange = parseOfflineCitationInterchange(format, source);
      receipt = createSyntheticZoteroReceipt("IMPORT", { itemsRead: 1, itemsWritten: 0 });
    } else if (action === "SAVE") {
      const expectedVersion = Number(input.expectedVersion);
      const update = applyVersionedZoteroItemUpdate(bindings.item, expectedVersion, fixtureMetadata);
      if (update.status === 412) return alpha3Response({ ok: false, contractVersion: V2_ALPHA4_R1_ROUTE_CONTRACT, code: update.code, status: 412, overwritten: false, collectionLabel, liveApiCallCount: 0, attachmentsTransferred: 0, rawBodyRetained: false }, 412);
      item = update.item;
      receipt = createSyntheticZoteroReceipt("SAVE", { itemsRead: 0, itemsWritten: 1 });
    } else if (action === "SYNC") receipt = createSyntheticZoteroReceipt("SYNC", { itemsRead: 1, itemsWritten: 0 });
    else if (action === "INSERT_CITATION") {
      citation = { citationSnapshotHash: bindings.item.citationSnapshot.snapshotHash, itemBindingHash: bindings.item.normalizedMetadataHash, evidenceLedgerRefHash: bindings.item.evidenceLedgerRefHash, text: "(Lin, 2025)", auditRequired: true };
      receipt = createSyntheticZoteroReceipt("INSERT_CITATION", { itemsRead: 1, itemsWritten: 0 });
    } else {
      const style = createCitationStyleSnapshot({ targetJournalId: "journal-fixture-scie", styleId: "apa", styleTitle: "Synthetic target-journal author-date", styleVersion: "2026-08-24" });
      bibliography = { style, ...renderTargetJournalBibliography([fixtureMetadata], style), offline: { ris: encodeRis([fixtureMetadata]), bibtex: encodeBibTeX([fixtureMetadata]), cslJson: encodeCslJson([fixtureMetadata]) } };
      receipt = createSyntheticZoteroReceipt("EXPORT_BIBLIOGRAPHY", { itemsRead: 1, itemsWritten: 0 });
    }
    const response = { ok: true, contractVersion: V2_ALPHA4_R1_ROUTE_CONTRACT, action, actionLabel: actionMap[action], library: bindings.library, collection: bindings.collection, item, receipt, interchange, citation, bibliography, replayed: false, liveApiCallCount: 0, attachmentsTransferred: 0, pdfTransferred: 0, rawBodyRetained: false, formalResearchWriteCount: 0, externalMutationCount: 0 };
    settled.set(key, { requestHash, response });
    return alpha3Response(response, 200);
  } catch {
    return alpha3Response({ ok: false, code: "zotero_contract_invalid" }, 400);
  }
}
