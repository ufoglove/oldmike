import type { ProposalDraft } from "../proposal-studio-contract.ts";
import type { V2Alpha3DomainSelection } from "../v2-alpha3/contracts.ts";

export const V2_ALPHA5_CONTRACT_VERSION = "old-mike-v2-alpha5/1.0.0" as const;
export const V2_ALPHA5_TARGET_CATALOG_VERSION = "old-mike-taiwan-proposal-targets/2026-08-25" as const;
export const V2_ALPHA5_PROPOSAL_SCHEMA_ID = "old-mike://contracts/proposal-studio/1.0.0" as const;
export const V2_ALPHA5_DIRECTION_LIMIT = 500 as const;

export const V2_ALPHA5_TARGETS = Object.freeze([
  { id: "NSTC", label: "國科會專題研究計畫（原科技部）", proposalMode: "NSTC_RESEARCH" },
  { id: "MOE", label: "教育部教學實踐研究計畫", proposalMode: "MOE_TEACHING_PRACTICE" },
] as const);

export const V2_ALPHA5_DIRECTION_LANES = Object.freeze([
  "DISCIPLINE_CORE_HIGH_FEASIBILITY",
  "CROSS_DOMAIN_BALANCED_RECOMMENDED",
  "EMERGING_FORWARD_HIGH_INNOVATION",
] as const);

export type V2Alpha5TargetId = (typeof V2_ALPHA5_TARGETS)[number]["id"];
export type V2Alpha5DirectionLane = (typeof V2_ALPHA5_DIRECTION_LANES)[number];
export type V2Alpha5Freshness = "CURRENT" | "STALE" | "MISSING" | "MIXED_CYCLE";
export type V2Alpha5FactStatus = "KNOWN_FROM_SYNTHETIC_SNAPSHOT" | "UNKNOWN";

export type V2Alpha5TargetSelection = {
  targetId: V2Alpha5TargetId;
  label: string;
  proposalMode: "NSTC_RESEARCH" | "MOE_TEACHING_PRACTICE";
  catalogVersion: typeof V2_ALPHA5_TARGET_CATALOG_VERSION;
  selectionHash: string;
};

export type V2Alpha5OfficialSourceKind =
  | "ANNOUNCEMENT"
  | "RULES"
  | "FORMS"
  | "ATTACHMENTS"
  | "BUDGET"
  | "REVIEW_CRITERIA"
  | "TIMELINE";

export type V2Alpha5OfficialSourceRecord = {
  kind: V2Alpha5OfficialSourceKind;
  sourceHash: string;
  cycleYear: number;
  freshness: Exclude<V2Alpha5Freshness, "MIXED_CYCLE">;
  retrievedAt: string | null;
  effectiveAt: string | null;
  facts: Record<string, string | number | boolean | null>;
};

export type V2Alpha5OfficialSourceBundle = {
  contractVersion: typeof V2_ALPHA5_CONTRACT_VERSION;
  targetId: V2Alpha5TargetId;
  cycleYear: number;
  disciplineHash: string;
  applicationState: "LOCAL_SYNTHETIC_UNVERIFIED";
  sources: V2Alpha5OfficialSourceRecord[];
  officialDeadline: { status: V2Alpha5FactStatus; value: string | null; sourceHash: string | null };
  institutionalDeadline: { status: V2Alpha5FactStatus; value: string | null; sourceHash: string | null };
  freshness: V2Alpha5Freshness;
  bundleHash: string;
};

export type V2Alpha5Direction = {
  directionId: string;
  lane: V2Alpha5DirectionLane;
  workingTitle: string;
  researchQuestion: string;
  researchValue: string;
  mechanismTheory: string;
  targetContext: string;
  methodDesign: string;
  expectedContribution: string;
  feasibilityRisk: string;
  assumptions: string[];
  unresolvedItems: string[];
  recommended: boolean;
  directionHash: string;
};

export type V2Alpha5ZoteroEvidenceReference = {
  itemKey: string;
  metadataHash: string;
  doi: string | null;
  stableId: string | null;
  role: "BACKGROUND" | "GAP" | "METHOD" | "DISCUSSION" | "CITATION";
  duplicateClass: "EXACT" | "POSSIBLE_REVIEW" | "UNIQUE";
  authorityBoundary: "EVIDENCE_ONLY_NOT_OFFICIAL_RULE_OR_BUDGET";
};

export type V2Alpha5Workspace = {
  contractVersion: typeof V2_ALPHA5_CONTRACT_VERSION;
  proposalSchemaId: typeof V2_ALPHA5_PROPOSAL_SCHEMA_ID;
  researchIntentHash: string;
  domainSelection: V2Alpha3DomainSelection;
  targetSelection: V2Alpha5TargetSelection;
  sourceBundle: V2Alpha5OfficialSourceBundle;
  directions: V2Alpha5Direction[];
  recommendedDirectionId: string;
  selectedDirectionId: string;
  proposalsByDirection: Record<string, ProposalDraft>;
  officialFacts: Array<{ label: string; status: V2Alpha5FactStatus; value: string | null; sourceHash: string | null }>;
  historicalObservations: Array<{ text: string; boundary: "HISTORICAL_NOT_CURRENT_RULE" }>;
  oldMikeRecommendations: Array<{ text: string; boundary: "RECOMMENDATION_NOT_OFFICIAL_FACT" }>;
  reviewerConcerns: Array<{ concernId: string; text: string; severity: "NEEDS_REVIEW" | "BLOCKING_UNKNOWN" }>;
  zoteroEvidence: V2Alpha5ZoteroEvidenceReference[];
  humanGate: { required: true; scope: "WHOLE_ARTIFACT"; confirmed: false; contentHash: string };
  providerSubmissionCount: 1;
  cardSwitchProviderSubmissionCount: 0;
  formalResearchWriteCount: 0;
  onlineDatabaseWriteCount: 0;
  externalMutationCount: 0;
};

export type V2Alpha5WorkspaceRequest = {
  contractVersion: typeof V2_ALPHA5_CONTRACT_VERSION;
  requestId: string;
  domainSelection: V2Alpha3DomainSelection;
  targetId: V2Alpha5TargetId;
  researchDirection: string;
  sourceBundle: V2Alpha5OfficialSourceBundle;
};
