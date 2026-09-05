/**
 * Research Profile Version Contract (Spec v3.2.0 / V3-U03-R1 — A3)
 *
 * Six editable axes as NEW-RUN profile default (aligns with canonicalDomains):
 *   1. AI與數位科技跨領域應用
 *   2. AI教育應用
 *   3. AI應用於職業安全與教育訓練
 *   4. AI應用於環境工程與環境資源管理
 *   5. AI應用於能源管理
 *   6. VR/AR/XR跨領域應用於職業安全教育訓練與教育
 *
 * Rules enforced:
 * - Profile changes only apply to NEW runs; existing locked projects must first
 *   show a profile diff and get user consent — never silently re-topic a locked question.
 * - "能源管理" is not a display label: it flows into query, source selection and
 *   candidate coverage checks via keyword expansion with hypothesis + version.
 * - Resources are not inferred from expertise: missing resources stay UNKNOWN,
 *   options offered, never fabricated.
 * - Aliases/normalization preserve the original text (source + alias).
 */
export const RESEARCH_PROFILE_CONTRACT = "research-profile/1.0.0" as const;

export const PROFILE_AXIS_KEYS = [
  "ai_cross_domain",
  "ai_education",
  "ai_occupational_safety_training",
  "ai_environmental_engineering",
  "ai_energy_management",
  "xr_occupational_safety_training_education",
] as const;
export type ProfileAxisKey = (typeof PROFILE_AXIS_KEYS)[number];

export const PROFILE_AXIS_LABELS: Readonly<Record<ProfileAxisKey, string>> = Object.freeze({
  ai_cross_domain: "AI與數位科技跨領域應用",
  ai_education: "AI教育應用",
  ai_occupational_safety_training: "AI應用於職業安全與教育訓練",
  ai_environmental_engineering: "AI應用於環境工程與環境資源管理",
  ai_energy_management: "AI應用於能源管理",
  xr_occupational_safety_training_education: "VR/AR/XR跨領域應用於職業安全教育訓練與教育",
});

export type ProfileResourceStatus = "USER_PROVIDED" | "UNKNOWN" | "PROPOSED";

export type ProfileAxis = {
  axisKey: ProfileAxisKey;
  label: string;
  enabled: boolean;
  keywords: string[];                 // query keywords for this axis
  keywordVersion: string;             // hypothesis/version for the keyword expansion
  methodExperience: string[];         // method experience claimed
  resources: Record<string, ProfileResourceStatus>; // resources: UNKNOWN unless user-provided
  expansionDirections: string[];
  excludedScope: string[];
  aliases: string[];                  // normalized synonyms, original text preserved separately
};

export type ResearchProfileVersion = {
  profileVersionId: string;
  versionNumber: number;
  contractVersion: typeof RESEARCH_PROFILE_CONTRACT;
  axes: ProfileAxis[];
  createdAt: string;
  appliesTo: "NEW_RUNS_ONLY" | "CURRENT_PROJECT_AFTER_CONSENT";
  source: "USER_EDIT" | "SYSTEM_DEFAULT";
};

export type ProfileDiff = {
  addedAxes: ProfileAxisKey[];
  removedAxes: ProfileAxisKey[];
  keywordChanges: Array<{ axisKey: ProfileAxisKey; added: string[]; removed: string[] }>;
  versionFrom: number;
  versionTo: number;
};

export function buildDefaultProfileAxes(): ProfileAxis[] {
  return PROFILE_AXIS_KEYS.map((axisKey) => ({
    axisKey,
    label: PROFILE_AXIS_LABELS[axisKey],
    enabled: true,
    keywords: axisKey === "ai_energy_management" ? ["能源管理", "energy management", "節能", "淨零", "能源效率", "demand forecasting"] : [PROFILE_AXIS_LABELS[axisKey]],
    keywordVersion: "v1",
    methodExperience: [],
    resources: {},
    expansionDirections: [],
    excludedScope: [],
    aliases: [],
  }));
}

/** Compute profile diff between two versions (for locked-project consent gate). */
export function diffProfiles(before: ResearchProfileVersion, after: ResearchProfileVersion): ProfileDiff {
  const beforeMap = new Map(before.axes.map((a) => [a.axisKey, a]));
  const afterMap = new Map(after.axes.map((a) => [a.axisKey, a]));
  const addedAxes: ProfileAxisKey[] = [];
  const removedAxes: ProfileAxisKey[] = [];
  const keywordChanges: ProfileDiff["keywordChanges"] = [];

  for (const [key, axis] of afterMap) {
    if (!beforeMap.has(key)) addedAxes.push(key as ProfileAxisKey);
  }
  for (const [key] of beforeMap) {
    if (!afterMap.has(key)) removedAxes.push(key as ProfileAxisKey);
  }
  for (const [key, afterAxis] of afterMap) {
    const beforeAxis = beforeMap.get(key);
    if (!beforeAxis) continue;
    const beforeKeywords = new Set(beforeAxis.keywords);
    const afterKeywords = new Set(afterAxis.keywords);
    const added = afterAxis.keywords.filter((k) => !beforeKeywords.has(k));
    const removed = beforeAxis.keywords.filter((k) => !afterKeywords.has(k));
    if (added.length || removed.length) {
      keywordChanges.push({ axisKey: key as ProfileAxisKey, added, removed });
    }
  }
  return { addedAxes, removedAxes, keywordChanges, versionFrom: before.versionNumber, versionTo: after.versionNumber };
}

export function profileHasChanges(diff: ProfileDiff): boolean {
  return diff.addedAxes.length > 0 || diff.removedAxes.length > 0 || diff.keywordChanges.length > 0;
}

/** Energy axis keyword expansion feeds query + source selection + coverage checks. */
export function energyAxisQueryKeywords(profile: ResearchProfileVersion, ...extra: string[]): string[] {
  const energy = profile.axes.find((a) => a.axisKey === "ai_energy_management");
  if (!energy) return extra;
  return Array.from(new Set([...energy.keywords, ...extra]));
}