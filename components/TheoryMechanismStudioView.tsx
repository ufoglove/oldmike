"use client";

/**
 * Theory and Mechanism Studio View (V3-U06-FULL)
 * Spec: docs/stage06/spec-v3-4.0.md §1, §3, §5, §6, §7, §8, §9, §10, §11, §12, §13, §14, §16, §17, §18, §21, §22, §24
 *
 * Implements:
 * 1. Seamless upgrade from Stage 5 handoff into full Theory & Mechanism workspace
 * 2. Tri-goal specific views (JOURNAL_SCI_SSCI, NSTC_GENERAL, MOE_TPR)
 * 3. 8 Modeling approaches selector & target scope brief
 * 4. Candidate Theory comparison & rationale-based selection
 * 5. Construct Dictionary (definitions, roles, inclusions/exclusions)
 * 6. Typed Model Relations & Mechanisms with alternative explanations
 * 7. Research Statements (H1, P1, GQ1) with falsification observations
 * 8. ModelToDesignRequirement Matrix (interface to Stage 7 Study Design)
 * 9. Alignment issue panel with direct navigation
 * 10. One-click completion to Stage 7 (study-design)
 */

import { useState } from "react";
import {
  type TheoryWorkspace,
  type TheoryLogicFinding,
  type ConstructDefinition,
  type ModelRelation,
  type ResearchStatement,
} from "@/lib/theory-mechanism-v3-contract";
import { type GapEvidenceSnapshot } from "@/lib/gap-novelty-v3-contract";
import { buildTheoryWorkspaceFromGapSnapshot, runTheoryMechanismLogicCheck } from "@/lib/theory-mechanism-v3-service";
import { RESEARCH_GOAL_DEFINITIONS } from "@/lib/research-goal-registry";

