import "server-only";

export const SUBMISSION_NAVIGATOR_CONTRACT_VERSION = "publication-grant-navigator/2.0.0" as const;
export const SUBMISSION_NAVIGATOR_MAX_BODY_BYTES = 1_000_000;
export const SUBMISSION_NAVIGATOR_STAGE = "M06_NAVIGATOR_RUN" as const;
export const SUBMISSION_NAVIGATOR_DOCUMENT_TYPE = "NAVIGATOR_ROUTE" as const;

export const navigatorModes = ["auto", "journal", "nstc", "moe_tpr", "compare_all"] as const;
export const navigatorStages = ["concept", "proposal", "data_collection", "results", "manuscript"] as const;
export const navigatorPrimaryContributions = [
  "scientific_knowledge", "theoretical_contribution", "methodological_contribution", "technical_system",
  "educational_mechanism", "teaching_improvement", "professional_practice", "policy_or_social_impact",
] as const;

export type NavigatorMode = (typeof navigatorModes)[number];
export type NavigatorStage = (typeof navigatorStages)[number];
export type NavigatorPrimaryContribution = (typeof navigatorPrimaryContributions)[number];

export class SubmissionNavigatorContractError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) {
    super(code);
    this.name = "SubmissionNavigatorContractError";
    this.code = code;
    this.status = status;
  }
}

type BoundedText = { value: string; max: number };

function requireText(value: unknown, field: string, max = 4_000): string {
  if (typeof value !== "string") throw new SubmissionNavigatorContractError(`invalid_${field}`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) throw new SubmissionNavigatorContractError(`invalid_${field}`);
  return trimmed;
}

