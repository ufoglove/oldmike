import assert from "node:assert/strict";

import {
  ZOTERO_PROJECT_COLLECTIONS,
  ZOTERO_EXACT_UI_ACTIONS,
  ZOTERO_FUTURE_WEB_API_CONTRACT,
  applyVersionedZoteroItemUpdate,
  bindDeletedZoteroItem,
  classifyZoteroDuplicates,
  createCitationStyleSnapshot,
  createSyntheticZoteroBindings,
  encodeBibTeX,
  encodeCslJson,
  encodeRis,
  parseOfflineCitationInterchange,
  parseZoteroCollectionBinding,
  parseZoteroItemBinding,
  parseZoteroLibraryBinding,
  parseZoteroSyncReceipt,
  renderTargetJournalBibliography,
} from "../lib/v2-alpha4-r1/zotero-contracts.ts";

let assertions = 0;
const equal = (actual, expected, message) => { assertions += 1; assert.deepEqual(actual, expected, message); };
const ok = (actual, message) => { assertions += 1; assert.ok(actual, message); };
const throws = (fn, matcher, message) => { assertions += 1; assert.throws(fn, matcher, message); };

const bindings = createSyntheticZoteroBindings({ projectRefHash: "a".repeat(64), collectionLabel: "01_核心證據" });
equal(parseZoteroLibraryBinding({ ...bindings.library, additiveIgnored: true }), bindings.library, "library exact consumed fields with additive tolerance");
equal(parseZoteroCollectionBinding(bindings.collection).selected, true, "selected project collection explicit");
equal(parseZoteroItemBinding(bindings.item).attachmentPolicy, "METADATA_AND_SELECTED_NOTES_ONLY", "default data minimisation");
equal(parseZoteroSyncReceipt(bindings.receipt).completionClass, "COMPLETE", "sanitized sync receipt");
equal(ZOTERO_PROJECT_COLLECTIONS, ["00_待整理", "01_核心證據", "02_理論與方法", "03_目標期刊", "04_已引用", "99_排除"], "suggested project collections exact");
equal(ZOTERO_EXACT_UI_ACTIONS, ["從 Zotero 匯入", "儲存到 Zotero", "同步此專案", "插入引用", "匯出參考文獻"], "exact user-facing Zotero actions");
equal(ZOTERO_FUTURE_WEB_API_CONTRACT, { apiVersion: "v3", enabled: false, transport: "HTTPS_SERVER_ONLY", credentialAuthority: "DEDICATED_MINIMAL_PERMISSION_KEY_REFERENCE", scope: "EXPLICIT_SELECTED_LIBRARY_AND_COLLECTION", conditionalWrite: "IF_UNMODIFIED_SINCE_VERSION_OR_OBJECT_VERSION", conflictStatus: 412, blindOverwrite: false, deleteMergeBulkMutation: false }, "future API contract disabled and minimal permission");
throws(() => parseZoteroCollectionBinding({ ...bindings.collection, selected: false }), /zotero_collection_selection_required/u, "implicit collection rejected");

const base = { title: "Evidence calibration in teacher decisions", year: 2025, firstAuthor: "Lin", authors: ["Lin, Mei"], journal: "Journal of Evidence", doi: "10.1000/fixture.1", pmid: null, arxiv: null, isbn: null };
equal(classifyZoteroDuplicates(base, [{ ...base, title: "Different title" }]).classification, "EXACT_DOI", "DOI first dedupe");
equal(classifyZoteroDuplicates({ ...base, doi: null, pmid: "12345" }, [{ ...base, doi: null, pmid: "12345" }]).classification, "EXACT_STABLE_ID", "PMID stable id dedupe");
equal(classifyZoteroDuplicates({ ...base, doi: null }, [{ ...base, doi: null }]).classification, "EXACT_NORMALIZED_METADATA", "exact normalized metadata dedupe");
equal(classifyZoteroDuplicates({ ...base, doi: null, title: "Teacher decisions through evidence calibration" }, [{ ...base, doi: null }]).classification, "POSSIBLE_DUPLICATE_REVIEW", "fuzzy candidate never auto merged");
equal(classifyZoteroDuplicates({ ...base, doi: null, title: "Unrelated evidence synthesis", firstAuthor: "Chen" }, [{ ...base, doi: null }]).classification, "DISTINCT", "distinct citation remains separate");

for (const [format, encoded] of [["RIS", encodeRis([base])], ["BIBTEX", encodeBibTeX([base])], ["CSL_JSON", encodeCslJson([base])]]) {
  const parsed = parseOfflineCitationInterchange(format, encoded);
  equal(parsed.items.length, 1, `${format} round trip one item`);
  equal(parsed.items[0].doi, base.doi, `${format} DOI round trip`);
  equal(parsed.issues.length, 0, `${format} round trip no issue`);
}
const isolated = parseOfflineCitationInterchange("CSL_JSON", JSON.stringify([{ id: "bad" }, JSON.parse(encodeCslJson([base]))[0]]));
equal([isolated.items.length, isolated.issues.length], [1, 1], "malformed sibling isolated");

const conflict = applyVersionedZoteroItemUpdate(bindings.item, bindings.item.objectVersion - 1, { ...base, title: "Conflicting update" });
equal(conflict, { status: 412, code: "ZOTERO_VERSION_CONFLICT", overwritten: false, item: bindings.item }, "412 visible conflict with zero blind overwrite");
const updated = applyVersionedZoteroItemUpdate(bindings.item, bindings.item.objectVersion, base);
equal([updated.status, updated.overwritten, updated.item.objectVersion], [200, false, bindings.item.objectVersion + 1], "matching object version updates once");

const deleted = bindDeletedZoteroItem(bindings.item);
equal(deleted.availability, "UNAVAILABLE_TOMBSTONED", "deleted item binding unavailable");
equal(deleted.citationSnapshot, bindings.item.citationSnapshot, "Portal citation snapshot preserved after deletion");

const style = createCitationStyleSnapshot({ targetJournalId: "journal-fixture-scie", styleId: "apa", styleTitle: "Synthetic target-journal author-date", styleVersion: "2026-08-24" });
const bibliography1 = renderTargetJournalBibliography([base], style);
const bibliography2 = renderTargetJournalBibliography([base], style);
equal(bibliography1, bibliography2, "CSL snapshot bibliography reproducible");
ok(bibliography1.text.includes("Evidence calibration in teacher decisions"), "bibliography contains normalized title");
equal(bibliography1.styleSnapshotHash, style.snapshotHash, "bibliography bound to exact CSL snapshot");

equal(bindings.receipt.attachmentsTransferred, 0, "no attachment or PDF transfer");
equal(bindings.receipt.rawBodyRetained, false, "no raw provider body retained");
equal(bindings.receipt.notesPolicy, "BOUNDED_USER_SELECTED_ONLY", "only bounded selected notes allowed");
equal(bindings.receipt.liveApiCallCount, 0, "live Zotero API calls zero");

console.log(`PASS V2_ALPHA4_R1_ZOTERO_CONTRACTS assertions=${assertions} scenario_groups=8 live_api_calls=0 attachments=0 pdfs=0 raw_bodies=0 external_mutations=0`);
