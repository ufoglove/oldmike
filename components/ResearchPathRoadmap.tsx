"use client";

// 老麥・研究路徑 Roadmap（Spec v3.3.0 §5 首屏核心 + 使用者指定樣式）
// 雙區塊：RESEARCH LIFECYCLE（S0–S9 圓點時間軸，目前 Stage 青綠高亮）
//         RESEARCH PATH（從前沿到送件的橫向卡片，高亮目前 Station）
import { useMemo } from "react";
import { researchPathStations, stageDefinitions, stageNumberFromKey } from "@/lib/research-config";
import { RESEARCH_GOAL_DEFINITIONS, type PrimaryGoalId } from "@/lib/research-goal-registry";

const TEAL = "#1f8a70";
const TEAL_SOFT = "#e3f2ec";
const GRAY = "#9aa8a0";
const GRAY_SOFT = "#f0f3f1";
const INK = "#23423a";
const MUTED = "#66756d";

export default function ResearchPathRoadmap({
  goalId,
  currentStage = "S0_INTAKE",
  currentStationKey,
  onNavigate,
  showGoalSwitcher,
  onGoalChange,
}: {
  goalId: PrimaryGoalId;
  currentStage?: string;
  currentStationKey?: string | null;
  onNavigate?: (navId: string) => void;
  showGoalSwitcher?: boolean;
  onGoalChange?: (goalId: PrimaryGoalId) => void;
}) {
  const stageIdx = useMemo(() => stageDefinitions.findIndex((s) => s.key === currentStage), [currentStage]);
  const activeIdx = stageIdx >= 0 ? stageIdx : 0;
  const goal = RESEARCH_GOAL_DEFINITIONS[goalId];

  // researchPathStations: [前沿雷達, 一鍵靈感, 選題實驗室, 投稿與計畫導航, 文獻與研究設計, 理論與機制, 研究設計, 執行與統計, 全文, 老麥審查, 正式送件]
  const stations = researchPathStations;
  const activeStationIdx = currentStationKey ? stations.findIndex((s) => s.key === currentStationKey) : -1;

  return (
    <section aria-label="研究路徑與生命週期" style={{ border: "1px solid #dde6e0", borderRadius: 16, padding: "18px 20px", background: "linear-gradient(180deg,#ffffff,#f7fbf9)", marginBottom: 18 }}>
      {/* 標題列：目標 + 目標切換 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 18, color: INK }}>{goal.shortLabel} · 研究路徑</h2>
            {onGoalChange && showGoalSwitcher && (
              <div style={{ display: "flex", gap: 4 }} role="tablist" aria-label="切換研究目標（僅檢視，不更改專案目標）">
                {(Object.keys(RESEARCH_GOAL_DEFINITIONS) as PrimaryGoalId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={id === goalId}
                    onClick={() => onGoalChange(id)}
                    style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, border: id === goalId ? "1px solid " + TEAL : "1px solid #d8e0db", background: id === goalId ? TEAL_SOFT : "#fff", color: id === goalId ? TEAL : MUTED, fontWeight: 700, cursor: "pointer" }}
                  >
                    {RESEARCH_GOAL_DEFINITIONS[id].shortLabel}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED }}>每次轉移都應有 project artifact 與 human gate。</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="secondary-button" style={{ fontSize: 12 }} onClick={() => onNavigate?.("radar")}>前沿雷達</button>
          <button type="button" className="secondary-button" style={{ fontSize: 12 }} onClick={() => onNavigate?.("one-click")}>一鍵靈感</button>
        </div>
      </div>

      {/* 區塊一：RESEARCH LIFECYCLE 圓點時間軸 */}
      <div style={{ border: "1px solid #e6ede9", borderRadius: 12, padding: "14px 16px", marginTop: 8, background: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <p className="section-kicker" style={{ margin: 0 }}>RESEARCH LIFECYCLE · 研究生命週期與目前 Stage</p>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 0, overflowX: "auto", paddingTop: 18, position: "relative" }}>
          {/* 進度連線：一條水平線，active 前的段為青綠色 */}
          <div style={{ position: "absolute", top: 26, left: 10, right: 10, height: 3, background: GRAY_SOFT, borderRadius: 2 }} />
          <div style={{ position: "absolute", top: 26, left: 10, height: 3, background: TEAL, borderRadius: 2, width: `calc(${activeIdx / Math.max(stageDefinitions.length - 1, 1)} * (100% - 20px))`, transition: "width .4s ease" }} />
          {stageDefinitions.map((stage, index) => {
            const isActive = index === activeIdx;
            return (
              <button
                key={stage.key}
                type="button"
                onClick={() => onNavigate?.(stationNavIdForStage(stage.key))}
                aria-label={`${stage.title} ${isActive ? "目前階段" : ""}`}
                style={{ flex: "0 0 auto", minWidth: 74, textAlign: "center", background: "none", border: "none", cursor: onNavigate ? "pointer" : "default", padding: 0 }}
              >
                <div style={{ margin: "0 auto", width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, border: isActive ? "3px solid " + TEAL : "3px solid #d3ddd7", background: isActive ? TEAL : "#fff", color: isActive ? "#fff" : GRAY, boxShadow: isActive ? "0 2px 8px rgba(31,138,112,.35)" : "none" }}>
                  {stage.short}
                </div>
                <div style={{ marginTop: 6, fontSize: 12, fontWeight: isActive ? 800 : 600, color: isActive ? TEAL : MUTED, lineHeight: 1.25 }}>{stage.title}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 區塊二：RESEARCH PATH 橫向卡片 */}
      <div style={{ border: "1px solid #e6ede9", borderRadius: 12, padding: "14px 16px", marginTop: 10, background: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <p className="section-kicker" style={{ margin: 0 }}>RESEARCH PATH · 串聯路徑／研究路徑</p>
          <span style={{ fontSize: 11, color: MUTED }}>從前沿到送件的 {stations.length} 站；高亮為目前對應位置</span>
        </div>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "12px 2px 6px", scrollSnapType: "x proximity" }}>
          {stations.map((station, index) => {
            const isActive = index === activeStationIdx || (!currentStationKey && station.stage === currentStage);
            return (
              <div
                key={station.key}
                onClick={() => onNavigate?.(station.navId)}
                style={{ flex: "0 0 auto", width: 168, border: isActive ? "1.5px solid " + TEAL : "1px solid #e0e7e2", borderRadius: 12, padding: "10px 12px", background: isActive ? TEAL_SOFT : "#fff", cursor: onNavigate ? "pointer" : "default", scrollSnapAlign: "start" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, background: isActive ? TEAL : "#eef1ef", color: isActive ? "#fff" : MUTED }}>{index}</span>
                  <strong style={{ fontSize: 13, color: INK }}>{station.title}</strong>
                </div>
                <small style={{ color: MUTED, fontSize: 12, lineHeight: 1.4 }}>{station.note}</small>
                {isActive && <div style={{ marginTop: 6, fontSize: 11, fontWeight: 800, color: TEAL }}>● 目前位置</div>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function stationNavIdForStage(stageKey: string): string {
  const match = researchPathStations.find((s) => s.stage === stageKey);
  return match ? match.navId : "overview";
}