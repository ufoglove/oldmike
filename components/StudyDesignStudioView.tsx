"use client";

/**
 * Study Design & Analysis Planning Studio View (V3-U07-FULL)
 * Spec: docs/stage07/spec-v3-4.0.md §1, §3, §5, §6, §7, §8, §9, §10, §11, §12, §13, §14, §15, §17, §19, §20, §23, §26
 *
 * Implements:
 * 1. Seamless upgrade from Stage 6 handoff into full Study Design & Analysis workspace
 * 2. Tri-goal specific design views (JOURNAL_SCI_SSCI, NSTC_GENERAL, MOE_TPR)
 * 3. Multi-component design candidates & study structure (arms, units, timepoints)
 * 4. Real deterministic sample planning calculations (using planning-calculation-engine)
 * 5. RQ - Design - Data - Analysis Matrix
 * 6. Analysis Plan (Planning Mode) with missingness & multiplicity strategies
 * 7. Alignment issue panel with direct navigation
 * 8. One-click completion to Stage 8 (route-studio)
 */

import { useState } from "react";
import {
  type StudyDesignWorkspace,
  type DesignLogicFinding,
  type DesignMeasurementRequirement,
  type StudyArm,
  type StudyTimePoint,
} from "@/lib/study-design-planning-contract";
import { type TheoryMechanismSnapshot } from "@/lib/theory-mechanism-v3-contract";
import { buildStudyDesignWorkspaceFromTheory, runStudyDesignLogicCheck } from "@/lib/study-design-planning-service";
import { calculateTwoIndependentMeansPower, calculateDetectableEffectGivenN } from "@/lib/planning-calculation-engine";
import { RESEARCH_GOAL_DEFINITIONS } from "@/lib/research-goal-registry";

