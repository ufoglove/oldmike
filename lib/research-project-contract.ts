import "server-only";

export const RESEARCH_PROJECT_TYPES = ["NSTC", "MOE_TEACHING_PRACTICE", "JOURNAL_MANUSCRIPT", "GENERAL"] as const;
export type ResearchProjectType = (typeof RESEARCH_PROJECT_TYPES)[number];

export const RESEARCH_PROJECT_STAGES = ["BLUEPRINT", "LITERATURE", "DESIGN", "ETHICS", "DATA", "STATISTICS", "MANUSCRIPT", "SUBMISSION"] as const;
export type ResearchProjectStage = (typeof RESEARCH_PROJECT_STAGES)[number];

export const RESEARCH_PROJECT_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type ResearchProjectStatus = (typeof RESEARCH_PROJECT_STATUSES)[number];

export const LITERATURE_ROLES = ["CORE", "GAP", "THEORY", "METHOD", "MEASUREMENT", "SIMILAR_STUDY", "SUPPORTING", "DISCUSSION", "BACKGROUND"] as const;
export type LiteratureRole = (typeof LITERATURE_ROLES)[number];

export const LITERATURE_READING_STATUSES = ["DISCOVERED", "ABSTRACT_REVIEWED", "FULLTEXT_AVAILABLE", "FULLTEXT_REVIEWED", "KEY_PAPER", "EXCLUDED"] as const;
export type LiteratureReadingStatus = (typeof LITERATURE_READING_STATUSES)[number];

export const LITERATURE_EVIDENCE_STATUSES = ["VERIFIED", "SUPPORTED", "INFERRED", "UNVERIFIED"] as const;
export type LiteratureEvidenceStatus = (typeof LITERATURE_EVIDENCE_STATUSES)[number];

export const LITERATURE_SOURCES = ["WEB_SEARCH", "ZOTERO_IMPORT", "MANUAL", "NAVIGATOR_IMPORT"] as const;
export type LiteratureSource = (typeof LITERATURE_SOURCES)[number];

export const LITERATURE_RQ_RELATIONSHIPS = ["SUPPORTS", "THEORY", "METHOD", "MEASUREMENT", "COMPARES", "BACKGROUND", "GAP", "DISCUSSION"] as const;
export type LiteratureRqRelationship = (typeof LITERATURE_RQ_RELATIONSHIPS)[number];

export const USEFUL_FOR_SECTIONS = ["Introduction", "Theory", "Methods", "Results", "Discussion"] as const;

export const ZOTERO_SYNC_STATUSES = ["NOT_LINKED", "CONNECTED", "SYNCING", "SYNCED", "SYNC_CONFLICT", "SYNC_ERROR"] as const;
export type ZoteroSyncStatus = (typeof ZOTERO_SYNC_STATUSES)[number];

export const CITATION_STATUSES = ["PLANNED", "CITED", "VERIFIED"] as const;
export type CitationStatus = (typeof CITATION_STATUSES)[number];

export const NEXT_STAGE_LABELS: Record<string, string> = {
  BLUEPRINT: "研究藍圖",
  LITERATURE: "文獻與證據",
  DESIGN: "研究設計",
  ETHICS: "研究倫理",
  DATA: "資料",
  STATISTICS: "統計",
  MANUSCRIPT: "全文",
  SUBMISSION: "送件",
};

export type ResearchProjectIntakeOverride = {
  titleZh?: string;
  population?: string;
  context?: string;
  methodology?: string;
  expectedContribution?: string;
};

export type ResearchProjectCreateInput = {
  inheritLatestRun?: boolean;
  navigatorRunId?: string;
  projectName?: string;
  projectType?: ResearchProjectType;
  intakeOverride?: ResearchProjectIntakeOverride;
  topicProfile?: {
    titleZh?: string;
    titleEn?: string;
    abstract?: string;
    researchGap?: string;
    researchQuestions?: string[];
    theory?: string[];
    intervention?: string[];
    population?: string;
    context?: string;
    method?: string;
    expectedOutcomes?: string[];
    noveltyAnalysis?: string;
  };
};

export type LiteratureItemInput = {
  title: string;
  authors?: { given?: string; family?: string }[];
  year?: number | null;
  journal?: string | null;
  doi?: string | null;
  abstract?: string | null;
  itemType?: string | null;
  url?: string | null;
  tags?: string[];
  citationCount?: number | null;
  zoteroItemKey?: string | null;
  zoteroCollectionKey?: string | null;
  zoteroLibraryType?: "user" | "group" | null;
  zoteroLibraryId?: string | null;
  source: LiteratureSource;
};

export type LiteratureLinkInput = {
  role?: LiteratureRole[];
  priority?: number | null;
  readingStatus?: LiteratureReadingStatus;
  evidenceStatus?: LiteratureEvidenceStatus;
  relevanceScore?: number | null;
  notes?: string | null;
};

export type AnalysisCardInput = {
  researchProblem?: string | null;
  theory?: string | null;
  population?: string | null;
  method?: string | null;
  variables?: string | null;
  mainFindings?: string | null;
  limitations?: string | null;
  futureResearch?: string | null;
  researchGap?: string | null;
  supportsMyProject?: string | null;
  differsFromMyProject?: string | null;
  usefulForSections?: string[];
  userNotes?: string | null;
};

