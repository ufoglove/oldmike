"use client";

/**
 * Literature Deepening and Gap / Novelty Studio View (V3-U05-FULL)
 * Spec: docs/stage05/spec-v3-4.0.md §1, §3, §5, §6, §7, §8, §10, §11, §12, §13, §14, §15, §17, §18, §21, §22, §24
 *
 * Implements:
 * 1. Seamless upgrade from Stage 4 handoff receiver into full Gap & Novelty workspace
 * 2. Tri-goal specific views (JOURNAL_SCI_SSCI, NSTC_GENERAL, MOE_TPR)
 * 3. ReviewScope & Search Tasks with real query logs and provider statuses
 * 4. Closest Study Matrix & Contribution Delta (inspecting superficial technology-piling)
 * 5. Gap Claims with supporting & counterevidence tracking
 * 6. Issue Panel with precise navigation and one-click Old Mike assist
 * 7. One-click completion to Stage 6 (theory-mechanism)
 */

import { useState } from "react";
import {
  type GapReviewWorkspace,
  type GapLogicFinding,
  type GapClaim,
  type ClosestStudyItem,
  type ContributionDeltaRow,
} from "@/lib/gap-novelty-v3-contract";
import { type BlueprintPlanningSnapshot } from "@/lib/blueprint-planning-contract";
import { buildGapReviewWorkspaceFromBlueprint, runGapNoveltyLogicCheck } from "@/lib/gap-novelty-v3-service";
import { RESEARCH_GOAL_DEFINITIONS } from "@/lib/research-goal-registry";

