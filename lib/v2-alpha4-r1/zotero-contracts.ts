import { createHash } from "node:crypto";

type UnknownRecord = Record<string, unknown>;
export type CitationInterchangeFormat = "RIS" | "BIBTEX" | "CSL_JSON";
export type CitationMetadata = {
  title: string;
  year: number;
  firstAuthor: string;
  authors: string[];
  journal: string;
  doi: string | null;
  pmid: string | null;
  arxiv: string | null;
  isbn: string | null;
};

export type ZoteroLibraryBinding = {
  schemaId: "old-mike-v2-alpha4-r1/zotero-library-binding/1";
  libraryKey: string;
  libraryType: "USER" | "GROUP";
  libraryVersion: number;
  scopeHash: string;
  permissionClass: "METADATA_READ_WRITE_SELECTED_COLLECTIONS";
  liveApiEnabled: false;
};

export type ZoteroCollectionBinding = {
  schemaId: "old-mike-v2-alpha4-r1/zotero-collection-binding/1";
  libraryKey: string;
  collectionKey: string;
  projectRefHash: string;
  label: string;
  objectVersion: number;
  contentHash: string;
  selected: true;
};

export type ZoteroItemBinding = {
  schemaId: "old-mike-v2-alpha4-r1/zotero-item-binding/1";
  libraryKey: string;
  collectionKey: string;
  itemKey: string;
  objectVersion: number;
  normalizedMetadataHash: string;
  evidenceLedgerRefHash: string;
  availability: "AVAILABLE" | "UNAVAILABLE_TOMBSTONED";
  attachmentPolicy: "METADATA_AND_SELECTED_NOTES_ONLY";
  citationSnapshot: { metadata: CitationMetadata; snapshotHash: string };
};

export type ZoteroSyncReceipt = {
  schemaId: "old-mike-v2-alpha4-r1/zotero-sync-receipt/1";
  operation: "IMPORT" | "SAVE" | "SYNC" | "INSERT_CITATION" | "EXPORT_BIBLIOGRAPHY";
  completionClass: "COMPLETE" | "CONFLICT" | "TERMINAL_REJECTED";
  libraryVersionBefore: number;
  libraryVersionAfter: number;
  itemsRead: number;
  itemsWritten: number;
  conflicts: number;
  overwritten: false;
  attachmentsTransferred: 0;
  rawBodyRetained: false;
  notesPolicy: "BOUNDED_USER_SELECTED_ONLY";
  liveApiCallCount: 0;
  receiptHash: string;
};

export type CitationStyleSnapshot = {
  schemaId: "old-mike-v2-alpha4-r1/citation-style-snapshot/1";
  targetJournalId: string;
  styleId: string;
  styleTitle: string;
  styleVersion: string;
  locale: "zh-TW";
  snapshotHash: string;
};

export const ZOTERO_PROJECT_COLLECTIONS = Object.freeze(["00_待整理", "01_核心證據", "02_理論與方法", "03_目標期刊", "04_已引用", "99_排除"] as const);
export const ZOTERO_EXACT_UI_ACTIONS = Object.freeze(["從 Zotero 匯入", "儲存到 Zotero", "同步此專案", "插入引用", "匯出參考文獻"] as const);
export const ZOTERO_FUTURE_WEB_API_CONTRACT = Object.freeze({
  apiVersion: "v3",
  enabled: false,
  transport: "HTTPS_SERVER_ONLY",
  credentialAuthority: "DEDICATED_MINIMAL_PERMISSION_KEY_REFERENCE",
  scope: "EXPLICIT_SELECTED_LIBRARY_AND_COLLECTION",
  conditionalWrite: "IF_UNMODIFIED_SINCE_VERSION_OR_OBJECT_VERSION",
  conflictStatus: 412,
  blindOverwrite: false,
  deleteMergeBulkMutation: false,
});