export default function TheoryMechanismStudioView({
  gapSnapshot,
  initialWorkspace,
  onReturnToGap,
  onNavigateToStage7,
}: {
  gapSnapshot: GapEvidenceSnapshot;
  initialWorkspace?: TheoryWorkspace;
  onReturnToGap?: () => void;
  onNavigateToStage7?: (handoffSnapshotId: string) => void;
}) {
  const [workspace, setWorkspace] = useState<TheoryWorkspace>(() => {
    if (initialWorkspace) return initialWorkspace;
    return buildTheoryWorkspaceFromGapSnapshot({
      workspaceId: `ws_tm_${gapSnapshot.projectId}`,
      projectId: gapSnapshot.projectId,
      gapSnapshot,
    });
  });

  const [activeTab, setActiveTab] = useState<"overview" | "theories" | "constructs" | "relations" | "statements" | "designMatrix" | "issues">("overview");
  const [logicFindings, setLogicFindings] = useState<TheoryLogicFinding[]>(() => runTheoryMechanismLogicCheck(workspace));
  const [completing, setCompleting] = useState(false);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [focusedFieldRef, setFocusedFieldRef] = useState<string | null>(null);

  const goalDef = RESEARCH_GOAL_DEFINITIONS[workspace.primaryGoal];

  const handleWorkspaceChange = (updater: (prev: TheoryWorkspace) => TheoryWorkspace) => {
    setWorkspace((prev) => {
      const next = updater(prev);
      setLogicFindings(runTheoryMechanismLogicCheck(next));
      return next;
    });
  };

  // Lock toggle on construct
  const handleToggleConstructLock = (constructId: string) => {
    handleWorkspaceChange((prev) => {
      const copy = JSON.parse(JSON.stringify(prev)) as TheoryWorkspace;
      const c = copy.constructs.find((item) => item.constructId === constructId);
      if (c) c.isLocked = !c.isLocked;
      return copy;
    });
  };

  // Lock toggle on relation
  const handleToggleRelationLock = (relationId: string) => {
    handleWorkspaceChange((prev) => {
      const copy = JSON.parse(JSON.stringify(prev)) as TheoryWorkspace;
      const r = copy.relations.find((item) => item.relationId === relationId);
      if (r) r.isLocked = !r.isLocked;
      return copy;
    });
  };

  // AI Assist: refine mechanism rationale
  const handleAiRefineMechanism = (relationId: string) => {
    handleWorkspaceChange((prev) => {
      const copy = JSON.parse(JSON.stringify(prev)) as TheoryWorkspace;
      const r = copy.relations.find((item) => item.relationId === relationId);
      if (r && !r.isLocked) {
        r.mechanismRationale = `${r.mechanismRationale}（老麥協作備註：本路徑推導基於情境認知鷹架假設，需於研究設計中設立對照組排除新奇感干擾）`;
        r.reviewState = "HUMAN_REVIEW_PENDING";
      }
      return copy;
    });
  };

  // Precise Navigation to Issue
  const handleNavigateToIssue = (finding: TheoryLogicFinding) => {
    if (finding.targetSection === "constructs") {
      setActiveTab("constructs");
    } else if (finding.targetSection === "relations") {
      setActiveTab("relations");
    } else if (finding.targetSection === "statements") {
      setActiveTab("statements");
    } else if (finding.targetSection.includes("Rationale")) {
      setActiveTab("overview");
    }
    setFocusedFieldRef(finding.targetFieldRef || null);
  };

  // Save Baseline and Complete to Stage 7 (study-design)
  const handleCompleteTheory = async () => {
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

      const res = await fetch(`/api/projects/${workspace.projectId}/theory-mechanism/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-workspace-id": workspace.workspaceId },
        body: JSON.stringify({ workspace, gapSnapshot }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "保存交接失敗");
      }

      setCompletionMessage("✔ 理論與機制規劃基線已完成保存！已成功向第七階段（研究設計與分析計畫）建立不可變交接。");
      if (onNavigateToStage7 && json.data?.snapshot?.snapshotId) {
        onNavigateToStage7(json.data.snapshot.snapshotId);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "完成理論規劃時發生錯誤");
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
              第六階段 · 理論與機制 (Theory & Mechanism)
            </span>
            <span style={{ background: "#f0f4f2", color: "#4d6156", padding: "2px 8px", borderRadius: 6, fontSize: 11 }}>
              主目標：{goalDef.labelZh}
            </span>
            <span style={{ background: "#ede7f6", color: "#512da8", padding: "2px 8px", borderRadius: 6, fontSize: 11 }}>
              模式：{workspace.modelingBrief.modelingApproach}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, color: "#23423a" }}>
            老麥 · 理論與機制規劃工作區
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#66756d" }}>
            專案：<code>{workspace.projectId}</code> · Gap 快照：<code>{workspace.sourceGapSnapshotId}</code> · 模型版本：rev{workspace.currentRevision}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {onReturnToGap && (
            <button type="button" className="secondary-button" onClick={onReturnToGap} style={{ fontSize: 13 }}>
              ← 返回文獻與 Gap
            </button>
          )}
          <button
            type="button"
            className="primary-button"
            onClick={handleCompleteTheory}
            disabled={completing || fatalCount > 0}
            style={{ fontSize: 13, background: fatalCount > 0 ? "#a0aba5" : "#1f8a70" }}
          >
            {completing ? "正在保存基線..." : fatalCount > 0 ? `尚缺 ${fatalCount} 項致命缺失` : "完成理論與機制，前進「研究設計與分析計畫」→"}
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
          1. 建模簡述與目標評述
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("theories")}
          style={{ padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontWeight: activeTab === "theories" ? 700 : 400, color: activeTab === "theories" ? "#1f8a70" : "#66756d", borderBottom: activeTab === "theories" ? "2px solid #1f8a70" : "none" }}
        >
          2. 候選理論與選擇
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("constructs")}
          style={{ padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontWeight: activeTab === "constructs" ? 700 : 400, color: activeTab === "constructs" ? "#1f8a70" : "#66756d", borderBottom: activeTab === "constructs" ? "2px solid #1f8a70" : "none" }}
        >
          3. 構念字典 ({workspace.constructs.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("relations")}
          style={{ padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontWeight: activeTab === "relations" ? 700 : 400, color: activeTab === "relations" ? "#1f8a70" : "#66756d", borderBottom: activeTab === "relations" ? "2px solid #1f8a70" : "none" }}
        >
          4. 關係模型與機制
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("statements")}
          style={{ padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontWeight: activeTab === "statements" ? 700 : 400, color: activeTab === "statements" ? "#1f8a70" : "#66756d", borderBottom: activeTab === "statements" ? "2px solid #1f8a70" : "none" }}
        >
          5. 假設與命題
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("designMatrix")}
          style={{ padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontWeight: activeTab === "designMatrix" ? 700 : 400, color: activeTab === "designMatrix" ? "#1f8a70" : "#66756d", borderBottom: activeTab === "designMatrix" ? "2px solid #1f8a70" : "none" }}
        >
          6. 研究設計需求矩陣
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
            <strong style={{ fontSize: 15, color: "#23423a" }}>建模範圍界定 (Modeling Brief)</strong>
            <p style={{ fontSize: 13, color: "#3a4a40", marginTop: 6, lineHeight: 1.6 }}>
              {workspace.modelingBrief.targetScopeExplanation}
            </p>
            <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: "#66756d" }}>
              <span>分析單位：<strong>{workspace.modelingBrief.unitOfAnalysis}</strong></span>
              <span>建模取徑：<strong>{workspace.modelingBrief.modelingApproach}</strong></span>
              <span>決策狀態：<strong>{workspace.decision}</strong></span>
            </div>
          </div>

          {workspace.primaryGoal === "JOURNAL_SCI_SSCI" && workspace.journalRationale && (
            <div style={{ background: "#fbfdfc", border: "1px solid #e6ede9", borderRadius: 12, padding: 16 }}>
              <h3 style={{ margin: "0 0 10px 0", color: "#1f8a70", fontSize: 15 }}>📘 國際期刊理論定位與辯護 (Journal Theory Rationale)</h3>
              <p style={{ fontSize: 13, color: "#3a4a40", margin: "4px 0" }}><strong>理論定位：</strong>{workspace.journalRationale.theoreticalPositioningAndGapResponse}</p>
              <p style={{ fontSize: 13, color: "#3a4a40", margin: "4px 0" }}><strong>相近研究區隔：</strong>{workspace.journalRationale.differentiationFromClosestStudies}</p>
              <p style={{ fontSize: 13, color: "#3a4a40", margin: "4px 0" }}><strong>機制辯護：</strong>{workspace.journalRationale.hypothesizedMechanismDefense}</p>
            </div>
          )}

          {workspace.primaryGoal === "NSTC_GENERAL" && workspace.nstcRationale && (
            <div style={{ background: "#fbfdfc", border: "1px solid #e6ede9", borderRadius: 12, padding: 16 }}>
              <h3 style={{ margin: "0 0 10px 0", color: "#b87000", fontSize: 15 }}>🏛️ 國科會科學問題與命題推導 (NSTC Theory Rationale)</h3>
              <p style={{ fontSize: 13, color: "#3a4a40", margin: "4px 0" }}><strong>科學問題：</strong>{workspace.nstcRationale.scientificProblemImportance}</p>
              <p style={{ fontSize: 13, color: "#3a4a40", margin: "4px 0" }}><strong>命題邏輯推導：</strong>{workspace.nstcRationale.logicalDerivationOfPropositions}</p>
            </div>
          )}

          {workspace.primaryGoal === "MOE_TPR" && workspace.moeTprRationale && (
            <div style={{ background: "#fbfdfc", border: "1px solid #e6ede9", borderRadius: 12, padding: 16 }}>
              <h3 style={{ margin: "0 0 10px 0", color: "#6a1b9a", fontSize: 15 }}>🎓 教育部教學實踐教學邏輯模型 (MOE TPR Logic Model)</h3>
              <p style={{ fontSize: 13, color: "#3a4a40", margin: "4px 0" }}><strong>現場問題：</strong>{workspace.moeTprRationale.classroomObservedProblem}</p>
              <p style={{ fontSize: 13, color: "#3a4a40", margin: "4px 0" }}><strong>教學介入活動：</strong>{workspace.moeTprRationale.instructionalInterventionActivity}</p>
              <p style={{ fontSize: 13, color: "#3a4a40", margin: "4px 0" }}><strong>學習機制（活動≠機制）：</strong>{workspace.moeTprRationale.expectedLearningMechanism}</p>
              <p style={{ fontSize: 12, color: "#e65100", margin: "4px 0" }}><strong>評量方向：</strong>{workspace.moeTprRationale.assessmentDirectionNotes}</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Theory Candidates */}
      {activeTab === "theories" && (
        <div>
          <h3 style={{ fontSize: 16, color: "#23423a", marginBottom: 12 }}>候選理論／框架池 (Theory Candidates)</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {workspace.theoryCandidates.map((th) => (
              <div key={th.candidateId} style={{ border: "1px solid #e6ede9", borderRadius: 10, padding: 14, background: "#fbfdfc" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong style={{ color: "#1f8a70", fontSize: 15 }}>{th.name}</strong>
                  <span style={{ fontSize: 12, padding: "2px 8px", background: th.selectionRole === "PRIMARY_LENS" ? "#e3f2ec" : "#edf2ee", color: th.selectionRole === "PRIMARY_LENS" ? "#1f8a70" : "#4d6156", borderRadius: 4 }}>
                    角色：{th.selectionRole}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "#3a4a40", marginTop: 6 }}>
                  <strong>核心命題：</strong>{th.corePropositions.join("；")}
                </div>
                <div style={{ fontSize: 13, color: "#5b6b63", marginTop: 4 }}>
                  <strong>適用解釋範圍：</strong>{th.explanatoryScope}
                </div>
                {th.selectionRationale && (
                  <div style={{ fontSize: 12, color: "#2e7d32", marginTop: 4 }}>
                    <strong>選用理由：</strong>{th.selectionRationale}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Construct Dictionary */}
      {activeTab === "constructs" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: "#23423a" }}>構念字典 (Construct Dictionary)</h3>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {workspace.constructs.map((c) => {
              const isHighlighted = focusedFieldRef === c.constructId;
              return (
                <div
                  key={c.constructId}
                  style={{
                    border: `1px solid ${isHighlighted ? "#fbc02d" : "#e6ede9"}`,
                    borderRadius: 10,
                    padding: 14,
                    background: isHighlighted ? "#fffde7" : "#fbfdfc",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ color: "#1f8a70", fontSize: 14 }}>{c.constructId} · {c.canonicalNameZh}</strong>
                      <span style={{ fontSize: 12, color: "#66756d", marginLeft: 8 }}>({c.canonicalNameEn})</span>
                      <span style={{ fontSize: 11, padding: "2px 6px", background: "#edf2ee", borderRadius: 4, marginLeft: 8 }}>
                        {c.roleInCurrentModel}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => handleToggleConstructLock(c.constructId)}
                      style={{ fontSize: 12 }}
                    >
                      {c.isLocked ? "🔒 已鎖定" : "🔓 未鎖定"}
                    </button>
                  </div>

                  <p style={{ fontSize: 13, color: "#23423a", marginTop: 8, lineHeight: 1.5 }}>
                    <strong>概念定義：</strong>{c.conceptualDefinition}
                  </p>

                  <div style={{ fontSize: 12, color: "#5b6b63", marginTop: 4 }}>
                    <strong>納入邊界：</strong>{c.scopeInclusions.join("、")} · <strong>排除範圍：</strong>{c.scopeExclusions.join("、")}
                  </div>
                  <div style={{ fontSize: 12, color: "#1f8a70", marginTop: 4 }}>
                    <strong>初步觀察方向：</strong>{c.provisionalObservationDirection}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 4: Typed Model Relations */}
      {activeTab === "relations" && (
        <div>
          <h3 style={{ fontSize: 16, color: "#23423a", marginBottom: 12 }}>關係模型與作用機制 (Model Relations & Mechanisms)</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {workspace.relations.map((r) => {
              const isHighlighted = focusedFieldRef === r.relationId;
              return (
                <div
                  key={r.relationId}
                  style={{
                    border: `1px solid ${isHighlighted ? "#fbc02d" : "#e6ede9"}`,
                    borderRadius: 10,
                    padding: 14,
                    background: isHighlighted ? "#fffde7" : "#fbfdfc",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ color: "#1f8a70", fontSize: 14 }}>{r.relationId} · {r.sourceConstructRef} ➔ {r.targetConstructRef}</strong>
                      <span style={{ fontSize: 11, padding: "2px 6px", background: "#e3f2ec", color: "#1f8a70", borderRadius: 4, marginLeft: 8 }}>
                        {r.relationType} ({r.expectedSign})
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => handleToggleRelationLock(r.relationId)}
                        style={{ fontSize: 12 }}
                      >
                        {r.isLocked ? "🔒 已鎖定" : "🔓 未鎖定"}
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleAiRefineMechanism(r.relationId)}
                        disabled={r.isLocked}
                        style={{ fontSize: 11 }}
                      >
                        老麥機制修訂
                      </button>
                    </div>
                  </div>

                  <p style={{ fontSize: 13, color: "#3a4a40", marginTop: 8, lineHeight: 1.5 }}>
                    <strong>作用機制詮釋：</strong>{r.mechanismRationale}
                  </p>

                  <div style={{ fontSize: 12, color: "#d32f2f", marginTop: 4 }}>
                    <strong>競爭與替代解釋：</strong>{r.alternativeExplanations.join("；") || "（未登錄）"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 5: Statements (Hypotheses / Propositions) */}
      {activeTab === "statements" && (
        <div>
          <h3 style={{ fontSize: 16, color: "#23423a", marginBottom: 12 }}>研究命題與假設 (Research Statements)</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {workspace.statements.map((st) => (
              <div key={st.statementId} style={{ border: "1px solid #e6ede9", borderRadius: 10, padding: 14, background: "#fbfdfc" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong style={{ color: "#1f8a70" }}>{st.stableLabel} ({st.statementType})</strong>
                  <span style={{ fontSize: 12, padding: "2px 8px", background: "#edf2ee", borderRadius: 4 }}>
                    時點：{st.temporalStatus} · {st.dataExposureStatus}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "#23423a", marginTop: 8, lineHeight: 1.5 }}>
                  {st.statementText}
                </p>
                <div style={{ fontSize: 12, color: "#d32f2f", marginTop: 6 }}>
                  <strong>何種觀察將不予支持（Disconfirmation）：</strong>{st.disconfirmationDirection}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 6: Design Requirement Matrix */}
      {activeTab === "designMatrix" && (
        <div>
          <h3 style={{ fontSize: 16, color: "#23423a", marginBottom: 12 }}>研究設計需求矩陣 (Interface to Stage 7 Study Design)</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {workspace.designRequirements.map((d) => (
              <div key={d.requirementId} style={{ border: "1px solid #e6ede9", borderRadius: 10, padding: 14, background: "#fbfdfc" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong style={{ color: "#1f8a70" }}>{d.requirementId} · 對應 {d.statementRef} ({d.rqRef})</strong>
                  <span style={{ fontSize: 12, color: "#66756d" }}>到期階段：{d.duePhase}</span>
                </div>
                <div style={{ fontSize: 13, color: "#3a4a40", marginTop: 6 }}>
                  <strong>觀察資料需求：</strong>{d.observationalRequirement}
                </div>
                <div style={{ fontSize: 12, color: "#5b6b63", marginTop: 4 }}>
                  <strong>對照組需求：</strong>{d.comparisonNeed} · <strong>時間時點需求：</strong>{d.temporalNeed}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 7: Issue Panel */}
      {activeTab === "issues" && (
        <div>
          <h3 style={{ fontSize: 16, color: "#23423a", marginBottom: 12 }}>理論與機制一致性檢查清單 (RequirementIssuePanel)</h3>
          {logicFindings.length === 0 ? (
            <div style={{ background: "#e8f5e9", border: "1px solid #81c784", color: "#1b5e20", padding: 14, borderRadius: 10 }}>
              ✔ 理論與機制邏輯檢查全數通過！無阻擋完成之項目。
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
