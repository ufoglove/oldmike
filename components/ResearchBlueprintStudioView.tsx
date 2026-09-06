"use client";

/**
 * Research Blueprint Workspace Component (V3-U04-FULL)
 * Spec: v3.4.0 §6, §7, §8, §9, §13, §14, §15, §17, §18, §20
 *
 * Upgrades the Stage 3 handoff receiver into a full, interactive Research Blueprint
 * workspace supporting:
 * 1. Tri-goal distinct views (JOURNAL_SCI_SSCI, NSTC_GENERAL, MOE_TPR)
 * 2. Objective - RQ - Evidence Planning Matrix
 * 3. Work package DAG schedule & Resource assumptions
 * 4. Directed EvidenceNeeds linked to existing literature center
 * 5. Field locking & Old Mike AI Assist actions
 * 6. Issue panel with precise navigation to missing fields
 * 7. One-click completion & immutable handoff to Stage 5 (gap-novelty)
 */

import { useState } from "react";
import { type SubmissionNavigationSnapshot } from "@/lib/submission-navigation-engines-contract";
import {
  type BlueprintWorkspace,
  type BlueprintLogicFinding,
  type RqPlanningRow,
  type WorkPackagePlan,
} from "@/lib/blueprint-planning-contract";
import { buildBlueprintWorkspaceFromNavigation, runBlueprintLogicCheck } from "@/lib/blueprint-builder-service";
import { RESEARCH_GOAL_DEFINITIONS } from "@/lib/research-goal-registry";