export type RqLinkInput = {
  rqKey: string;
  relationship: LiteratureRqRelationship;
};

export type CitationSourceInput = {
  literatureId: string;
  zoteroItemKey?: string | null;
  citationKey?: string | null;
  doi?: string | null;
  usedInSections?: string[];
  supportingClaims?: string[];
};

export type ZoteroConnectionInput = {
  libraryType: "user" | "group";
  libraryId: string;
  collectionKey?: string | null;
  collectionName?: string | null;
  authMethod: "API_KEY" | "OAUTH";
  apiKey?: string | null;
};

function isIn<T extends readonly string[]>(allowed: readonly T[number][], value: unknown): value is T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

export function normalizeAuthors(value: unknown): { given?: string; family?: string }[] {
  if (!Array.isArray(value)) return [];
  const result: { given?: string; family?: string }[] = [];
  for (const entry of value) {
    if (typeof entry === "string") { result.push({ family: entry }); continue; }
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const row = entry as Record<string, unknown>;
      const family = typeof row.family === "string" ? row.family : typeof row.lastName === "string" ? row.lastName : "";
      const given = typeof row.given === "string" ? row.given : typeof row.firstName === "string" ? row.firstName : "";
      if (family || given) result.push({ family: family || undefined, given: given || undefined });
    }
  }
  return result.slice(0, 200);
}

export function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0 && entry.length <= 300).slice(0, 100);
}

export function normalizeTitle(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/gu, " ").slice(0, 2000) : "";
}

export function normalizeDoi(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if (!cleaned) return null;
  return cleaned.replace(/^https?:\/\/doi\.org\//iu, "").toLowerCase().slice(0, 300);
}

export function normalizedTitleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

export function validateResearchProjectCreate(value: unknown): ResearchProjectCreateInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_research_project_request");
  const row = value as Record<string, unknown>;
  const navigatorRunId = typeof row.navigatorRunId === "string" && row.navigatorRunId.trim() ? (row.navigatorRunId.trim().length <= 80 ? row.navigatorRunId.trim() : "") : "";
  if (navigatorRunId && !/^[A-Za-z0-9_-]{8,80}$/.test(navigatorRunId)) throw new Error("invalid_navigator_run_id");
  const projectName = typeof row.projectName === "string" ? row.projectName.trim().slice(0, 300) : "";
  const projectType = (isIn(RESEARCH_PROJECT_TYPES, row.projectType) ? row.projectType : "GENERAL") as ResearchProjectType;
  const intakeRow = row.intakeOverride;
  const intake = intakeRow && typeof intakeRow === "object" && !Array.isArray(intakeRow) ? intakeRow as Record<string, unknown> : null;
  const textOf = (key: string) => (intake && typeof intake[key] === "string" ? (intake[key] as string).trim().slice(0, 30000) : undefined);
  const intakeOverride: ResearchProjectIntakeOverride | undefined = intake
    ? { titleZh: textOf("titleZh") || undefined, population: textOf("population") || undefined, context: textOf("context") || undefined, methodology: textOf("methodology") || undefined, expectedContribution: textOf("expectedContribution") || undefined }
    : undefined;
  const tp = row.topicProfile;
  const topicProfile = tp && typeof tp === "object" && !Array.isArray(tp)
    ? (() => { const t = tp as Record<string, unknown>; const strList = (k: string) => Array.isArray(t[k]) ? (t[k] as unknown[]).map((x) => typeof x === "string" ? x.trim().slice(0, 3000) : "").filter(Boolean) : []; const s = (k: string) => typeof t[k] === "string" ? (t[k] as string).trim().slice(0, 30000) : undefined; return { titleZh: s("titleZh"), titleEn: s("titleEn"), abstract: s("abstract"), researchGap: s("researchGap"), researchQuestions: strList("researchQuestions"), theory: strList("theory"), intervention: strList("intervention"), population: s("population"), context: s("context"), method: s("method"), expectedOutcomes: strList("expectedOutcomes"), noveltyAnalysis: s("noveltyAnalysis") }; })()
    : undefined;
  return { navigatorRunId: navigatorRunId || undefined, projectName: projectName || undefined, projectType, intakeOverride, topicProfile };
}

