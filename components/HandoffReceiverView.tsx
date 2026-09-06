"use client";

// 第四階段交接接收頁 (Spec v3.4.0 §24 第二條)
// 「第四階段不存在：本輪建立交接接收頁，顯示已保存研究摘要、路線、待辦與引用，
// 以及『研究藍圖模組待建置』。提供重開、返回、匯出導航摘要；不生成假完整藍圖。」
import { useState } from "react";
import { type SubmissionNavigationSnapshot } from "@/lib/submission-navigation-engines-contract";
import { RESEARCH_GOAL_DEFINITIONS, type PrimaryGoalId } from "@/lib/research-goal-registry";

export default function HandoffReceiverView({
  snapshot,
  onReturnToNavigator,
  onExportSummary,
}: {
  snapshot: SubmissionNavigationSnapshot;
  onReturnToNavigator?: () => void;
  onExportSummary?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  // Derive goal from snapshot funding & publication intents
  const derivedGoal: PrimaryGoalId = snapshot.fundingIntent === "MOE_TPR"
    ? "MOE_TPR"
    : snapshot.fundingIntent === "NSTC_GENERAL"
      ? "NSTC_GENERAL"
      : "JOURNAL_SCI_SSCI";
  const goal = RESEARCH_GOAL_DEFINITIONS[derivedGoal];

  const handleCopyJson = () => {
    void navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div style={{ maxWidth: 860, margin: "24px auto", padding: "20px 24px", background: "#fff", border: "1px solid #dde6e0", borderRadius: 16 }}>
      {/* Header Banner */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #eef1ef", paddingBottom: 16, marginBottom: 16 }}>
        <div>
          <span style={{ display: "inline-block", background: "#e3f2ec", color: "#1f8a70", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            ✔ 投稿與計畫導航 · 交接就緒
          </span>
          <h2 style={{ margin: 0, fontSize: 20, color: "#23423a" }}>
            第四階段「研究藍圖」交接接收頁
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#66756d" }}>
            快照 ID：<code>{snapshot.snapshotId}</code> · 產生時間：{snapshot.decisionAt ? new Date(snapshot.decisionAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }) : "—"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {onReturnToNavigator && (
            <button type="button" className="secondary-button" onClick={onReturnToNavigator} style={{ fontSize: 13 }}>
              ← 返回投稿導航
            </button>
          )}
          <button type="button" className="secondary-button" onClick={handleCopyJson} style={{ fontSize: 13 }}>
            {copied ? "已複製 JSON" : "複製快照 JSON"}
          </button>
        </div>
      </div>

      {/* Module Unavailable Notice (Spec §24: 誠實標示待建置，不跳空白頁、不造假核准藍圖) */}
      <div style={{ background: "#fff8e1", border: "1px solid #e2b93b", borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 24 }} aria-hidden="true">🔒</span>
        <div>
          <strong style={{ color: "#7a5200", fontSize: 14 }}>第四階段專業研究藍圖引擎 · 依規格待建置</strong>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#5b4a1e" }}>
            本輪（第三階段 V3-U03-FULL）已完成投稿與計畫導航決策並產生不可變交接快照。後續研究藍圖模組將依規格讀取本快照直接消費，無需重新選題。
          </p>
        </div>
      </div>

      {/* Selected Routes Summary */}
      <section style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, color: "#23423a", marginBottom: 10 }}>已選定之研究路線與意圖</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          <div style={{ border: "1px solid #e6ede9", borderRadius: 10, padding: 12, background: "#fbfdfc" }}>
            <small style={{ color: "#66756d" }}>主要目標</small>
            <div style={{ fontWeight: 700, color: "#1f8a70", marginTop: 2 }}>{goal.labelZh}</div>
          </div>
          <div style={{ border: "1px solid #e6ede9", borderRadius: 10, padding: 12, background: "#fbfdfc" }}>
            <small style={{ color: "#66756d" }}>資助意向</small>
            <div style={{ fontWeight: 700, marginTop: 2 }}>{snapshot.fundingIntent}</div>
          </div>
          <div style={{ border: "1px solid #e6ede9", borderRadius: 10, padding: 12, background: "#fbfdfc" }}>
            <small style={{ color: "#66756d" }}>發表意向</small>
            <div style={{ fontWeight: 700, marginTop: 2 }}>{snapshot.publicationIntent}</div>
          </div>
          <div style={{ border: "1px solid #e6ede9", borderRadius: 10, padding: 12, background: "#fbfdfc" }}>
            <small style={{ color: "#66756d" }}>規劃狀態</small>
            <div style={{ fontWeight: 700, color: snapshot.planningStatus === "ROUTE_PLAN_READY" ? "#0f7a3d" : "#e6a23c", marginTop: 2 }}>
              {snapshot.planningStatus === "ROUTE_PLAN_READY" ? "✔ 具體路線規劃已就緒" : "▲ 暫定路線規劃（待查證）"}
            </div>
          </div>
        </div>
      </section>

      {/* Candidates Detail */}
      {snapshot.selectedJournalCandidate && (
        <div style={{ border: "1px solid #e6ede9", borderRadius: 10, padding: 14, marginBottom: 14, background: "#fbfdfc" }}>
          <strong style={{ color: "#1f8a70" }}>📘 選定期刊：{snapshot.selectedJournalCandidate.journalName}</strong>
          <div style={{ fontSize: 13, color: "#5b6b63", marginTop: 4 }}>
            出版社：{snapshot.selectedJournalCandidate.publisher} · 角色：{snapshot.selectedJournalCandidate.role} · 適配分：{snapshot.selectedJournalCandidate.fitScore} 分（覆蓋率 {Math.round((snapshot.selectedJournalCandidate.fitCoverage || 1) * 100)}%）
          </div>
          <div style={{ fontSize: 12, color: "#e65100", marginTop: 4 }}>
            主要風險：{snapshot.selectedJournalCandidate.primaryRisk}
          </div>
        </div>
      )}

      {snapshot.selectedNstcCandidate && (
        <div style={{ border: "1px solid #e6ede9", borderRadius: 10, padding: 14, marginBottom: 14, background: "#fbfdfc" }}>
          <strong style={{ color: "#b87000" }}>🏛️ 選定國科會學門：{snapshot.selectedNstcCandidate.disciplineName}（{snapshot.selectedNstcCandidate.disciplineCode || "—"}）</strong>
          <div style={{ fontSize: 13, color: "#5b6b63", marginTop: 4 }}>
            處別：{snapshot.selectedNstcCandidate.divisionName} · 主持人資格狀態：{snapshot.selectedNstcCandidate.eligibilityStatus}
          </div>
          <div style={{ fontSize: 12, color: "#5b6b63", marginTop: 4 }}>
            官方截止日：{snapshot.selectedNstcCandidate.deadlines?.officialDeadline} · 校內截止日：{snapshot.selectedNstcCandidate.deadlines?.institutionalDeadline || "待確認"}
          </div>
        </div>
      )}

      {snapshot.selectedMoeTprCandidate && (
        <div style={{ border: "1px solid #e6ede9", borderRadius: 10, padding: 14, marginBottom: 14, background: "#fbfdfc" }}>
          <strong style={{ color: "#6a1b9a" }}>🎓 選定教學實踐學門：{snapshot.selectedMoeTprCandidate.disciplineOrProgramName}</strong>
          <div style={{ fontSize: 13, color: "#5b6b63", marginTop: 4 }}>
            目標學年度：民國 {snapshot.selectedMoeTprCandidate.targetAcademicYearRoc} 年 · 課程：{snapshot.selectedMoeTprCandidate.courseFit?.courseName} · 主授核實：{snapshot.selectedMoeTprCandidate.courseFit?.isInstructorVerified ? "是" : "待補"}
          </div>
        </div>
      )}

      {/* Downstream Requirements & Blueprint Needs (Spec §24) */}
      <section style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, color: "#23423a", marginBottom: 8 }}>交接給第四階段研究藍圖的待辦需求</h3>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#3a4a40", lineHeight: 1.6 }}>
          {(snapshot.downstreamRequirements || []).map((req, idx) => (
            <li key={idx}>{req}</li>
          ))}
        </ul>
      </section>

      {/* Handoff Limitations */}
      <section style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, color: "#23423a", marginBottom: 8 }}>已知限制事項</h3>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#66756d", lineHeight: 1.6 }}>
          {(snapshot.handoffLimitations || []).map((lim, idx) => (
            <li key={idx}>{lim}</li>
          ))}
        </ul>
      </section>

      {/* Actions */}
      <div style={{ borderTop: "1px solid #eef1ef", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#66756d" }}>
          第四階段啟動後，將自動讀取本快照進行藍圖架構規劃。
        </span>
        {onReturnToNavigator && (
          <button type="button" className="primary-button" onClick={onReturnToNavigator}>
            完成檢閱，留在投稿導航
          </button>
        )}
      </div>
    </div>
  );
}