export default function ResearchBlueprintStudioView({
  snapshot,
  initialWorkspace,
  onReturnToNavigator,
  onNavigateToStage5,
}: {
  snapshot: SubmissionNavigationSnapshot;
  initialWorkspace?: BlueprintWorkspace;
  onReturnToNavigator?: () => void;
  onNavigateToStage5?: (handoffSnapshotId: string) => void;
}) {
  const [workspace, setWorkspace] = useState<BlueprintWorkspace>(() => {
    if (initialWorkspace) return initialWorkspace;
    return buildBlueprintWorkspaceFromNavigation({
      workspaceId: snapshot.workspaceId,
      projectId: snapshot.projectId,
      navigationSnapshot: snapshot,
    });
  });

  const [activeTab, setActiveTab] = useState<"overview" | "matrix" | "routeSpecific" | "workPackages" | "evidence" | "issues">("overview");
  const [logicFindings, setLogicFindings] = useState<BlueprintLogicFinding[]>(() => runBlueprintLogicCheck(workspace));
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [focusedFieldRef, setFocusedFieldRef] = useState<string | null>(null);

  const goalDef = RESEARCH_GOAL_DEFINITIONS[workspace.primaryGoal];

  // Re-run logic checks whenever workspace changes
  const handleWorkspaceChange = (updater: (prev: BlueprintWorkspace) => BlueprintWorkspace) => {
    setWorkspace((prev) => {
      const next = updater(prev);
      setLogicFindings(runBlueprintLogicCheck(next));
      return next;
    });
  };

  // Toggle field lock state
  const handleToggleLock = (sectionKey: string, fieldKey: string) => {
    handleWorkspaceChange((prev) => {
      const copy = JSON.parse(JSON.stringify(prev)) as any;
      if (copy[sectionKey] && copy[sectionKey][fieldKey]) {
        const field = copy[sectionKey][fieldKey];
        field.isLocked = !field.isLocked;
        field.lockPolicy = field.isLocked ? "MANUAL" : undefined;
        field.lockVersion = field.isLocked ? (field.lockVersion || 0) + 1 : undefined;
      }
      return copy;
    });
  };

  // AI Assist: fill empty / improve unlocked draft
  const handleAiAssistDraft = (sectionKey: string, fieldKey: string, promptHint?: string) => {
    handleWorkspaceChange((prev) => {
      const copy = JSON.parse(JSON.stringify(prev)) as any;
      if (copy[sectionKey] && copy[sectionKey][fieldKey]) {
        const field = copy[sectionKey][fieldKey];
        if (field.isLocked) return prev; // Never overwrite locked fields!
        field.origin = "GENERATED_DRAFT";
        field.reviewState = "HUMAN_REVIEW_PENDING";
        field.fieldRevision = (field.fieldRevision || 1) + 1;
        field.lastModifiedAt = new Date().toISOString();
        if (promptHint) {
          field.value = `${field.value}（老麥協作建議：${promptHint}）`;
        }
      }
      return copy;
    });
  };

  // Precise Navigation to Issue field
  const handleNavigateToIssue = (finding: BlueprintLogicFinding) => {
    if (finding.targetSection === "researchQuestionsMatrix") {
      setActiveTab("matrix");
    } else if (finding.targetSection === "workPackages") {
      setActiveTab("workPackages");
    } else if (finding.targetSection.includes("Blueprint")) {
      setActiveTab("routeSpecific");
    }
    setFocusedFieldRef(finding.targetFieldRef || null);
  };

  // Save Baseline and Complete to Stage 5
  const handleCompleteBlueprint = async () => {
    setCompleting(true);
    setErrorMessage(null);
    setCompletionMessage(null);

    try {
      const fatalIssues = logicFindings.filter((f) => f.severity === "FATAL");
      if (fatalIssues.length > 0) {
        setErrorMessage("存在阻擋完成的致命問題（FATAL），請依下方缺失清單前往補足。");
        setActiveTab("issues");
        setCompleting(false);
        return;
      }

      const res = await fetch(`/api/projects/${workspace.projectId}/blueprint/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-workspace-id": workspace.workspaceId },
        body: JSON.stringify({ workspace, decisionOrigin: "USER_MANUAL_ADOPTION" }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "保存交接失敗");
      }

      setCompletionMessage("✔ 研究藍圖規劃基線已完成保存！已成功向第五階段（文獻深化與Gap驗證）建立交接。");
      if (onNavigateToStage5 && json.data?.snapshot?.snapshotId) {
        onNavigateToStage5(json.data.snapshot.snapshotId);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "完成藍圖時發生錯誤");
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
              第四階段 · 研究藍圖與研究規劃
            </span>
            <span style={{ background: "#f0f4f2", color: "#4d6156", padding: "2px 8px", borderRadius: 6, fontSize: 11 }}>
              主目標：{goalDef.labelZh}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, color: "#23423a" }}>
            老麥 · 研究藍圖規劃工作區
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#66756d" }}>
            專案：<code>{workspace.projectId}</code> · 基準來源：<code>{workspace.sourceNavigationSnapshotId}</code> · 規劃版本：v{workspace.currentRevision}.0
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {onReturnToNavigator && (
            <button type="button" className="secondary-button" onClick={onReturnToNavigator} style={{ fontSize: 13 }}>
              ← 返回投稿導航
            </button>
          )}
          <button
            type="button"
            className="primary-button"
            onClick={handleCompleteBlueprint}
            disabled={completing || fatalCount > 0}
            style={{ fontSize: 13, background: fatalCount > 0 ? "#a0aba5" : "#1f8a70" }}
          >
            {completing ? "正在保存基線..." : fatalCount > 0 ? `尚缺 ${fatalCount} 項致命缺失` : "完成研究藍圖，前進「文獻深化與Gap驗證」→"}
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
          1. 總覽與核心問題
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("matrix")}
          style={{ padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontWeight: activeTab === "matrix" ? 700 : 400, color: activeTab === "matrix" ? "#1f8a70" : "#66756d", borderBottom: activeTab === "matrix" ? "2px solid #1f8a70" : "none" }}
        >
          2. Objective–RQ 規劃矩陣
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("routeSpecific")}
          style={{ padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontWeight: activeTab === "routeSpecific" ? 700 : 400, color: activeTab === "routeSpecific" ? "#1f8a70" : "#66756d", borderBottom: activeTab === "routeSpecific" ? "2px solid #1f8a70" : "none" }}
        >
          3. 三目標專屬規劃
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("workPackages")}
          style={{ padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontWeight: activeTab === "workPackages" ? 700 : 400, color: activeTab === "workPackages" ? "#1f8a70" : "#66756d", borderBottom: activeTab === "workPackages" ? "2px solid #1f8a70" : "none" }}
        >
          4. 工作包與期程 (DAG)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("evidence")}
          style={{ padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontWeight: activeTab === "evidence" ? 700 : 400, color: activeTab === "evidence" ? "#1f8a70" : "#66756d", borderBottom: activeTab === "evidence" ? "2px solid #1f8a70" : "none" }}
        >
          5. 證據需求 (EvidenceNeeds)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("issues")}
          style={{ padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontWeight: activeTab === "issues" ? 700 : 400, color: fatalCount > 0 ? "#d32f2f" : activeTab === "issues" ? "#1f8a70" : "#66756d", borderBottom: activeTab === "issues" ? "2px solid #1f8a70" : "none" }}
        >
          6. 檢查與缺失 ({fatalCount + warningCount})
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div>
          <div style={{ background: "#fbfdfc", border: "1px solid #e6ede9", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <strong style={{ fontSize: 15, color: "#23423a" }}>研究工作題目（中文）</strong>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => handleToggleLock("researchIdentity", "workingTitleZh")}
                  style={{ fontSize: 12 }}
                >
                  {workspace.researchIdentity.workingTitleZh.isLocked ? "🔒 已鎖定" : "🔓 未鎖定"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => handleAiAssistDraft("researchIdentity", "workingTitleZh", "強化具體受試對象與場域修飾")}
                  disabled={workspace.researchIdentity.workingTitleZh.isLocked}
                  style={{ fontSize: 11 }}
                >
                  老麥一鍵起草
                </button>
              </div>
            </div>
            <textarea
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccd8d1", fontSize: 14 }}
              rows={2}
              value={workspace.researchIdentity.workingTitleZh.value}
              disabled={workspace.researchIdentity.workingTitleZh.isLocked}
              onChange={(e) => {
                const val = e.target.value;
                handleWorkspaceChange((prev) => {
                  const copy = JSON.parse(JSON.stringify(prev));
                  copy.researchIdentity.workingTitleZh.value = val;
                  return copy;
                });
              }}
            />
          </div>

          <div style={{ background: "#fbfdfc", border: "1px solid #e6ede9", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <strong style={{ fontSize: 15, color: "#23423a" }}>核心問題與重要性 (Core Problem & Scope)</strong>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => handleToggleLock("coreProblemAndScope", "problemStatement")}
                  style={{ fontSize: 12 }}
                >
                  {workspace.coreProblemAndScope.problemStatement.isLocked ? "🔒 已鎖定" : "🔓 未鎖定"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => handleAiAssistDraft("coreProblemAndScope", "problemStatement", "補充情境急迫性與產業現況")}
                  disabled={workspace.coreProblemAndScope.problemStatement.isLocked}
                  style={{ fontSize: 11 }}
                >
                  老麥補充情境
                </button>
              </div>
            </div>
            <textarea
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccd8d1", fontSize: 13 }}
              rows={3}
              value={workspace.coreProblemAndScope.problemStatement.value}
              disabled={workspace.coreProblemAndScope.problemStatement.isLocked}
              onChange={(e) => {
                const val = e.target.value;
                handleWorkspaceChange((prev) => {
                  const copy = JSON.parse(JSON.stringify(prev));
                  copy.coreProblemAndScope.problemStatement.value = val;
                  return copy;
                });
              }}
            />
          </div>
        </div>
      )}

      {/* Tab 2: Objective - RQ Matrix */}
      {activeTab === "matrix" && (
        <div>
          <h3 style={{ fontSize: 16, color: "#23423a", marginBottom: 12 }}>Objective–RQ–Evidence 規劃矩陣</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f4f7f5", borderBottom: "2px solid #dde6e0" }}>
                  <th style={{ padding: 10 }}>RQ ID</th>
                  <th style={{ padding: 10 }}>對應 Objective</th>
                  <th style={{ padding: 10 }}>研究問題</th>
                  <th style={{ padding: 10 }}>問題類型</th>
                  <th style={{ padding: 10 }}>分析單位</th>
                  <th style={{ padding: 10 }}>初步方法方向</th>
                  <th style={{ padding: 10 }}>關聯工作包</th>
                </tr>
              </thead>
              <tbody>
                {workspace.researchQuestionsMatrix.map((rq, idx) => {
                  const isHighlighted = focusedFieldRef === rq.rqId;
                  return (
                    <tr
                      key={rq.rqId}
                      style={{
                        borderBottom: "1px solid #eef1ef",
                        background: isHighlighted ? "#fff9c4" : idx % 2 === 0 ? "#fff" : "#fafcfb",
                      }}
                    >
                      <td style={{ padding: 10, fontWeight: 700, color: "#1f8a70" }}>{rq.rqId}</td>
                      <td style={{ padding: 10 }}>
                        <select
                          value={rq.objectiveId}
                          onChange={(e) => {
                            const newObj = e.target.value;
                            handleWorkspaceChange((prev) => {
                              const copy = JSON.parse(JSON.stringify(prev)) as BlueprintWorkspace;
                              copy.researchQuestionsMatrix[idx].objectiveId = newObj;
                              return copy;
                            });
                          }}
                          style={{ padding: 4, borderRadius: 4, border: "1px solid #ccd8d1", fontSize: 12 }}
                        >
                          {workspace.purposeAndObjectives.objectives.map((o) => (
                            <option key={o.objectiveId} value={o.objectiveId}>
                              {o.objectiveId}
                            </option>
                          ))}
                          <option value="OBJ_UNKNOWN">（無對應·待補）</option>
                        </select>
                      </td>
                      <td style={{ padding: 10, minWidth: 200 }}>{rq.questionText}</td>
                      <td style={{ padding: 10 }}>
                        <span style={{ padding: "2px 6px", background: "#edf2ee", borderRadius: 4, fontSize: 11 }}>
                          {rq.rqType}
                        </span>
                      </td>
                      <td style={{ padding: 10 }}>{rq.unitOfAnalysis}</td>
                      <td style={{ padding: 10 }}>{rq.preliminaryMethodDirection}</td>
                      <td style={{ padding: 10 }}>{rq.associatedWorkPackageIds.join(", ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Route Specific Blueprint */}
      {activeTab === "routeSpecific" && (
        <div>
          {workspace.primaryGoal === "JOURNAL_SCI_SSCI" && workspace.journalBlueprint && (
            <div style={{ background: "#fbfdfc", border: "1px solid #e6ede9", borderRadius: 12, padding: 16 }}>
              <h3 style={{ margin: "0 0 12px 0", color: "#1f8a70", fontSize: 16 }}>📘 SCI / SSCI 國際期刊專屬藍圖</h3>
              <div style={{ marginBottom: 12, fontSize: 13 }}>
                <strong>目標期刊：</strong>{workspace.journalBlueprint.targetJournalName}
              </div>
              <div style={{ marginBottom: 12, fontSize: 13 }}>
                <strong>資料與結果需求（事前規劃）：</strong>
                <ul style={{ margin: "6px 0 0 20px" }}>
                  <li>Introduction：{workspace.journalBlueprint.dataAndResultsRequirements.evidenceNeededPerSection.Introduction}</li>
                  <li>Methods：{workspace.journalBlueprint.dataAndResultsRequirements.evidenceNeededPerSection.Methods}</li>
                  <li>Results：<span style={{ color: "#d32f2f" }}>{workspace.journalBlueprint.dataAndResultsRequirements.evidenceNeededPerSection.Results}</span></li>
                  <li>Discussion：{workspace.journalBlueprint.dataAndResultsRequirements.evidenceNeededPerSection.Discussion}</li>
                </ul>
              </div>
            </div>
          )}

          {workspace.primaryGoal === "NSTC_GENERAL" && workspace.nstcBlueprint && (
            <div style={{ background: "#fbfdfc", border: "1px solid #e6ede9", borderRadius: 12, padding: 16 }}>
              <h3 style={{ margin: "0 0 12px 0", color: "#b87000", fontSize: 16 }}>🏛️ 國科會一般研究計畫專屬藍圖</h3>
              <div style={{ marginBottom: 12, fontSize: 13 }}>
                <strong>學門代碼：</strong>{workspace.nstcBlueprint.disciplineCode} · {workspace.nstcBlueprint.disciplineName}
              </div>
              <div style={{ marginBottom: 12, fontSize: 13 }}>
                <strong>計畫年限設定：</strong>{workspace.nstcBlueprint.projectDuration.durationOption}（不強制三年）
              </div>
              <div style={{ marginBottom: 12, fontSize: 13 }}>
                <strong>科學重要性：</strong>{workspace.nstcBlueprint.scientificQuestionImportance}
              </div>
            </div>
          )}

          {workspace.primaryGoal === "MOE_TPR" && workspace.moeTprBlueprint && (
            <div style={{ background: "#fbfdfc", border: "1px solid #e6ede9", borderRadius: 12, padding: 16 }}>
              <h3 style={{ margin: "0 0 12px 0", color: "#6a1b9a", fontSize: 16 }}>🎓 教育部教學實踐研究計畫專屬藍圖</h3>
              <div style={{ marginBottom: 12, fontSize: 13 }}>
                <strong>課程資訊狀態：</strong>
                <span style={{ color: workspace.moeTprBlueprint.courseIdentity.courseInfoStatus === "UNKNOWN" ? "#e65100" : "#2e7d32", fontWeight: 700 }}>
                  {workspace.moeTprBlueprint.courseIdentity.courseInfoStatus === "UNKNOWN" ? "UNKNOWN（待補課程授權資料）" : "USER_PROVIDED"}
                </span>
              </div>
              <div style={{ marginBottom: 12, fontSize: 13 }}>
                <strong>課程名稱：</strong>{workspace.moeTprBlueprint.courseIdentity.courseName}
              </div>
              <div style={{ marginBottom: 12, fontSize: 13 }}>
                <strong>教學評量規劃：</strong>{workspace.moeTprBlueprint.learningOutcomesAndAssessment.assessmentMethods.join("、")}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Work Packages (DAG) */}
      {activeTab === "workPackages" && (
        <div>
          <h3 style={{ fontSize: 16, color: "#23423a", marginBottom: 12 }}>工作包、期程與 DAG 依賴檢查</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {workspace.workPackages.map((wp) => (
              <div key={wp.packageId} style={{ border: "1px solid #e6ede9", borderRadius: 10, padding: 14, background: "#fbfdfc" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong style={{ color: "#1f8a70" }}>{wp.packageId}：{wp.title}</strong>
                  <span style={{ fontSize: 12, color: "#66756d" }}>期間：{wp.estimatedRelativeDuration}</span>
                </div>
                <div style={{ fontSize: 13, color: "#3a4a40", marginTop: 6 }}>
                  前置依賴（Dependencies）：{wp.dependencies.length > 0 ? wp.dependencies.join(", ") : "（無，作為起點）"}
                </div>
                <div style={{ fontSize: 13, color: "#5b6b63", marginTop: 4 }}>
                  驗收標準：{wp.acceptanceCriteria}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Evidence Needs */}
      {activeTab === "evidence" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: "#23423a" }}>定向證據需求 (EvidenceNeeds)</h3>
            <span style={{ fontSize: 12, color: "#66756d" }}>將直接交接給 Stage 5 文獻與證據中心</span>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {workspace.evidenceNeeds.map((need) => (
              <div key={need.needId} style={{ border: "1px solid #e6ede9", borderRadius: 10, padding: 14, background: "#fbfdfc" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong style={{ color: "#1f8a70" }}>{need.needId} · 角色：{need.role}</strong>
                  <span style={{ fontSize: 12, padding: "2px 8px", background: "#edf2ee", borderRadius: 4 }}>
                    預算上限：{need.retrievalBudgetCap} 篇
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "#3a4a40", marginTop: 6 }}>
                  <strong>驗證目的：</strong>{need.purpose}
                </div>
                <div style={{ fontSize: 13, color: "#5b6b63", marginTop: 4 }}>
                  <strong>檢索關鍵字：</strong>{need.keywordGroups.map((g) => g.join("+")).join(" | ")}
                </div>
                <div style={{ fontSize: 12, color: "#8a9990", marginTop: 4 }}>
                  偏好資料源：{need.sourcePreferences.join(", ")} · 驗收依據：{need.acceptanceCriteria}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 6: Issues Panel */}
      {activeTab === "issues" && (
        <div>
          <h3 style={{ fontSize: 16, color: "#23423a", marginBottom: 12 }}>藍圖規劃檢查與缺失導航 (RequirementIssuePanel)</h3>
          {logicFindings.length === 0 ? (
            <div style={{ background: "#e8f5e9", border: "1px solid #81c784", color: "#1b5e20", padding: 14, borderRadius: 10 }}>
              ✔ 藍圖邏輯檢查全數通過！無阻擋完成之項目。
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
