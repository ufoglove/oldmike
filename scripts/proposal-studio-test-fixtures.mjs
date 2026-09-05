import { moeRequirementCategories, nstcRequirementCategories, proposalStudioHash } from "../lib/proposal-studio-contract.ts";

const split = (value) => value.split("\n");

export function buildSyntheticProposal(scenario) {
  const sourceHash = proposalStudioHash({ fixture: scenario.name, mode: scenario.mode, retrievedAt: scenario.retrievedAt });
  const categories = scenario.mode === "NSTC_RESEARCH" ? nstcRequirementCategories : moeRequirementCategories;
  const status = scenario.requirementStatus;
  return {
    mode: scenario.mode,
    callProgram: { programName: `${scenario.mode} synthetic fixture program — not official`, programCode: null, effectiveYear: 2026 },
    officialSource: { sourceUrl: scenario.mode === "NSTC_RESEARCH" ? "https://nstc.example.test/official-synthetic-fixture" : "https://moe.example.test/official-synthetic-fixture", authorityClass: scenario.mode === "NSTC_RESEARCH" ? "NSTC_OFFICIAL" : "MOE_OFFICIAL", retrievedAt: scenario.retrievedAt, effectiveYear: 2026, sourceHash, humanVerified: scenario.humanVerified },
    bilingual: { titleZhTw: `${scenario.name} 合成計畫`, titleEn: `${scenario.name} synthetic proposal`, abstractZhTw: "本地合成摘要，並非官方內容。", abstractEn: "Local synthetic abstract; not official content.", keywordsZhTw: ["合成", "待核對"], keywordsEn: ["synthetic", "verification"] },
    narrative: { problem: "合成問題，待研究者界定。", background: "合成背景，待證據支持。", literatureGap: "合成文獻缺口，不能當作事實。", aims: ["建立可追溯的合成目標。"], researchQuestions: ["如何驗證本合成問題？"], hypotheses: ["合成假設，待檢驗。"], innovation: "合成創新主張，尚未驗證。", significance: "合成重要性，尚未驗證。", expectedImpact: "合成影響，尚未驗證。", methods: "使用預先定義且可重現的方法。", sample: "合成樣本設計。", data: "合成資料方案，不含研究資料。", analysis: "合成分析計畫。", ethics: "不推定倫理核准。", privacy: "採資料最小化並待人工審查。", risks: ["過度主張風險。"], alternatives: ["證據不足時縮小範圍。"] },
    modeSpecific: scenario.mode === "NSTC_RESEARCH" ? { kind: "NSTC_RESEARCH", cm03Narrative: "合成 CM03 式結構，不代表官方格式。", preliminaryEvidence: "合成初步證據占位，不代表成果。", feasibility: "合成可行性，待資料與資源核對。", expectedOutputs: ["人工核對的固定版本。"] } : { kind: "MOE_TEACHING_PRACTICE", courseContext: "合成課程脈絡。", teachingProblem: "合成教學問題。", intervention: "合成介入設計。", learningOutcomes: ["合成學習成效。"], evaluationDesign: "合成評量設計。", implementationFidelity: "合成忠實度紀錄。", teachingArtifacts: ["合成教學產物。"], reflectionPlan: "合成反思計畫。" },
    workPackages: [{ workPackageId: "wp-001", title: "合成工作包", objective: "建立問題到產出的追溯鏈。", methods: "逐項核對固定契約。", startMonth: 1, endMonth: 12 }],
    milestones: [{ milestoneId: "milestone-001", workPackageId: "wp-001", dueMonth: 12, deliverable: "人工核對的固定版本。" }],
    kpis: [{ kpiId: "kpi-001", workPackageId: "wp-001", measure: "要求矩陣完整度", target: "所有官方事實 PASS 或 NA", evidencePlan: "Human Gate 內容雜湊" }],
    team: [{ roleId: "role-001", role: "計畫主持", responsibility: "核對事實、方法與預算。", contribution: "維持證據與決策追溯。" }],
    resources: ["合成既有資源"],
    budget: { currency: "TWD", items: [{ itemId: "budget-001", category: "OPERATING", unit: "項", quantity: 2, unitCostTwd: 1500, subtotalTwd: 3000, justification: "此為合成算術範例，正式必要性必須連回工作包並依當年度規則核對。", workPackageId: "wp-001", ruleEvidenceStatus: status === "PASS" ? "PASS" : status === "NA" ? "NA" : "UNKNOWN" }], totalTwd: 3000 },
    requirements: categories.map((category) => ({ category, status, officialRule: `${category} synthetic rule — not official`, evidence: status === "PASS" ? "Synthetic human-verified evidence marker." : "Official evidence remains unavailable.", remediation: "Verify against the current official source.", sourceHash })),
    attachments: [{ attachmentId: "attachment-001", label: "Synthetic annual attachment checklist", required: true, status: status === "PASS" ? "PASS" : "UNKNOWN", evidence: status === "PASS" ? "Synthetic verification marker." : "Pending official verification." }],
    unresolvedIssues: scenario.unresolved ? split("年度規則尚待核對") : [],
  };
}
