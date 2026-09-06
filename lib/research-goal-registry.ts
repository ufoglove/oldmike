/**
 * Research Goal Registry & Context Contract
 * Spec: v3.3.0 (V3-U03-R2) Section 2, 3, 4
 *
 * Single Source of Truth for the Three Formal Research Goals:
 * 1. JOURNAL_SCI_SSCI: SCI／SSCI 國際期刊論文
 * 2. NSTC_GENERAL: 國科會一般研究計畫
 * 3. MOE_TPR: 教育部教學實踐研究計畫
 *
 * Auxiliary Actions (NOT formal goals per spec §2):
 * - "老麥建議目標／比較三方向" is an assistance action, not a goal type.
 * - "快速", "三年", "高新穎" are horizons or strategies, not formal goal categories.
 */

export const RESEARCH_GOAL_REGISTRY_CONTRACT = "research-goal-registry/1.0.0" as const;

export const PRIMARY_GOAL_IDS = [
  "JOURNAL_SCI_SSCI",
  "NSTC_GENERAL",
  "MOE_TPR",
] as const;

export type PrimaryGoalId = (typeof PRIMARY_GOAL_IDS)[number];

export type JournalIndexPreference = "SCIE" | "SSCI" | "SCIE_OR_SSCI" | "UNSPECIFIED";

export type ResearchGoalDefinition = {
  goalId: PrimaryGoalId;
  labelZh: string;
  shortLabel: string;
  coreOutput: string;
  defaultFundingIntent: "NONE" | "NSTC_GENERAL" | "MOE_TPR" | "UNDECIDED";
  defaultPublicationIntent: "JOURNAL" | "DEFERRED" | "NONE";
  requiresCourseProfile: boolean;
  requiresDisciplineSelection: boolean;
  badgeTone: "teal" | "amber" | "violet";
};

export const RESEARCH_GOAL_DEFINITIONS: Readonly<Record<PrimaryGoalId, ResearchGoalDefinition>> = Object.freeze({
  JOURNAL_SCI_SSCI: {
    goalId: "JOURNAL_SCI_SSCI",
    labelZh: "SCI／SSCI 國際期刊論文",
    shortLabel: "SCI/SSCI 期刊",
    coreOutput: "期刊研究規劃、實證或適用文章類型稿件、投稿包",
    defaultFundingIntent: "NONE",
    defaultPublicationIntent: "JOURNAL",
    requiresCourseProfile: false,
    requiresDisciplineSelection: false,
    badgeTone: "teal",
  },
  NSTC_GENERAL: {
    goalId: "NSTC_GENERAL",
    labelZh: "國科會一般研究計畫",
    shortLabel: "國科會一般計畫",
    coreOutput: "一般研究計畫學門規劃、計畫書、經費及申請附件",
    defaultFundingIntent: "NSTC_GENERAL",
    defaultPublicationIntent: "DEFERRED",
    requiresCourseProfile: false,
    requiresDisciplineSelection: true,
    badgeTone: "amber",
  },
  MOE_TPR: {
    goalId: "MOE_TPR",
    labelZh: "教育部教學實踐研究計畫",
    shortLabel: "教育部教學實踐",
    coreOutput: "課程問題、教學介入與評量、計畫書、授課及申請附件",
    defaultFundingIntent: "MOE_TPR",
    defaultPublicationIntent: "DEFERRED",
    requiresCourseProfile: true,
    requiresDisciplineSelection: true,
    badgeTone: "violet",
  },
});

export type GoalContext = {
  primaryGoal: PrimaryGoalId;
  fundingIntent: "NONE" | "UNDECIDED" | "NSTC_GENERAL" | "MOE_TPR";
  publicationIntent: "JOURNAL" | "DEFERRED" | "NONE";
  journalIndexPreference: JournalIndexPreference;
  targetYear?: number | null;
  source: "USER_SELECTED" | "USER_PROFILE" | "AUTHORIZED_POLICY";
  revision: number;
  rawLegacyValue?: string;
};

export type TargetOutput =
  | "IDEA_SET"
  | "ROUTE_PLAN"
  | "RESEARCH_PLAN"
  | "PROPOSAL_DRAFT"
  | "PROPOSAL_APPLICATION_PACKAGE"
  | "MANUSCRIPT_SCIENTIFIC_DRAFT"
  | "JOURNAL_SUBMISSION_PACKAGE";

export type WorkOrderContext = {
  targetOutput: TargetOutput;
  inputState: "IDEA_ONLY" | "PLANNED_STUDY" | "EXISTING_DATA" | "VALIDATED_RESULTS" | "EXISTING_MANUSCRIPT";
  boundedAutoAdoptTopic: boolean;
  boundedAutoAdoptRoute: boolean;
};

export function getResearchGoalDefinition(goalId: PrimaryGoalId): ResearchGoalDefinition {
  return RESEARCH_GOAL_DEFINITIONS[goalId];
}

export function getAllResearchGoalDefinitions(): ResearchGoalDefinition[] {
  return PRIMARY_GOAL_IDS.map((id) => RESEARCH_GOAL_DEFINITIONS[id]);
}

/**
 * Migration helper from legacy strings (preserving raw legacy value per spec §3).
 */
export function migrateLegacyGoal(legacyValue: unknown): GoalContext {
  const raw = typeof legacyValue === "string" ? legacyValue.trim() : "";
  let primaryGoal: PrimaryGoalId = "JOURNAL_SCI_SSCI";
  let fundingIntent: GoalContext["fundingIntent"] = "NONE";
  let publicationIntent: GoalContext["publicationIntent"] = "JOURNAL";
  let journalIndexPreference: JournalIndexPreference = "UNSPECIFIED";

  if (raw === "NSTC" || raw === "科技部計畫" || raw === "國科會計畫" || raw === "NSTC_GENERAL") {
    primaryGoal = "NSTC_GENERAL";
    fundingIntent = "NSTC_GENERAL";
    publicationIntent = "DEFERRED";
  } else if (raw === "MOE" || raw === "教育部計畫" || raw === "MOE_TPR" || raw === "教學實踐") {
    primaryGoal = "MOE_TPR";
    fundingIntent = "MOE_TPR";
    publicationIntent = "DEFERRED";
  } else if (raw === "SCI") {
    primaryGoal = "JOURNAL_SCI_SSCI";
    journalIndexPreference = "SCIE";
  } else if (raw === "SSCI") {
    primaryGoal = "JOURNAL_SCI_SSCI";
    journalIndexPreference = "SSCI";
  } else if (raw === "JOURNAL_SCI_SSCI" || raw === "JOURNAL" || raw === "快速期刊") {
    primaryGoal = "JOURNAL_SCI_SSCI";
  }

  return {
    primaryGoal,
    fundingIntent,
    publicationIntent,
    journalIndexPreference,
    source: "USER_SELECTED",
    revision: 1,
    rawLegacyValue: raw || undefined,
  };
}