export default function StudyDesignStudioView({
  theorySnapshot,
  initialWorkspace,
  onReturnToTheory,
  onNavigateToStage8,
}: {
  theorySnapshot: TheoryMechanismSnapshot;
  initialWorkspace?: StudyDesignWorkspace;
  onReturnToTheory?: () => void;
  onNavigateToStage8?: (handoffSnapshotId: string) => void;
}) {
  const [workspace, setWorkspace] = useState<StudyDesignWorkspace>(() => {
    if (initialWorkspace) return initialWorkspace;
    return buildStudyDesignWorkspaceFromTheory({
      workspaceId: `ws_sd_${theorySnapshot.projectId}`,
      projectId: theorySnapshot.projectId,
      theorySnapshot,
    });
  });

  const [activeTab, setActiveTab] = useState<"overview" | "structure" | "samplePlanning" | "measurements" | "matrix" | "analysisPlan" | "issues">("overview");
  const [logicFindings, setLogicFindings] = useState<DesignLogicFinding[]>(() => runStudyDesignLogicCheck(workspace));
  const [completing, setCompleting] = useState(false);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [focusedFieldRef, setFocusedFieldRef] = useState<string | null>(null);

  // Recalculation form states
  const [recalcEffectD, setRecalcEffectD] = useState(0.5);
  const [recalcPower, setRecalcPower] = useState(0.8);
  const [recalcAttrition, setRecalcAttrition] = useState(0.15);

  const goalDef = RESEARCH_GOAL_DEFINITIONS[workspace.primaryGoal];

  const handleWorkspaceChange = (updater: (prev: StudyDesignWorkspace) => StudyDesignWorkspace) => {
    setWorkspace((prev) => {
      const next = updater(prev);
      setLogicFindings(runStudyDesignLogicCheck(next));
      return next;
    });
  };

  // Re-run real planning calculation
  const handleExecuteRecalculation = () => {
    const calcResult = calculateTwoIndependentMeansPower({
      alpha: 0.05,
      power: recalcPower,
      effectSizeD: recalcEffectD,
      sidedness: "TWO_SIDED",
      allocationRatio: 1.0,
      attritionRate: recalcAttrition,
    });

    handleWorkspaceChange((prev) => {
      const copy = JSON.parse(JSON.stringify(prev)) as StudyDesignWorkspace;
      copy.planningCalculations = [calcResult];
      if (copy.sampleJustifications.length > 0) {
        copy.sampleJustifications[0].planningCalculationRef = calcResult.calculationId;
        copy.sampleJustifications[0].nPerArmEstimated = calcResult.nPerArm;
        copy.sampleJustifications[0].totalAnalyzableNEstimated = calcResult.totalAnalyzableN;
        copy.sampleJustifications[0].recruitmentTargetN = calcResult.recruitmentTargetN;
        copy.sampleJustifications[0].justificationNarrative = `重新計算：依據效果量 d=${recalcEffectD}，alpha=0.05，power=${recalcPower}，計算得每組 n=${calcResult.nPerArm} 人（總分析樣本 ${calcResult.totalAnalyzableN} 人）。考量 ${(recalcAttrition * 100).toFixed(0)}% 預期流失率，招募目標設定為 ${calcResult.recruitmentTargetN} 人。`;
      }
      return copy;
    });
  };

  // Lock toggle on measurement requirement
  const handleToggleMeasurementLock = (measurementId: string) => {
    handleWorkspaceChange((prev) => {
      const copy = JSON.parse(JSON.stringify(prev)) as StudyDesignWorkspace;
      const m = copy.measurementRequirements.find((item) => item.measurementId === measurementId);
      if (m) m.isLocked = !m.isLocked;
      return copy;
    });
  };

  // Lock toggle on analysis plan
  const handleToggleAnalysisLock = (analysisPlanId: string) => {
    handleWorkspaceChange((prev) => {
      const copy = JSON.parse(JSON.stringify(prev)) as StudyDesignWorkspace;
      const a = copy.analysisPlans.find((item) => item.analysisPlanId === analysisPlanId);
      if (a) a.isLocked = !a.isLocked;
      return copy;
    });
  };

  // Old Mike AI Assist: refine analysis strategy
  const handleAiRefineAnalysis = (analysisPlanId: string) => {
    handleWorkspaceChange((prev) => {
      const copy = JSON.parse(JSON.stringify(prev)) as StudyDesignWorkspace;
      const a = copy.analysisPlans.find((item) => item.analysisPlanId === analysisPlanId);
      if (a && !a.isLocked) {
        a.modelOrStrategy = `${a.modelOrStrategy}（老麥協作建議：納入受試者基線前測反應時間作為共變數，並以線性混合效應模型檢定時間與組別交互作用）`;
      }
      return copy;
    });
  };

  // Precise Navigation to Issue
  const handleNavigateToIssue = (finding: DesignLogicFinding) => {
    if (finding.targetSection.includes("timePoints")) {
      setActiveTab("structure");
    } else if (finding.targetSection.includes("sampleJustifications")) {
      setActiveTab("samplePlanning");
    } else if (finding.targetSection.includes("measurementRequirements")) {
      setActiveTab("measurements");
    } else if (finding.targetSection.includes("Rationale")) {
      setActiveTab("overview");
    }
    setFocusedFieldRef(finding.targetFieldRef || null);
  };

  // Complete to Stage 8 (route-studio)
  const handleCompleteDesign = async () => {
    setCompleting(true);
    setErrorMessage(null);
    setCompletionMessage(null);

    try {
      const fatalIssues = logicFindings.filter((f) => f.severity === "FATAL");
      if (fatalIssues.length > 0) {
        setErrorMessage("存在阻礙完成的致命問題（FATAL），請依下方缺失清單前往補足。");
        setActiveTab("issues");
        setCompleting(false);
        return;
      }

      const res = await fetch(`/api/projects/${workspace.projectId}/study-design/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-workspace-id": workspace.workspaceId },
        body: JSON.stringify({ workspace, theorySnapshot }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "保存交接失敗");
      }

      setCompletionMessage("✔ 研究設計與分析規劃基線已完成保存！已成功向第八階段（三路線研究與計畫工作室）建立不可變交接。");
      if (onNavigateToStage8 && json.data?.snapshot?.snapshotId) {
        onNavigateToStage8(json.data.snapshot.snapshotId);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "完成研究設計規劃時發生錯誤");
    } finally {
      setCompleting(false);
    }
  };

  const fatalCount = logicFindings.filter((f) => f.severity === "FATAL").length;
  const warningCount = logicFindings.filter((f) => f.severity === "MAJOR_WARNING").length;

  return (
    <div style={{ maxWidth: 1040, margin: "24px auto", padding: "20px 24px", background: "#fff", border: "1px solid #dde6e0", borderRadius: 16 }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #eef1ef", paddingBottom: 16, marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ background: "#e3f2ec", color: "#1f8a70", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
              第七階段 · 研究設計與分析計畫 (Study Design & Analysis)
            </span>
            <span style={{ background: "#f0f4f2", color: "#4d6156", padding: "2px 8px", borderRadius: 6, fontSize: 11 }}>
              主目標：{goalDef.labelZh}
            </span>
            <span style={{ background: "#ede7f6", color: "#512da8", padding: "2px 8px", borderRadius: 6, fontSize: 11 }}>
              主要方案：{workspace.designCandidates[0]?.designType || "RCT"}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, color: "#23423a" }}>
            老麥 · 研究設計與分析規劃工作區
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#66756d" }}>
            專案：<code>{workspace.projectId}</code> · 理論快照：<code>{workspace.sourceTheorySnapshotId}</code> · 設計修訂：rev{workspace.currentRevision}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {onReturnToTheory && (
            <button type="button" className="secondary-button" onClick={onReturnToTheory} style={{ fontSize: 13 }}>
              ← 返回理論與機制
            </button>
          )}
          <button
            type="button"
            className="primary-button"
            onClick={handleCompleteDesign}
            disabled={completing || fatalCount > 0}
            style={{ fontSize: 13, background: fatalCount > 0 ? "#a0aba5" : "#1f8a70" }}
          >
            {completing ? "正在保存基線..." : fatalCount > 0 ? `尚缺 ${fatalCount} 項致命缺失` : "完成研究設計，前進「三路線工作室」→"}
          </button>
        </div>
      </div>

      {/* Messages */}
      {completionMessage && (
        <div style={{ background: "#e8f5e9", border: "1px solid #81c784", color: "#1b5e20", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {completionMessage}
        </div>
      )}
      {errorMessage && (
        <div style={{ background: "#ffebee", border: "1px solid #e57373", color: "#c62828", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {errorMessage}
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: "flex", borderBottom: "2px solid #eef1ef", gap: 12, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          style={{ padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontWeight: activeTab === "overview" ? 700 : 400, color: activeTab === "overview" ? "#1f8a70" : "#66756d", borderBottom: activeTab === "overview" ? "2px solid #1f8a70" : "none" }}
        >
          1. 總覽與方案選擇
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("structure")}
          style={{ padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontWeight: activeTab === "structure" ? 700 : 400, color: activeTab === "structure" ? "#1f8a70" : "#66756d", borderBottom: activeTab === "structure" ? "2px solid #1f8a70" : "none" }}
        >
          2. 對象／組別／時點
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("samplePlanning")}
          style={{ padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontWeight: activeTab === "samplePlanning" ? 700 : 400, color: activeTab === "samplePlanning" ? "#1f8a70" : "#66756d", borderBottom: activeTab === "samplePlanning" ? "2px solid #1f8a70" : "none" }}
        >
          3. 樣本規劃與計算引擎
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("measurements")}
          style={{ padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontWeight: activeTab === "measurements" ? 700 : 400, color: activeTab === "measurements" ? "#1f8a70" : "#66756d", borderBottom: activeTab === "measurements" ? "2px solid #1f8a70" : "none" }}
        >
          4. 測量需求 ({workspace.measurementRequirements.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("matrix")}
          style={{ padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontWeight: activeTab === "matrix" ? 700 : 400, color: activeTab === "matrix" ? "#1f8a70" : "#66756d", borderBottom: activeTab === "matrix" ? "2px solid #1f8a70" : "none" }}
        >
          5. RQ–設計–資料矩陣
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("analysisPlan")}
          style={{ padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontWeight: activeTab === "analysisPlan" ? 700 : 400, color: activeTab === "analysisPlan" ? "#1f8a70" : "#66756d", borderBottom: activeTab === "analysisPlan" ? "2px solid #1f8a70" : "none" }}
        >
          6. 分析計畫 (Planning Mode)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("issues")}
          style={{ padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontWeight: activeTab === "issues" ? 700 : 400, color: fatalCount > 0 ? "#d32f2f" : activeTab === "issues" ? "#1f8a70" : "#66756d", borderBottom: activeTab === "issues" ? "2px solid #1f8a70" : "none" }}
        >
          7. 檢查與缺失 ({fatalCount + warningCount})
        </button>
      </div>

      {/* Tab 1: Overview & Goal Rationale */}
      {activeTab === "overview" && (
        <div>
          <div style={{ background: "#fbfdfc", border: "1px solid #e6ede9", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <strong style={{ fontSize: 15, color: "#23423a" }}>研究設計問題與推論目標 (Design Brief)</strong>
            <p style={{ fontSize: 13, color: "#3a4a40", marginTop: 6, lineHeight: 1.6 }}>
              {workspace.designBrief.targetInformationGoal}
            </p>
            <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: "#66756d" }}>
              <span>選定方案：<strong>{workspace.designCandidates[0]?.designName}</strong></span>
              <span>決策狀態：<strong>{workspace.decision}</strong></span>
              <span>分析單位：<strong>{workspace.studyStructure.analysisUnit}</strong></span>
            </div>
          </div>

          {workspace.primaryGoal === "JOURNAL_SCI_SSCI" && workspace.journalRationale && (
            <div style={{ background: "#fbfdfc", border: "1px solid #e6ede9", borderRadius: 12, padding: 16 }}>
              <h3 style={{ margin: "0 0 10px 0", color: "#1f8a70", fontSize: 15 }}>📘 國際期刊研究設計與方法對齊 (Journal Design Rationale)</h3>
              <p style={{ fontSize: 13, color: "#3a4a40", margin: "4px 0" }}><strong>文章類型與方法對齊：</strong>{workspace.journalRationale.articleTypeAndMethodAlignment}</p>
              <p style={{ fontSize: 13, color: "#3a4a40", margin: "4px 0" }}><strong>國際證據強度：</strong>{workspace.journalRationale.evidenceStrengthForInternationalAudience}</p>
              <p style={{ fontSize: 12, color: "#2e7d32", margin: "4px 0" }}><strong>候選報告規範：</strong>{workspace.journalRationale.reportingGuidelineCandidate}</p>
            </div>
          )}

          {workspace.primaryGoal === "NSTC_GENERAL" && workspace.nstcRationale && (
            <div style={{ background: "#fbfdfc", border: "1px solid #e6ede9", borderRadius: 12, padding: 16 }}>
              <h3 style={{ margin: "0 0 10px 0", color: "#b87000", fontSize: 15 }}>🏛️ 國科會一般計畫方法與資源合理性 (NSTC Design Rationale)</h3>
              <p style={{ fontSize: 13, color: "#3a4a40", margin: "4px 0" }}><strong>科學方法可行性：</strong>{workspace.nstcRationale.scientificMethodFeasibility}</p>
              <p style={{ fontSize: 13, color: "#3a4a40", margin: "4px 0" }}><strong>工作包與里程碑對齊：</strong>{workspace.nstcRationale.workPackageAndMilestoneAlignment}</p>
              <p style={{ fontSize: 13, color: "#3a4a40", margin: "4px 0" }}><strong>經費與設備合理性：</strong>{workspace.nstcRationale.personnelAndEquipmentAllocationReason}</p>
            </div>
          )}

          {workspace.primaryGoal === "MOE_TPR" && workspace.moeTprRationale && (
            <div style={{ background: "#fbfdfc", border: "1px solid #e6ede9", borderRadius: 12, padding: 16 }}>
              <h3 style={{ margin: "0 0 10px 0", color: "#6a1b9a", fontSize: 15 }}>🎓 教育部教學實踐課程與設計檢核 (MOE TPR Design Alignment)</h3>
              <p style={{ fontSize: 13, color: "#3a4a40", margin: "4px 0" }}><strong>課程問題與成果對齊：</strong>{workspace.moeTprRationale.pedagogicalProblemAndOutcomeAlignment}</p>
              <p style={{ fontSize: 13, color: "#3a4a40", margin: "4px 0" }}><strong>班級混淆風險處置：</strong>{workspace.moeTprRationale.classroomArmConfoundingRemedy}</p>
              <p style={{ fontSize: 12, color: "#e65100", margin: "4px 0" }}><strong>評量方式檢核：</strong>{workspace.moeTprRationale.studentAssessmentFeasibility}</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Study Structure (Arms, Units, Timepoints) */}
      {activeTab === "structure" && (
        <div>
          <h3 style={{ fontSize: 16, color: "#23423a", marginBottom: 12 }}>研究架構：組別、單位與測量時點</h3>
          
          <div style={{ background: "#fbfdfc", border: "1px solid #e6ede9", borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <strong style={{ color: "#1f8a70" }}>單位分層結構 (Unit Structure)</strong>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, marginTop: 8, fontSize: 13 }}>
              <div>抽樣單位：<strong>{workspace.studyStructure.samplingUnit}</strong></div>
              <div>分配單位：<strong>{workspace.studyStructure.allocationUnit}</strong></div>
              <div>觀察單位：<strong>{workspace.studyStructure.observationUnit}</strong></div>
              <div>分析單位：<strong>{workspace.studyStructure.analysisUnit}</strong></div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 14, color: "#23423a", marginBottom: 8 }}>比較組別 (Study Arms)</h4>
            <div style={{ display: "grid", gap: 10 }}>
              {workspace.studyStructure.arms.map((arm) => (
                <div key={arm.armId} style={{ border: "1px solid #e6ede9", borderRadius: 8, padding: 12, background: "#fbfdfc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong style={{ color: "#1f8a70" }}>{arm.armName} ({arm.armType})</strong>
                    <span style={{ fontSize: 12, color: "#66756d" }}>時長：{arm.dosageOrExposureTimeline}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "#3a4a40", margin: "6px 0 0" }}>{arm.interventionDescription}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: 14, color: "#23423a", marginBottom: 8 }}>測量時程 (Time Points)</h4>
            <div style={{ display: "grid", gap: 10 }}>
              {workspace.studyStructure.timePoints.map((tp) => (
                <div key={tp.timePointId} style={{ border: "1px solid #e6ede9", borderRadius: 8, padding: 12, background: tp.isFollowUpRetention ? "#f0f8f4" : "#fbfdfc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong style={{ color: tp.isFollowUpRetention ? "#1f8a70" : "#23423a" }}>
                      {tp.label} {tp.isFollowUpRetention ? "✔ 延宕保留測量" : ""}
                    </strong>
                    <span style={{ fontSize: 12, color: "#66756d" }}>相對時間：{tp.relativeTiming}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "#5b6b63", margin: "4px 0 0" }}>{tp.purposeDescription}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Sample Justification & Calculation */}
      {activeTab === "samplePlanning" && (
        <div>
          <h3 style={{ fontSize: 16, color: "#23423a", marginBottom: 12 }}>樣本規劃與真實受控計算引擎 (Sample Planning Engine)</h3>

          <div style={{ background: "#fbfdfc", border: "1px solid #e6ede9", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <h4 style={{ margin: "0 0 10px 0", color: "#1f8a70", fontSize: 14 }}>現有受控計算結果 (PlanningCalculationRecord)</h4>
            {workspace.planningCalculations.map((calc) => (
              <div key={calc.calculationId} style={{ fontSize: 13, color: "#23423a", lineHeight: 1.6 }}>
                <div>計算狀態：<strong style={{ color: "#2e7d32" }}>{calc.status}</strong>（引擎：{calc.engineId}）</div>
                <div>每組需樣數：<strong>{calc.nPerArm} 人</strong> · 總分析樣本：<strong>{calc.totalAnalyzableN} 人</strong></div>
                <div>考慮流失招募目標：<strong style={{ color: "#1f8a70", fontSize: 15 }}>{calc.recruitmentTargetN} 人</strong></div>
                <div style={{ fontSize: 12, color: "#66756d", marginTop: 4 }}>公式依據：{calc.formulaReference}</div>
              </div>
            ))}
          </div>

          <div style={{ border: "1px solid #ccd8d1", borderRadius: 12, padding: 16 }}>
            <h4 style={{ margin: "0 0 10px 0", fontSize: 14, color: "#23423a" }}>調整參數並重新計算 (Recompute Sample Size)</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "#66756d" }}>預期效果量 (Cohen's d)</label>
                <input
                  type="number"
                  step="0.05"
                  value={recalcEffectD}
                  onChange={(e) => setRecalcEffectD(parseFloat(e.target.value) || 0.5)}
                  style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #ccd8d1" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#66756d" }}>目標檢定力 (Power)</label>
                <input
                  type="number"
                  step="0.05"
                  value={recalcPower}
                  onChange={(e) => setRecalcPower(parseFloat(e.target.value) || 0.8)}
                  style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #ccd8d1" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#66756d" }}>預期流失率 (Attrition)</label>
                <input
                  type="number"
                  step="0.05"
                  value={recalcAttrition}
                  onChange={(e) => setRecalcAttrition(parseFloat(e.target.value) || 0.15)}
                  style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #ccd8d1" }}
                />
              </div>
            </div>
            <button
              type="button"
              className="primary-button"
              onClick={handleExecuteRecalculation}
              style={{ fontSize: 12 }}
            >
              執行受控重新計算 →
            </button>
          </div>
        </div>
      )}

      {/* Tab 4: Measurement Requirements */}
      {activeTab === "measurements" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: "#23423a" }}>測量需求 (Measurement Requirements)</h3>
            <span style={{ fontSize: 12, color: "#66756d" }}>僅定義觀察方向，嚴禁事前假造題項信效度</span>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {workspace.measurementRequirements.map((m) => (
              <div key={m.measurementId} style={{ border: "1px solid #e6ede9", borderRadius: 10, padding: 14, background: "#fbfdfc" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <strong style={{ color: "#1f8a70" }}>{m.measurementId} · {m.metricLabel}</strong>
                    <span style={{ fontSize: 11, padding: "2px 6px", background: "#edf2ee", borderRadius: 4, marginLeft: 8 }}>
                      {m.measurementRole}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => handleToggleMeasurementLock(m.measurementId)}
                    style={{ fontSize: 12 }}
                  >
                    {m.isLocked ? "🔒 已鎖定" : "🔓 未鎖定"}
                  </button>
                </div>
                <div style={{ fontSize: 13, color: "#3a4a40", marginTop: 6 }}>
                  <strong>觀察方向：</strong>{m.sourceOrInstrumentDirection}
                </div>
                <div style={{ fontSize: 12, color: "#66756d", marginTop: 4 }}>
                  資料型態：{m.dataType} · 測量時點：{m.targetTimePointRefs.join(", ")} · 信效度要求：{m.validityReliabilityRequirements}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: RQ - Design - Data Matrix */}
      {activeTab === "matrix" && (
        <div>
          <h3 style={{ fontSize: 16, color: "#23423a", marginBottom: 12 }}>RQ–設計–資料–分析矩陣</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f4f7f5", borderBottom: "2px solid #dde6e0" }}>
                  <th style={{ padding: 10 }}>矩陣列 ID</th>
                  <th style={{ padding: 10 }}>對應 RQ</th>
                  <th style={{ padding: 10 }}>研究命題</th>
                  <th style={{ padding: 10 }}>分析單位</th>
                  <th style={{ padding: 10 }}>比較條件</th>
                  <th style={{ padding: 10 }}>規劃分析方法</th>
                  <th style={{ padding: 10 }}>狀態</th>
                </tr>
              </thead>
              <tbody>
                {workspace.matrixRows.map((row, idx) => (
                  <tr key={row.matrixRowId} style={{ borderBottom: "1px solid #eef1ef", background: idx % 2 === 0 ? "#fff" : "#fafcfb" }}>
                    <td style={{ padding: 10, fontWeight: 700, color: "#1f8a70" }}>{row.matrixRowId}</td>
                    <td style={{ padding: 10 }}>{row.rqRef}</td>
                    <td style={{ padding: 10 }}>{row.researchStatementRef}</td>
                    <td style={{ padding: 10 }}>{row.analysisUnit}</td>
                    <td style={{ padding: 10 }}>{row.comparatorSummary}</td>
                    <td style={{ padding: 10 }}>{row.plannedAnalysisMethod}</td>
                    <td style={{ padding: 10 }}>
                      <span style={{ padding: "2px 6px", background: "#e3f2ec", color: "#1f8a70", borderRadius: 4, fontSize: 11 }}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: Analysis Plan (Planning Mode) */}
      {activeTab === "analysisPlan" && (
        <div>
          <h3 style={{ fontSize: 16, color: "#23423a", marginBottom: 12 }}>分析實驗室 Planning Mode (Analysis Plan)</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {workspace.analysisPlans.map((ap) => (
              <div key={ap.analysisPlanId} style={{ border: "1px solid #e6ede9", borderRadius: 10, padding: 14, background: "#fbfdfc" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <strong style={{ color: "#1f8a70" }}>{ap.analysisPlanId} · {ap.analysisRole}</strong>
                    <span style={{ fontSize: 12, color: "#66756d", marginLeft: 8 }}>({ap.targetRqRef})</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => handleToggleAnalysisLock(ap.analysisPlanId)}
                      style={{ fontSize: 12 }}
                    >
                      {ap.isLocked ? "🔒 已鎖定" : "🔓 未鎖定"}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleAiRefineAnalysis(ap.analysisPlanId)}
                      disabled={ap.isLocked}
                      style={{ fontSize: 11 }}
                    >
                      老麥策略修訂
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: "#3a4a40", marginTop: 6 }}>
                  <strong>模型與分析策略：</strong>{ap.modelOrStrategy}
                </div>
                <div style={{ fontSize: 12, color: "#5b6b63", marginTop: 4 }}>
                  共變數：{ap.covariatesAndRationale.join(", ")} · 缺失值策略：{ap.missingDataHandlingStrategy}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 7: Issue Panel */}
      {activeTab === "issues" && (
        <div>
          <h3 style={{ fontSize: 16, color: "#23423a", marginBottom: 12 }}>研究設計與分析檢查清單 (RequirementIssuePanel)</h3>
          {logicFindings.length === 0 ? (
            <div style={{ background: "#e8f5e9", border: "1px solid #81c784", color: "#1b5e20", padding: 14, borderRadius: 10 }}>
              ✔ 研究設計與分析邏輯檢查全數通過！無阻擋完成之項目。
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {logicFindings.map((finding) => {
                const isFatal = finding.severity === "FATAL";
                return (
                  <div
                    key={finding.checkId}
                    style={{
                      border: `1px solid ${isFatal ? "#e57373" : "#ffb74d"}`,
                      background: isFatal ? "#ffebee" : "#fff8e1",
                      borderRadius: 10,
                      padding: 14,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            background: isFatal ? "#d32f2f" : "#f57c00",
                            color: "#fff",
                            marginRight: 6,
                          }}
                        >
                          {finding.severity}
                        </span>
                        <strong style={{ color: "#23423a", fontSize: 14 }}>{finding.findingDescription}</strong>
                      </div>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleNavigateToIssue(finding)}
                        style={{ fontSize: 12 }}
                      >
                        前往補足 →
                      </button>
                    </div>
                    <div style={{ fontSize: 13, color: "#4a5550", marginTop: 6 }}>
                      <strong>原因：</strong>{finding.rationale}
                    </div>
                    <div style={{ fontSize: 13, color: "#1f8a70", marginTop: 4 }}>
                      <strong>建議修正：</strong>{finding.suggestedAction}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