export function validateLiteratureItem(value: unknown): LiteratureItemInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_literature_item");
  const row = value as Record<string, unknown>;
  const title = normalizeTitle(row.title);
  if (!title) throw new Error("literature_title_required");
  const source = (isIn(LITERATURE_SOURCES, row.source) ? row.source : "MANUAL") as LiteratureSource;
  const doi = normalizeDoi(row.doi);
  const year = typeof row.year === "number" && Number.isInteger(row.year) && row.year >= 1500 && row.year <= 2100 ? row.year : null;
  return {
    title,
    authors: normalizeAuthors(row.authors),
    year,
    journal: typeof row.journal === "string" && row.journal.trim() ? row.journal.trim().slice(0, 500) : null,
    doi,
    abstract: typeof row.abstract === "string" && row.abstract.trim() ? row.abstract.trim().slice(0, 30000) : null,
    itemType: typeof row.itemType === "string" && row.itemType.trim() ? row.itemType.trim().slice(0, 100) : null,
    url: typeof row.url === "string" && row.url.trim() ? row.url.trim().slice(0, 2000) : null,
    tags: normalizeTags(row.tags),
    citationCount: typeof row.citationCount === "number" && Number.isFinite(row.citationCount) && row.citationCount >= 0 ? Math.floor(row.citationCount) : null,
    zoteroItemKey: typeof row.zoteroItemKey === "string" && row.zoteroItemKey.trim() ? row.zoteroItemKey.trim().slice(0, 100) : null,
    zoteroCollectionKey: typeof row.zoteroCollectionKey === "string" && row.zoteroCollectionKey.trim() ? row.zoteroCollectionKey.trim().slice(0, 100) : null,
    zoteroLibraryType: row.zoteroLibraryType === "user" || row.zoteroLibraryType === "group" ? row.zoteroLibraryType : null,
    zoteroLibraryId: typeof row.zoteroLibraryId === "string" && row.zoteroLibraryId.trim() ? row.zoteroLibraryId.trim().slice(0, 100) : null,
    source,
  };
}

export function validateLiteratureLink(value: unknown): LiteratureLinkInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const row = value as Record<string, unknown>;
  const role = Array.isArray(row.role)
    ? (row.role as unknown[]).filter((entry): entry is LiteratureRole => isIn(LITERATURE_ROLES, entry)).slice(0, 9)
    : [];
  const priority = typeof row.priority === "number" && Number.isInteger(row.priority) && row.priority >= 1 && row.priority <= 5 ? row.priority : null;
  const readingStatus = (isIn(LITERATURE_READING_STATUSES, row.readingStatus) ? row.readingStatus : undefined) as LiteratureReadingStatus | undefined;
  const evidenceStatus = (isIn(LITERATURE_EVIDENCE_STATUSES, row.evidenceStatus) ? row.evidenceStatus : undefined) as LiteratureEvidenceStatus | undefined;
  const relevanceScore = typeof row.relevanceScore === "number" && Number.isFinite(row.relevanceScore) ? Math.max(0, Math.min(100, Math.round(row.relevanceScore))) : null;
  const notes = typeof row.notes === "string" ? row.notes.trim().slice(0, 10000) : null;
  return { role, priority, readingStatus, evidenceStatus, relevanceScore, notes };
}

export function validateAnalysisCard(value: unknown): AnalysisCardInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const row = value as Record<string, unknown>;
  const text = (key: string) => (typeof row[key] === "string" ? (row[key] as string).trim().slice(0, 30000) : null);
  return {
    researchProblem: text("researchProblem"),
    theory: text("theory"),
    population: text("population"),
    method: text("method"),
    variables: text("variables"),
    mainFindings: text("mainFindings"),
    limitations: text("limitations"),
    futureResearch: text("futureResearch"),
    researchGap: text("researchGap"),
    supportsMyProject: text("supportsMyProject"),
    differsFromMyProject: text("differsFromMyProject"),
    usefulForSections: Array.isArray(row.usefulForSections) ? (row.usefulForSections as unknown[]).filter((entry): entry is string => typeof entry === "string" && (USEFUL_FOR_SECTIONS as readonly string[]).includes(entry)).slice(0, 5) : [],
    userNotes: text("userNotes"),
  };
}

export function validateRqLinks(value: unknown): RqLinkInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const row = entry as Record<string, unknown>;
      const rqKey = typeof row.rqKey === "string" ? row.rqKey.trim().toUpperCase().slice(0, 20) : "";
      const relationship = isIn(LITERATURE_RQ_RELATIONSHIPS, row.relationship) ? row.relationship : "";
      if (!rqKey || !relationship) return null;
      return { rqKey, relationship };
    })
    .filter((entry): entry is RqLinkInput => entry !== null)
    .slice(0, 50);
}

export function validateCitationSource(value: unknown): CitationSourceInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_citation_source");
  const row = value as Record<string, unknown>;
  const literatureId = typeof row.literatureId === "string" && row.literatureId.trim() ? row.literatureId.trim().slice(0, 100) : "";
  if (!literatureId) throw new Error("literature_id_required");
  return {
    literatureId,
    zoteroItemKey: typeof row.zoteroItemKey === "string" && row.zoteroItemKey.trim() ? row.zoteroItemKey.trim().slice(0, 100) : null,
    citationKey: typeof row.citationKey === "string" && row.citationKey.trim() ? row.citationKey.trim().slice(0, 200) : null,
    doi: normalizeDoi(row.doi),
    usedInSections: Array.isArray(row.usedInSections) ? (row.usedInSections as unknown[]).filter((entry): entry is string => typeof entry === "string").slice(0, 20) : [],
    supportingClaims: Array.isArray(row.supportingClaims) ? (row.supportingClaims as unknown[]).filter((entry): entry is string => typeof entry === "string").slice(0, 50) : [],
  };
}