function record(value: unknown, code: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as UnknownRecord;
}
function text(value: unknown, maximum: number, code: string) {
  if (typeof value !== "string") throw new Error(code);
  const normalized = value.replace(/\r\n?/gu, "\n").trim();
  if (!normalized || normalized.length > maximum) throw new Error(code);
  return normalized;
}
function integer(value: unknown, minimum: number, maximum: number, code: string) {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) throw new Error(code);
  return value as number;
}
function exactHash(value: unknown, code: string) {
  const normalized = text(value, 64, code).toLocaleLowerCase("en-US");
  if (!/^[0-9a-f]{64}$/u.test(normalized)) throw new Error(code);
  return normalized;
}
function optionalIdentifier(value: unknown, maximum: number, code: string) {
  if (value === null || value === undefined || value === "") return null;
  return text(value, maximum, code).toLocaleLowerCase("en-US");
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as UnknownRecord).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b, "en-US")).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
export function sha256Zotero(value: unknown) { return createHash("sha256").update(typeof value === "string" ? value : canonical(value), "utf8").digest("hex"); }

function normalizeDoi(value: unknown) {
  const identifier = optionalIdentifier(value, 240, "citation_doi_invalid");
  if (!identifier) return null;
  const doi = identifier.replace(/^https?:\/\/(?:dx\.)?doi\.org\//u, "").replace(/^doi:\s*/u, "");
  if (!/^10\.\d{4,9}\/\S+$/u.test(doi)) throw new Error("citation_doi_invalid");
  return doi;
}
export function parseCitationMetadata(value: unknown): CitationMetadata {
  const input = record(value, "citation_metadata_invalid");
  const authors = Array.isArray(input.authors) ? input.authors.map((author) => text(author, 200, "citation_authors_invalid")) : [];
  if (authors.length < 1 || authors.length > 100) throw new Error("citation_authors_invalid");
  return {
    title: text(input.title, 1000, "citation_title_invalid"),
    year: integer(input.year, 1600, 2200, "citation_year_invalid"),
    firstAuthor: text(input.firstAuthor, 200, "citation_first_author_invalid"),
    authors,
    journal: text(input.journal, 500, "citation_journal_invalid"),
    doi: normalizeDoi(input.doi),
    pmid: optionalIdentifier(input.pmid, 40, "citation_pmid_invalid"),
    arxiv: optionalIdentifier(input.arxiv, 80, "citation_arxiv_invalid"),
    isbn: optionalIdentifier(input.isbn, 40, "citation_isbn_invalid"),
  };
}
function normalizedTitle(value: string) { return value.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }
function normalizedMetadata(metadata: CitationMetadata) {
  return { title: normalizedTitle(metadata.title), year: metadata.year, firstAuthor: normalizedTitle(metadata.firstAuthor), journal: normalizedTitle(metadata.journal) };
}
function titleSimilarity(left: string, right: string) {
  const a = new Set(normalizedTitle(left).split(" ").filter(Boolean));
  const b = new Set(normalizedTitle(right).split(" ").filter(Boolean));
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}
export function classifyZoteroDuplicates(candidateValue: unknown, existingValues: unknown[]) {
  const candidate = parseCitationMetadata(candidateValue);
  const existing = existingValues.map(parseCitationMetadata);
  if (candidate.doi && existing.some((item) => item.doi === candidate.doi)) return { classification: "EXACT_DOI" as const, autoMergeAllowed: true };
  for (const key of ["pmid", "arxiv", "isbn"] as const) if (candidate[key] && existing.some((item) => item[key] === candidate[key])) return { classification: "EXACT_STABLE_ID" as const, autoMergeAllowed: true };
  const exactHash = sha256Zotero(normalizedMetadata(candidate));
  if (existing.some((item) => sha256Zotero(normalizedMetadata(item)) === exactHash)) return { classification: "EXACT_NORMALIZED_METADATA" as const, autoMergeAllowed: true };
  if (existing.some((item) => item.year === candidate.year && normalizedTitle(item.firstAuthor) === normalizedTitle(candidate.firstAuthor) && titleSimilarity(item.title, candidate.title) >= 0.65)) return { classification: "POSSIBLE_DUPLICATE_REVIEW" as const, autoMergeAllowed: false };
  return { classification: "DISTINCT" as const, autoMergeAllowed: false };
}

export function parseZoteroLibraryBinding(value: unknown): ZoteroLibraryBinding {
  const input = record(value, "zotero_library_binding_invalid");
  if (input.schemaId !== "old-mike-v2-alpha4-r1/zotero-library-binding/1" || (input.libraryType !== "USER" && input.libraryType !== "GROUP") || input.permissionClass !== "METADATA_READ_WRITE_SELECTED_COLLECTIONS" || input.liveApiEnabled !== false) throw new Error("zotero_library_binding_invalid");
  return { schemaId: input.schemaId, libraryKey: text(input.libraryKey, 120, "zotero_library_key_invalid"), libraryType: input.libraryType, libraryVersion: integer(input.libraryVersion, 0, Number.MAX_SAFE_INTEGER, "zotero_library_version_invalid"), scopeHash: exactHash(input.scopeHash, "zotero_library_scope_invalid"), permissionClass: input.permissionClass, liveApiEnabled: false };
}
export function parseZoteroCollectionBinding(value: unknown): ZoteroCollectionBinding {
  const input = record(value, "zotero_collection_binding_invalid");
  if (input.schemaId !== "old-mike-v2-alpha4-r1/zotero-collection-binding/1") throw new Error("zotero_collection_binding_invalid");
  if (input.selected !== true) throw new Error("zotero_collection_selection_required");
  const label = text(input.label, 120, "zotero_collection_label_invalid");
  if (!(ZOTERO_PROJECT_COLLECTIONS as readonly string[]).includes(label)) throw new Error("zotero_collection_label_invalid");
  return { schemaId: input.schemaId, libraryKey: text(input.libraryKey, 120, "zotero_library_key_invalid"), collectionKey: text(input.collectionKey, 120, "zotero_collection_key_invalid"), projectRefHash: exactHash(input.projectRefHash, "zotero_project_ref_invalid"), label, objectVersion: integer(input.objectVersion, 0, Number.MAX_SAFE_INTEGER, "zotero_object_version_invalid"), contentHash: exactHash(input.contentHash, "zotero_collection_hash_invalid"), selected: true };
}
export function parseZoteroItemBinding(value: unknown): ZoteroItemBinding {
  const input = record(value, "zotero_item_binding_invalid");
  if (input.schemaId !== "old-mike-v2-alpha4-r1/zotero-item-binding/1" || (input.availability !== "AVAILABLE" && input.availability !== "UNAVAILABLE_TOMBSTONED") || input.attachmentPolicy !== "METADATA_AND_SELECTED_NOTES_ONLY") throw new Error("zotero_item_binding_invalid");
  const snapshot = record(input.citationSnapshot, "zotero_citation_snapshot_invalid");
  return { schemaId: input.schemaId, libraryKey: text(input.libraryKey, 120, "zotero_library_key_invalid"), collectionKey: text(input.collectionKey, 120, "zotero_collection_key_invalid"), itemKey: text(input.itemKey, 120, "zotero_item_key_invalid"), objectVersion: integer(input.objectVersion, 0, Number.MAX_SAFE_INTEGER, "zotero_object_version_invalid"), normalizedMetadataHash: exactHash(input.normalizedMetadataHash, "zotero_metadata_hash_invalid"), evidenceLedgerRefHash: exactHash(input.evidenceLedgerRefHash, "zotero_evidence_ref_invalid"), availability: input.availability, attachmentPolicy: input.attachmentPolicy, citationSnapshot: { metadata: parseCitationMetadata(snapshot.metadata), snapshotHash: exactHash(snapshot.snapshotHash, "zotero_citation_snapshot_hash_invalid") } };
}
export function parseZoteroSyncReceipt(value: unknown): ZoteroSyncReceipt {
  const input = record(value, "zotero_sync_receipt_invalid");
  const operations = ["IMPORT", "SAVE", "SYNC", "INSERT_CITATION", "EXPORT_BIBLIOGRAPHY"];
  if (input.schemaId !== "old-mike-v2-alpha4-r1/zotero-sync-receipt/1" || !operations.includes(String(input.operation)) || !["COMPLETE", "CONFLICT", "TERMINAL_REJECTED"].includes(String(input.completionClass)) || input.overwritten !== false || input.attachmentsTransferred !== 0 || input.rawBodyRetained !== false || input.notesPolicy !== "BOUNDED_USER_SELECTED_ONLY" || input.liveApiCallCount !== 0) throw new Error("zotero_sync_receipt_invalid");
  return { schemaId: input.schemaId, operation: input.operation as ZoteroSyncReceipt["operation"], completionClass: input.completionClass as ZoteroSyncReceipt["completionClass"], libraryVersionBefore: integer(input.libraryVersionBefore, 0, Number.MAX_SAFE_INTEGER, "zotero_library_version_invalid"), libraryVersionAfter: integer(input.libraryVersionAfter, 0, Number.MAX_SAFE_INTEGER, "zotero_library_version_invalid"), itemsRead: integer(input.itemsRead, 0, 1000, "zotero_receipt_count_invalid"), itemsWritten: integer(input.itemsWritten, 0, 1000, "zotero_receipt_count_invalid"), conflicts: integer(input.conflicts, 0, 1000, "zotero_receipt_count_invalid"), overwritten: false, attachmentsTransferred: 0, rawBodyRetained: false, notesPolicy: input.notesPolicy, liveApiCallCount: 0, receiptHash: exactHash(input.receiptHash, "zotero_receipt_hash_invalid") };
}

const SYNTHETIC_METADATA: CitationMetadata = { title: "Evidence calibration in teacher decisions", year: 2025, firstAuthor: "Lin", authors: ["Lin, Mei"], journal: "Journal of Evidence", doi: "10.1000/fixture.1", pmid: null, arxiv: null, isbn: null };
export function createSyntheticZoteroBindings({ projectRefHash, collectionLabel }: { projectRefHash: string; collectionLabel: string }) {
  const library: ZoteroLibraryBinding = { schemaId: "old-mike-v2-alpha4-r1/zotero-library-binding/1", libraryKey: "synthetic-library-alpha4-r1", libraryType: "USER", libraryVersion: 7, scopeHash: sha256Zotero({ projectRefHash, collectionLabel }), permissionClass: "METADATA_READ_WRITE_SELECTED_COLLECTIONS", liveApiEnabled: false };
  const collection: ZoteroCollectionBinding = { schemaId: "old-mike-v2-alpha4-r1/zotero-collection-binding/1", libraryKey: library.libraryKey, collectionKey: `collection-${ZOTERO_PROJECT_COLLECTIONS.indexOf(collectionLabel as typeof ZOTERO_PROJECT_COLLECTIONS[number])}`, projectRefHash: exactHash(projectRefHash, "zotero_project_ref_invalid"), label: collectionLabel, objectVersion: 3, contentHash: sha256Zotero({ projectRefHash, collectionLabel, version: 3 }), selected: true };
  const metadataHash = sha256Zotero(normalizedMetadata(SYNTHETIC_METADATA));
  const item: ZoteroItemBinding = { schemaId: "old-mike-v2-alpha4-r1/zotero-item-binding/1", libraryKey: library.libraryKey, collectionKey: collection.collectionKey, itemKey: "ITEMALPHA4R1", objectVersion: 11, normalizedMetadataHash: metadataHash, evidenceLedgerRefHash: sha256Zotero({ projectRefHash, metadataHash }), availability: "AVAILABLE", attachmentPolicy: "METADATA_AND_SELECTED_NOTES_ONLY", citationSnapshot: { metadata: SYNTHETIC_METADATA, snapshotHash: sha256Zotero(SYNTHETIC_METADATA) } };
  const receiptCore = { schemaId: "old-mike-v2-alpha4-r1/zotero-sync-receipt/1" as const, operation: "SYNC" as const, completionClass: "COMPLETE" as const, libraryVersionBefore: 7, libraryVersionAfter: 8, itemsRead: 1, itemsWritten: 0, conflicts: 0, overwritten: false as const, attachmentsTransferred: 0 as const, rawBodyRetained: false as const, notesPolicy: "BOUNDED_USER_SELECTED_ONLY" as const, liveApiCallCount: 0 as const };
  const receipt: ZoteroSyncReceipt = { ...receiptCore, receiptHash: sha256Zotero(receiptCore) };
  return { library: parseZoteroLibraryBinding(library), collection: parseZoteroCollectionBinding(collection), item: parseZoteroItemBinding(item), receipt: parseZoteroSyncReceipt(receipt) };
}

export function createSyntheticZoteroReceipt(operation: ZoteroSyncReceipt["operation"], counts: { itemsRead: number; itemsWritten: number; conflicts?: number }) {
  const before = 7;
  const core = { schemaId: "old-mike-v2-alpha4-r1/zotero-sync-receipt/1" as const, operation, completionClass: (counts.conflicts ? "CONFLICT" : "COMPLETE") as ZoteroSyncReceipt["completionClass"], libraryVersionBefore: before, libraryVersionAfter: counts.itemsWritten > 0 ? before + 1 : before, itemsRead: counts.itemsRead, itemsWritten: counts.itemsWritten, conflicts: counts.conflicts ?? 0, overwritten: false as const, attachmentsTransferred: 0 as const, rawBodyRetained: false as const, notesPolicy: "BOUNDED_USER_SELECTED_ONLY" as const, liveApiCallCount: 0 as const };
  return parseZoteroSyncReceipt({ ...core, receiptHash: sha256Zotero(core) });
}

export function applyVersionedZoteroItemUpdate(itemValue: unknown, expectedVersion: number, metadataValue: unknown) {
  const item = parseZoteroItemBinding(itemValue);
  if (expectedVersion !== item.objectVersion) return { status: 412 as const, code: "ZOTERO_VERSION_CONFLICT" as const, overwritten: false as const, item };
  const metadata = parseCitationMetadata(metadataValue);
  const normalizedMetadataHash = sha256Zotero(normalizedMetadata(metadata));
  return { status: 200 as const, code: "UPDATED" as const, overwritten: false as const, item: parseZoteroItemBinding({ ...item, objectVersion: item.objectVersion + 1, normalizedMetadataHash, citationSnapshot: { metadata, snapshotHash: sha256Zotero(metadata) } }) };
}
export function bindDeletedZoteroItem(itemValue: unknown) {
  const item = parseZoteroItemBinding(itemValue);
  return parseZoteroItemBinding({ ...item, availability: "UNAVAILABLE_TOMBSTONED" });
}

export function encodeCslJson(items: unknown[]) {
  return JSON.stringify(items.map(parseCitationMetadata).map((item, index) => ({ id: `old-mike-${index + 1}`, type: "article-journal", title: item.title, issued: { "date-parts": [[item.year]] }, author: item.authors.map((author) => { const [family, given = ""] = author.split(",").map((part) => part.trim()); return { family, given }; }), "container-title": item.journal, DOI: item.doi, PMID: item.pmid, arXiv: item.arxiv, ISBN: item.isbn })), null, 2);
}
export function encodeRis(items: unknown[]) {
  return items.map(parseCitationMetadata).map((item) => ["TY  - JOUR", `TI  - ${item.title}`, ...item.authors.map((author) => `AU  - ${author}`), `PY  - ${item.year}`, `JO  - ${item.journal}`, ...(item.doi ? [`DO  - ${item.doi}`] : []), ...(item.pmid ? [`AN  - PMID:${item.pmid}`] : []), ...(item.arxiv ? [`AN  - arXiv:${item.arxiv}`] : []), ...(item.isbn ? [`SN  - ${item.isbn}`] : []), "ER  -"].join("\n")).join("\n\n");
}
function escapeBib(value: string) { return value.replace(/[{}]/gu, ""); }
export function encodeBibTeX(items: unknown[]) {
  return items.map(parseCitationMetadata).map((item, index) => `@article{OldMike${item.year}_${index + 1},\n  author = {${item.authors.map(escapeBib).join(" and ")}},\n  title = {${escapeBib(item.title)}},\n  journal = {${escapeBib(item.journal)}},\n  year = {${item.year}},${item.doi ? `\n  doi = {${item.doi}},` : ""}\n}`).join("\n\n");
}
function cslToMetadata(value: unknown) {
  const item = record(value, "csl_item_invalid");
  const dateParts = record(item.issued, "csl_issued_invalid")["date-parts"];
  const year = Array.isArray(dateParts) && Array.isArray(dateParts[0]) ? dateParts[0][0] : null;
  const authors = Array.isArray(item.author) ? item.author.map((entry) => { const author = record(entry, "csl_author_invalid"); return `${text(author.family, 160, "csl_author_invalid")}, ${text(author.given ?? "Unknown", 160, "csl_author_invalid")}`; }) : [];
  return parseCitationMetadata({ title: item.title, year, authors, firstAuthor: authors[0]?.split(",")[0], journal: item["container-title"], doi: item.DOI, pmid: item.PMID, arxiv: item.arXiv, isbn: item.ISBN });
}
function risToMetadata(block: string) {
  const fields = new Map<string, string[]>();
  for (const line of block.split(/\r?\n/gu)) { const match = /^([A-Z0-9]{2})  -\s?(.*)$/u.exec(line); if (match) fields.set(match[1], [...(fields.get(match[1]) ?? []), match[2].trim()]); }
  const authors = fields.get("AU") ?? [];
  const accession = fields.get("AN") ?? [];
  return parseCitationMetadata({ title: fields.get("TI")?.[0], year: Number(fields.get("PY")?.[0]), authors, firstAuthor: authors[0]?.split(",")[0], journal: fields.get("JO")?.[0], doi: fields.get("DO")?.[0], pmid: accession.find((value) => value.startsWith("PMID:"))?.slice(5), arxiv: accession.find((value) => value.startsWith("arXiv:"))?.slice(6), isbn: fields.get("SN")?.[0] });
}
function bibToMetadata(block: string) {
  const field = (name: string) => new RegExp(`${name}\\s*=\\s*\\{([^}]*)\\}`, "iu").exec(block)?.[1];
  const authors = field("author")?.split(/\s+and\s+/iu).map((item) => item.trim()) ?? [];
  return parseCitationMetadata({ title: field("title"), year: Number(field("year")), authors, firstAuthor: authors[0]?.split(",")[0], journal: field("journal"), doi: field("doi"), pmid: null, arxiv: null, isbn: null });
}
export function parseOfflineCitationInterchange(format: CitationInterchangeFormat | string, input: unknown) {
  const source = text(input, 200_000, "citation_interchange_invalid");
  const items: CitationMetadata[] = [];
  const issues: Array<{ index: number; code: "MALFORMED_ENTRY" }> = [];
  let rawItems: unknown[];
  if (format === "CSL_JSON") { const parsed = JSON.parse(source); if (!Array.isArray(parsed)) throw new Error("citation_interchange_invalid"); rawItems = parsed; }
  else if (format === "RIS") rawItems = source.split(/(?<=^ER  -\s*$)/gmu).map((item) => item.trim()).filter(Boolean);
  else if (format === "BIBTEX") rawItems = source.split(/(?=@[A-Za-z]+\{)/gu).map((item) => item.trim()).filter(Boolean);
  else throw new Error("citation_interchange_format_invalid");
  rawItems.forEach((raw, index) => { try { items.push(format === "CSL_JSON" ? cslToMetadata(raw) : format === "RIS" ? risToMetadata(String(raw)) : bibToMetadata(String(raw))); } catch { issues.push({ index, code: "MALFORMED_ENTRY" }); } });
  if (items.length === 0) throw new Error("citation_interchange_zero_valid_items");
  return { format: format as CitationInterchangeFormat, items, issues };
}

export function createCitationStyleSnapshot(inputValue: unknown): CitationStyleSnapshot {
  const input = record(inputValue, "citation_style_invalid");
  const core = { schemaId: "old-mike-v2-alpha4-r1/citation-style-snapshot/1" as const, targetJournalId: text(input.targetJournalId, 120, "citation_style_journal_invalid"), styleId: text(input.styleId, 120, "citation_style_id_invalid"), styleTitle: text(input.styleTitle, 300, "citation_style_title_invalid"), styleVersion: text(input.styleVersion, 80, "citation_style_version_invalid"), locale: "zh-TW" as const };
  return { ...core, snapshotHash: sha256Zotero(core) };
}
export function renderTargetJournalBibliography(items: unknown[], styleValue: unknown) {
  const styleInput = record(styleValue, "citation_style_invalid");
  const style = createCitationStyleSnapshot(styleInput);
  if (styleInput.snapshotHash !== style.snapshotHash) throw new Error("citation_style_snapshot_hash_invalid");
  const normalized = items.map(parseCitationMetadata).sort((a, b) => a.firstAuthor.localeCompare(b.firstAuthor, "en-US") || a.year - b.year || a.title.localeCompare(b.title, "en-US"));
  const lines = normalized.map((item) => `${item.authors.join(", ")} (${item.year}). ${item.title}. ${item.journal}.${item.doi ? ` https://doi.org/${item.doi}` : ""}`);
  const textOutput = lines.join("\n");
  return { text: textOutput, bibliographyHash: sha256Zotero({ styleSnapshotHash: style.snapshotHash, lines }), styleSnapshotHash: style.snapshotHash, itemCount: normalized.length };
}