function optionalText(value: unknown, max = 4_000): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new SubmissionNavigatorContractError("invalid_optional_text");
  const trimmed = value.trim();
  return trimmed ? (trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…（原文已截斷）`) : null;
}

function requireStringArray(value: unknown, field: string, maxItems = 20, maxItemLength = 1_000): string[] {
  if (!Array.isArray(value)) throw new SubmissionNavigatorContractError(`invalid_${field}`);
  if (value.length > maxItems) throw new SubmissionNavigatorContractError(`invalid_${field}`);
  return value.map((item) => requireText(item, field, maxItemLength));
}

function optionalStringArray(value: unknown, maxItems = 20, maxItemLength = 1_000): string[] | null {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) throw new SubmissionNavigatorContractError("invalid_optional_array");
  if (value.length > maxItems) throw new SubmissionNavigatorContractError("invalid_optional_array");
  return value.map((item) => requireText(item, "array_item", maxItemLength));
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export type NavigatorTopicProfile = {
  titleZh: string;
  titleEn: string;
  abstract: string;
  researchGap: string;
  researchQuestions: string[];
  theory: string[];
  coreProblem: string;
  primaryContribution: NavigatorPrimaryContribution | null;
  secondaryContributions: string[];
  intervention: string[];
  population: string;
  context: string;
  method: string;
  variables: string[];
  plannedData: string;
  expectedOutcomes: string[];
  noveltyAnalysis: string;
};

export type NavigatorResearcherProfile = {
  position: string;
  academicExpertise: string[];
  teachingExpertise: string[];
  recentPapers: string[];
  recentGrants: string[];
  teachingOutcomes: string[];
  techOutcomes: string[];
  availableEquipment: string[];
  availableData: string[];
  collaborators: string[];
  activeGrants: string[];
  pastGrants: string[];
};

export type NavigatorCourseProfile = {
  courseName: string;
  credits: string;
  required: boolean;
  department: string;
  semester: string;
  instructor: string;
  studentLevel: string;
  enrollment: number | null;
  objectives: string[];
  content: string[];
  currentMethods: string[];
  teachingProblem: string;
  problemEvidence: string[];
  plannedIntervention: string;
  learningOutcomes: string[];
  assessments: string[];
  syllabus: string;
};

export type NavigatorManuscriptProfile = {
  articleType: string;
  title: string;
  abstract: string;
  keywords: string[];
  methods: string;
  sample: string;
  results: string;
  contribution: string;
  wordCount: number | null;
  tablesFigures: string;
  ethicsApproval: string;
  dataAvailability: string;
  codeAvailability: string;
  funding: string;
  conflictOfInterest: string;
  aiToolDisclosure: string;
};

export type NavigatorInstitutionProfile = {
  school: string;
  internalRules: string[];
  internalDeadline: string;
  irbProcess: string;
  adminResources: string[];
  internalFunding: string;
  restrictions: string[];
};

export type NavigatorUserConstraints = {
  journalTier: string | null;
  indexRequirement: string | null;
  maxAPC: string | null;
  reviewSpeed: string | null;
  projectYears: number | null;
  budgetCeiling: string | null;
  sampleAccess: string | null;
  methods: string[] | null;
  excludedJournals: string[] | null;
  excludedDisciplines: string[] | null;
};

export type NavigatorRunRequest = {
  contractVersion: typeof SUBMISSION_NAVIGATOR_CONTRACT_VERSION;
  kind: "NAVIGATOR_RUN";
  targetYear: string;
  targetMode: NavigatorMode;
  researchStage: NavigatorStage;
  topicProfile: NavigatorTopicProfile;
  researcherProfile: NavigatorResearcherProfile;
  courseProfile: NavigatorCourseProfile | null;
  manuscriptProfile: NavigatorManuscriptProfile | null;
  institutionProfile: NavigatorInstitutionProfile | null;
  userConstraints: NavigatorUserConstraints | null;
  idempotencyKey: string;
};

export function parseNavigatorRunRequest(value: unknown): NavigatorRunRequest {
  if (!record(value)) throw new SubmissionNavigatorContractError("invalid_request_shape");
  if (value.contractVersion !== SUBMISSION_NAVIGATOR_CONTRACT_VERSION) throw new SubmissionNavigatorContractError("invalid_contract_version");
  if (value.kind !== "NAVIGATOR_RUN") throw new SubmissionNavigatorContractError("invalid_kind");
  const targetYear = requireText(value.targetYear, "target_year", 16);
  if (!/^\d{4}$/.test(targetYear)) throw new SubmissionNavigatorContractError("invalid_target_year");
  const targetMode = value.targetMode;
  if (typeof targetMode !== "string" || !navigatorModes.includes(targetMode as NavigatorMode)) throw new SubmissionNavigatorContractError("invalid_target_mode");
  const researchStage = value.researchStage;
  if (typeof researchStage !== "string" || !navigatorStages.includes(researchStage as NavigatorStage)) throw new SubmissionNavigatorContractError("invalid_research_stage");
  const idempotencyKey = requireText(value.idempotencyKey, "idempotency_key", 160);
  if (!/^[A-Za-z0-9._:-]{8,160}$/.test(idempotencyKey)) throw new SubmissionNavigatorContractError("invalid_idempotency_key");

  const tp = record(value.topicProfile) ? value.topicProfile : {};
  const topicProfile: NavigatorTopicProfile = {
    titleZh: requireText(tp.titleZh, "topic_title_zh", 200),
    titleEn: requireText(tp.titleEn, "topic_title_en", 300),
    abstract: requireText(tp.abstract, "topic_abstract", 6_000),
    researchGap: requireText(tp.researchGap, "topic_research_gap", 4_000),
    researchQuestions: requireStringArray(tp.researchQuestions, "topic_research_questions", 10),
    theory: requireStringArray(tp.theory, "topic_theory", 10),
    coreProblem: requireText(tp.coreProblem, "topic_core_problem", 4_000),
    primaryContribution: typeof tp.primaryContribution === "string" && navigatorPrimaryContributions.includes(tp.primaryContribution as NavigatorPrimaryContribution) ? tp.primaryContribution as NavigatorPrimaryContribution : null,
    secondaryContributions: requireStringArray(tp.secondaryContributions, "topic_secondary_contributions", 8),
    intervention: requireStringArray(tp.intervention, "topic_intervention", 10),
    population: requireText(tp.population, "topic_population", 1_000),
    context: requireText(tp.context, "topic_context", 1_000),
    method: requireText(tp.method, "topic_method", 4_000),
    variables: requireStringArray(tp.variables, "topic_variables", 20),
    plannedData: requireText(tp.plannedData, "topic_planned_data", 4_000),
    expectedOutcomes: requireStringArray(tp.expectedOutcomes, "topic_expected_outcomes", 10),
    noveltyAnalysis: requireText(tp.noveltyAnalysis, "topic_novelty_analysis", 4_000),
  };

  const rp = record(value.researcherProfile) ? value.researcherProfile : {};
  const researcherProfile: NavigatorResearcherProfile = {
    position: requireText(rp.position, "researcher_position", 500),
    academicExpertise: requireStringArray(rp.academicExpertise, "researcher_academic_expertise", 10),
    teachingExpertise: requireStringArray(rp.teachingExpertise, "researcher_teaching_expertise", 10),
    recentPapers: requireStringArray(rp.recentPapers, "researcher_recent_papers", 20),
    recentGrants: requireStringArray(rp.recentGrants, "researcher_recent_grants", 20),
    teachingOutcomes: requireStringArray(rp.teachingOutcomes, "researcher_teaching_outcomes", 10),
    techOutcomes: requireStringArray(rp.techOutcomes, "researcher_tech_outcomes", 10),
    availableEquipment: requireStringArray(rp.availableEquipment, "researcher_equipment", 10),
    availableData: requireStringArray(rp.availableData, "researcher_data", 10),
    collaborators: requireStringArray(rp.collaborators, "researcher_collaborators", 10),
    activeGrants: requireStringArray(rp.activeGrants, "researcher_active_grants", 10),
    pastGrants: requireStringArray(rp.pastGrants, "researcher_past_grants", 10),
  };

  let courseProfile: NavigatorCourseProfile | null = null;
  if (value.courseProfile !== null && value.courseProfile !== undefined) {
    const cp = record(value.courseProfile) ? value.courseProfile : {};
    courseProfile = {
      courseName: requireText(cp.courseName, "course_name", 300),
      credits: requireText(cp.credits, "course_credits", 50),
      required: cp.required === true,
      department: requireText(cp.department, "course_department", 300),
      semester: requireText(cp.semester, "course_semester", 200),
      instructor: requireText(cp.instructor, "course_instructor", 300),
      studentLevel: requireText(cp.studentLevel, "course_student_level", 200),
      enrollment: typeof cp.enrollment === "number" && Number.isFinite(cp.enrollment) ? Math.max(0, Math.min(5_000, Math.round(cp.enrollment))) : null,
      objectives: requireStringArray(cp.objectives, "course_objectives", 10),
      content: requireStringArray(cp.content, "course_content", 20),
      currentMethods: requireStringArray(cp.currentMethods, "course_current_methods", 10),
      teachingProblem: requireText(cp.teachingProblem, "course_teaching_problem", 4_000),
      problemEvidence: requireStringArray(cp.problemEvidence, "course_problem_evidence", 10),
      plannedIntervention: requireText(cp.plannedIntervention, "course_planned_intervention", 4_000),
      learningOutcomes: requireStringArray(cp.learningOutcomes, "course_learning_outcomes", 10),
      assessments: requireStringArray(cp.assessments, "course_assessments", 10),
      syllabus: requireText(cp.syllabus, "course_syllabus", 8_000),
    };
  }

  let manuscriptProfile: NavigatorManuscriptProfile | null = null;
  if (value.manuscriptProfile !== null && value.manuscriptProfile !== undefined) {
    const mp = record(value.manuscriptProfile) ? value.manuscriptProfile : {};
    manuscriptProfile = {
      articleType: requireText(mp.articleType, "manuscript_article_type", 200),
      title: requireText(mp.title, "manuscript_title", 300),
      abstract: requireText(mp.abstract, "manuscript_abstract", 6_000),
      keywords: requireStringArray(mp.keywords, "manuscript_keywords", 8, 100),
      methods: requireText(mp.methods, "manuscript_methods", 8_000),
      sample: requireText(mp.sample, "manuscript_sample", 4_000),
      results: requireText(mp.results, "manuscript_results", 8_000),
      contribution: requireText(mp.contribution, "manuscript_contribution", 4_000),
      wordCount: typeof mp.wordCount === "number" && Number.isFinite(mp.wordCount) ? Math.max(0, Math.min(500_000, Math.round(mp.wordCount))) : null,
      tablesFigures: requireText(mp.tablesFigures, "manuscript_tables_figures", 1_000),
      ethicsApproval: requireText(mp.ethicsApproval, "manuscript_ethics_approval", 1_000),
      dataAvailability: requireText(mp.dataAvailability, "manuscript_data_availability", 1_000),
      codeAvailability: requireText(mp.codeAvailability, "manuscript_code_availability", 1_000),
      funding: requireText(mp.funding, "manuscript_funding", 1_000),
      conflictOfInterest: requireText(mp.conflictOfInterest, "manuscript_conflict_of_interest", 1_000),
      aiToolDisclosure: requireText(mp.aiToolDisclosure, "manuscript_ai_tool_disclosure", 1_000),
    };
  }

  let institutionProfile: NavigatorInstitutionProfile | null = null;
  if (value.institutionProfile !== null && value.institutionProfile !== undefined) {
    const ip = record(value.institutionProfile) ? value.institutionProfile : {};
    institutionProfile = {
      school: requireText(ip.school, "institution_school", 300),
      internalRules: requireStringArray(ip.internalRules, "institution_internal_rules", 10),
      internalDeadline: requireText(ip.internalDeadline, "institution_internal_deadline", 500),
      irbProcess: requireText(ip.irbProcess, "institution_irb_process", 4_000),
      adminResources: requireStringArray(ip.adminResources, "institution_admin_resources", 10),
      internalFunding: requireText(ip.internalFunding, "institution_internal_funding", 1_000),
      restrictions: requireStringArray(ip.restrictions, "institution_restrictions", 10),
    };
  }

  let userConstraints: NavigatorUserConstraints | null = null;
  if (value.userConstraints !== null && value.userConstraints !== undefined) {
    const uc = record(value.userConstraints) ? value.userConstraints : {};
    userConstraints = {
      journalTier: optionalText(uc.journalTier, 500),
      indexRequirement: optionalText(uc.indexRequirement, 500),
      maxAPC: optionalText(uc.maxAPC, 500),
      reviewSpeed: optionalText(uc.reviewSpeed, 500),
      projectYears: typeof uc.projectYears === "number" && Number.isFinite(uc.projectYears) ? Math.max(1, Math.min(10, Math.round(uc.projectYears))) : null,
      budgetCeiling: optionalText(uc.budgetCeiling, 500),
      sampleAccess: optionalText(uc.sampleAccess, 1_000),
      methods: optionalStringArray(uc.methods, 10),
      excludedJournals: optionalStringArray(uc.excludedJournals, 20),
      excludedDisciplines: optionalStringArray(uc.excludedDisciplines, 20),
    };
  }

  return {
    contractVersion: SUBMISSION_NAVIGATOR_CONTRACT_VERSION,
    kind: "NAVIGATOR_RUN",
    targetYear,
    targetMode: targetMode as NavigatorMode,
    researchStage: researchStage as NavigatorStage,
    topicProfile,
    researcherProfile,
    courseProfile,
    manuscriptProfile,
    institutionProfile,
    userConstraints,
    idempotencyKey,
  };
}