export default function GapNoveltyStudioView({
  blueprintSnapshot,
  initialWorkspace,
  onReturnToBlueprint,
  onNavigateToStage6,
}: {
  blueprintSnapshot: BlueprintPlanningSnapshot;
  initialWorkspace?: GapReviewWorkspace;
  onReturnToBlueprint?: () => void;
  onNavigateToStage6?: (handoffSnapshotId: string) => void;
}) {
  const [workspace, setWorkspace] = useState<GapReviewWorkspace>(() => {
    if (initialWorkspace) return initialWorkspace;
    return buildGapReviewWorkspaceFromBlueprint({
      workspaceId: blueprintSnapshot.workspaceId,
      projectId: blueprintSnapshot.projectId,
      blueprintSnapshot,
    });
  });

  const [activeTab, setActiveTab] = useState<"overview" | "searchLog" | "gapMap" | "closestStudies" | "delta" | "issues">("overview");
  const [logicFindings, setLogicFindings] = useState<GapLogicFinding[]>(() => runGapNoveltyLogicCheck(workspace));
  const [completing, setCompleting] = useState(false);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [focusedFieldRef, setFocusedFieldRef] = useState<string | null>(null);

  const goalDef = RESEARCH_GOAL_DEFINITIONS[workspace.primaryGoal];

  const handleWorkspaceChange = (updater: (prev: GapReviewWorkspace) => GapReviewWorkspace) => {
    setWorkspace((prev) => {
      const next = updater(prev);
      setLogicFindings(runGapNoveltyLogicCheck(next));
      return next;
    });
  };

  // Toggle lock on Gap Claim
  const handleToggleClaimLock = (claimId: string) => {
    handleWorkspaceChange((prev) => {
      const copy = JSON.parse(JSON.stringify(prev)) as GapReviewWorkspace;
      const claim = copy.gapClaims.find((c) => c.claimId === claimId);
      if (claim) {
        claim.isLocked = !claim.isLocked;
        claim.lockPolicy = claim.isLocked ? "MANUAL" : undefined;
      }
      return copy;
    });
  };

  // Old Mike AI Assist: refine claim text without faking evidence
  const handleAiRefineClaim = (claimId: string) => {
    handleWorkspaceChange((prev) => {
      const copy = JSON.parse(JSON.stringify(prev)) as GapReviewWorkspace;
      const claim = copy.gapClaims.find((c) => c.claimId === claimId);
      if (claim && !claim.isLocked) {
        claim.claimText = `${claim.claimText}（老麥協作備註：於本次界定之檢索範圍中，尚缺乏長期成效之客觀追蹤數據，需保留邊界限制）`;
        claim.reviewState = "HUMAN_REVIEW_PENDING";
      }
      return copy;
    });
  };

  // Precise Navigation to Issue
  const handleNavigateToIssue = (finding: GapLogicFinding) => {
    if (finding.targetSection === "gapClaims") {
      setActiveTab("gapMap");
    } else if (finding.targetSection === "closestStudies") {
      setActiveTab("closestStudies");
    } else if (finding.targetSection === "contributionDeltas") {
      setActiveTab("delta");
    } else if (finding.targetSection.includes("Synthesis")) {
      setActiveTab("overview");
    }
    setFocusedFieldRef(finding.targetFieldRef || null);
  };

  // Save Baseline and Complete to Stage 6 (theory-mechanism)
  const handleCompleteGapReview = async () => {
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

      const res = await fetch(`/api/projects/${workspace.projectId}/gap-novelty/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-workspace-id": workspace.workspaceId },
        body: JSON.stringify({ workspace, blueprintSnapshot }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "保存交接失敗");
      }

      setCompletionMessage("✔ 文獻深化與 Gap／新穎性評估基線已完成保存！已成功向第六階段（理論與機制）建立不可變交接。");
      if (onNavigateToStage6 && json.data?.snapshot?.snapshotId) {
        onNavigateToStage6(json.data.snapshot.snapshotId);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "完成評估時發生錯誤");
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
              第五階段 · 文獻深化與 Gap／新穎性驗證
            </span>
            <span style={{ background: "#f0f4f2", color: "#4d6156", padding: "2px 8px", borderRadius: 6, fontSize: 11 }}>
              主目標：{goalDef.labelZh}
            </span>
            <span style={{ background: "#fff8e1", color: "#b87000", padding: "2px 8px", borderRadius: 6, fontSize: 11 }}>
              決策：{workspace.overallDecision}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, color: "#23423a" }}>
            老麥 · 文獻深化與 Gap／新穎性評估工作區
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#66756d" }}>
            專案：<code>{workspace.projectId}</code> · 藍圖快照：<code>{workspace.sourceBlueprintSnapshotId}</code> · 評估修訂：rev{workspace.currentRevision}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {onReturnToBlueprint && (
            <button type="button" className="secondary-button" onClick={onReturnToBlueprint} style={{ fontSize: 13 }}>
              ← 返回研究藍圖
            </button>
          )}
          <button
            type="button"
            className="primary-button"
            onClick={handleCompleteGapReview}
            disabled={completing || fatalCount > 0}
            style={{ fontSize: 13, background: fatalCount > 0 ? "#a0aba5" : "#1f8a70" }}
          >
            {completing ? "正在保存基線..." : fatalCount > 0 ? `尚缺 ${fatalCount} 項致命缺失` : "完成文獻與Gap驗證，前進「理論與機制」→"}
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
          1. 總覽與三目標決策
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("searchLog")}
          style={{ padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontWeight: activeTab === "searchLog" ? 700 : 400, color: activeTab === "searchLog" ? "#1f8a70" : "#66756d", borderBottom: activeTab === "searchLog" ? "2px solid #1f8a70" : "none" }}
        >
          2. 檢索計畫與 Search Log
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("gapMap")}
          style={{ padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontWeight: activeTab === "gapMap" ? 700 : 400, color: activeTab === "gapMap" ? "#1f8a70" : "#66756d", borderBottom: activeTab === "gapMap" ? "2px solid #1f8a70" : "none" }}
        >
          3. Gap Claims 與反證
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("closestStudies")}
          style={{ padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontWeight: activeTab === "closestStudies" ? 700 : 400, color: activeTab === "closestStudies" ? "#1f8a70" : "#66756d", borderBottom: activeTab === "closestStudies" ? "2px solid #1f8a70" : "none" }}
        >
          4. 最相近研究矩陣
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("delta")}
          style={{ padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontWeight: activeTab === "delta" ? 700 : 400, color: activeTab === "delta" ? "#1f8a70" : "#66756d", borderBottom: activeTab === "delta" ? "2px solid #1f8a70" : "none" }}
        >
          5. Contribution Delta (實質差異)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("issues")}
          style={{ padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontWeight: activeTab === "issues" ? 700 : 400, color: fatalCount > 0 ? "#d32f2f" : activeTab === "issues" ? "#1f8a70" : "#66756d", borderBottom: activeTab === "issues" ? "2px solid #1f8a70" : "none" }}
        >
          6. 檢查與缺失 ({fatalCount + warningCount})
        </button>
      </div>

      {/* Tab 1: Overview & Goal Synthesis */}
      {activeTab === "overview" && (
        <div>
          <div style={{ background: "#fbfdfc", border: "1px solid #e6ede9", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <strong style={{ fontSize: 15, color: "#23423a" }}>本輪研究評估決策：{workspace.overallDecision}</strong>
            <p style={{ fontSize: 13, color: "#3a4a40", marginTop: 6, lineHeight: 1.6 }}>
              {workspace.decisionRationale}
            </p>
            <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12, color: "#66756d" }}>
              <span>證據充分度：<strong>{workspace.evidenceSufficiency}</strong></span>
              <span>新穎性評估：<strong>{workspace.noveltyAssessment}</strong></span>
              <span>文獻總筆數：<strong>{workspace.literatureIds.length} 篇</strong></span>
            </div>
          </div>

          {/* Route Specific Synthesis Display */}
          {workspace.primaryGoal === "JOURNAL_SCI_SSCI" && workspace.journalSynthesis && (
            <div style={{ background: "#fbfdfc", border: "1px solid #e6ede9", borderRadius: 12, padding: 16 }}>
              <h3 style={{ margin: "0 0 10px 0", color: "#1f8a70", fontSize: 15 }}>📘 國際期刊差異化判讀 (Journal Evidence Synthesis)</h3>
              <p style={{ fontSize: 13, color: "#3a4a40", margin: "4px 0" }}><strong>國際文獻版圖：</strong>{workspace.journalSynthesis.internationalLiteratureLandscape}</p>
              <p style={{ fontSize: 13, color: "#3a4a40", margin: "4px 0" }}><strong>可辯護之理論貢獻：</strong>{workspace.journalSynthesis.defensibleTheoreticalContribution}</p>
            </div>
          )}

          {workspace.primaryGoal === "NSTC_GENERAL" && workspace.nstcSynthesis && (
            <div style={{ background: "#fbfdfc", border: "1px solid #e6ede9", borderRadius: 12, padding: 16 }}>
              <h3 style={{ margin: "0 0 10px 0", color: "#b87000", fontSize: 15 }}>🏛️ 國科會科學問題與創新判讀 (NSTC Synthesis)</h3>
              <p style={{ fontSize: 13, color: "#3a4a40", margin: "4px 0" }}><strong>科學問題重要性：</strong>{workspace.nstcSynthesis.scientificProblemImportance}</p>
              <p style={{ fontSize: 13, color: "#3a4a40", margin: "4px 0" }}><strong>與國內外創新比較：</strong>{workspace.nstcSynthesis.noveltyComparedToDomesticAndGlobal}</p>
            </div>
          )}

          {workspace.primaryGoal === "MOE_TPR" && workspace.moeTprSynthesis && (
            <div style={{ background: "#fbfdfc", border: "1px solid #e6ede9", borderRadius: 12, padding: 16 }}>
              <h3 style={{ margin: "0 0 10px 0", color: "#6a1b9a", fontSize: 15 }}>🎓 教育部教學實踐研究現場判讀 (MOE TPR Synthesis)</h3>
              <p style={{ fontSize: 13, color: "#3a4a40", margin: "4px 0" }}><strong>現場問題檢驗：</strong>{workspace.moeTprSynthesis.classroomObservedProblemValidation}</p>
              <p style={{ fontSize: 13, color: "#3a4a40", margin: "4px 0" }}><strong>教學介入學理依據：</strong>{workspace.moeTprSynthesis.instructionalInterventionBasis}</p>
              <p style={{ fontSize: 12, color: "#e65100", margin: "4px 0" }}><strong>課堂基線提示：</strong>{workspace.moeTprSynthesis.classroomBaselineNotice}</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Search Tasks & Search Log */}
      {activeTab === "searchLog" && (
        <div>
          <h3 style={{ fontSize: 16, color: "#23423a", marginBottom: 12 }}>檢索計畫與執行日誌 (PRISMA-S Traceable Logs)</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {workspace.searchTasks.map((task) => (
              <div key={task.taskId} style={{ border: "1px solid #e6ede9", borderRadius: 10, padding: 14, background: "#fbfdfc" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong style={{ color: "#1f8a70" }}>{task.taskId} · 角色：{task.role}</strong>
                  <span style={{ fontSize: 12, padding: "2px 8px", background: "#edf2ee", borderRadius: 4 }}>
                    取回：{task.retrievedCount} 筆（去重後 {task.uniqueRecordsCount} 筆）
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "#3a4a40", marginTop: 6 }}>
                  <strong>檢索語法：</strong><code>{task.executedQuery}</code>
                </div>
                <div style={{ fontSize: 12, color: "#66756d", marginTop: 4 }}>
                  來源：{task.databases.join(", ")} · 預算上限：{task.retrievalBudgetCap} 篇 · 執行時間：{task.executedAt ? new Date(task.executedAt).toLocaleString("zh-TW") : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Gap Claims & Counterevidence */}
      {activeTab === "gapMap" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: "#23423a" }}>研究缺口主張 (Gap Claims) 與反證追蹤</h3>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {workspace.gapClaims.map((claim) => {
              const isHighlighted = focusedFieldRef === claim.claimId;
              return (
                <div
                  key={claim.claimId}
                  style={{
                    border: `1px solid ${isHighlighted ? "#fbc02d" : "#e6ede9"}`,
                    borderRadius: 10,
                    padding: 14,
                    background: isHighlighted ? "#fffde7" : "#fbfdfc",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontWeight: 700, color: "#1f8a70", marginRight: 8 }}>{claim.claimId}</span>
                      <span style={{ fontSize: 11, padding: "2px 6px", background: "#edf2ee", borderRadius: 4, marginRight: 6 }}>
                        {claim.gapType}
                      </span>
                      <span style={{ fontSize: 11, padding: "2px 6px", background: "#e3f2ec", color: "#1f8a70", borderRadius: 4 }}>
                        狀態：{claim.assessmentStatus}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => handleToggleClaimLock(claim.claimId)}
                        style={{ fontSize: 12 }}
                      >
                        {claim.isLocked ? "🔒 已鎖定" : "🔓 未鎖定"}
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleAiRefineClaim(claim.claimId)}
                        disabled={claim.isLocked}
                        style={{ fontSize: 11 }}
                      >
                        老麥協作修訂
                      </button>
                    </div>
                  </div>

                  <p style={{ fontSize: 13, color: "#23423a", marginTop: 8, lineHeight: 1.5 }}>
                    {claim.claimText}
                  </p>

                  <div style={{ fontSize: 12, color: "#388e3c", marginTop: 6 }}>
                    <strong>支持文獻：</strong>{claim.supportingEvidenceRefs.join(", ") || "（待補強）"}
                  </div>
                  <div style={{ fontSize: 12, color: "#d32f2f", marginTop: 4 }}>
                    <strong>反證與限制文獻：</strong>{claim.counterevidenceRefs.length > 0 ? claim.counterevidenceRefs.join(", ") : "（尚未登錄反證·需注意確認偏差）"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 4: Closest Study Matrix */}
      {activeTab === "closestStudies" && (
        <div>
          <h3 style={{ fontSize: 16, color: "#23423a", marginBottom: 12 }}>最相近研究矩陣 (Closest Study Matrix)</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {workspace.closestStudies.map((cs) => (
              <div key={cs.closestStudyId} style={{ border: "1px solid #e6ede9", borderRadius: 10, padding: 14, background: "#fbfdfc" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong style={{ color: "#1f8a70" }}>{cs.title}</strong>
                  <span style={{ fontSize: 12, padding: "2px 8px", background: "#edf2ee", borderRadius: 4 }}>
                    年份：{cs.year} · {cs.relevanceDegree}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "#3a4a40", marginTop: 6 }}>
                  <strong>處理之核心問題：</strong>{cs.coreProblemAddressed}
                </div>
                <div style={{ fontSize: 13, color: "#5b6b63", marginTop: 4 }}>
                  <strong>方法與樣本：</strong>{cs.methodologyOverview}（{cs.dataAndPopulationContext}）
                </div>
                <div style={{ fontSize: 12, color: "#e65100", marginTop: 4 }}>
                  <strong>作者報告之限制：</strong>{cs.reportedLimitations}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Contribution Delta */}
      {activeTab === "delta" && (
        <div>
          <h3 style={{ fontSize: 16, color: "#23423a", marginBottom: 12 }}>實質差異分析 (Contribution Delta)</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {workspace.contributionDeltas.map((delta) => {
              const isHighlighted = focusedFieldRef === delta.deltaId;
              return (
                <div
                  key={delta.deltaId}
                  style={{
                    border: `1px solid ${isHighlighted ? "#fbc02d" : "#e6ede9"}`,
                    borderRadius: 10,
                    padding: 14,
                    background: isHighlighted ? "#fffde7" : "#fbfdfc",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong style={{ color: "#1f8a70" }}>{delta.deltaId} · 差異維度：{delta.differenceNature}</strong>
                    <span style={{ fontSize: 12, padding: "2px 8px", background: "#e3f2ec", color: "#1f8a70", borderRadius: 4 }}>
                      {delta.status}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8, fontSize: 13 }}>
                    <div style={{ padding: 8, background: "#fff", border: "1px solid #eef1ef", borderRadius: 6 }}>
                      <small style={{ color: "#66756d" }}>相近研究做法：</small>
                      <div style={{ marginTop: 2 }}>{delta.closestStudyFeature}</div>
                    </div>
                    <div style={{ padding: 8, background: "#f0f8f4", border: "1px solid #cce5d8", borderRadius: 6 }}>
                      <small style={{ color: "#1f8a70" }}>本研究規劃做法：</small>
                      <div style={{ marginTop: 2 }}>{delta.currentStudyFeature}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: "#3a4a40", marginTop: 8 }}>
                    <strong>潛在學術價值說明：</strong>{delta.potentialValueRationale}
                  </div>
                  <div style={{ fontSize: 12, color: "#5b6b63", marginTop: 4 }}>
                    <strong>如何實證檢驗此價值：</strong>{delta.howToEmpiricallyValidate}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 6: Issue Panel */}
      {activeTab === "issues" && (
        <div>
          <h3 style={{ fontSize: 16, color: "#23423a", marginBottom: 12 }}>新穎性與缺失檢查清單 (RequirementIssuePanel)</h3>
          {logicFindings.length === 0 ? (
            <div style={{ background: "#e8f5e9", border: "1px solid #81c784", color: "#1b5e20", padding: 14, borderRadius: 10 }}>
              ✔ 文獻深化與新穎性檢查全數通過！無阻擋完成之項目。
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
