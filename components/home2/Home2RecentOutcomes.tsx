import React from "react";

interface Home2RecentOutcomesProps {
  hasProject: boolean;
  onNavigate: (routeId: string) => void;
}

export default function Home2RecentOutcomes({ hasProject, onNavigate }: Home2RecentOutcomesProps) {
  return (
    <>
      {/* 專案文獻與引用摘要 */}
      <div className="home2-panel">
        <div className="home2-panel-head">
          <div>
            <h3>專案文獻與證據</h3>
            <p>{hasProject ? "已連結專案 · 同步狀態即時更新" : "未選專案 · 尚無文獻摘要"}</p>
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <div className="home2-meta-row"><span>已納入文獻筆數</span><b>{hasProject ? "0 篇" : "—"}</b></div>
          <div className="home2-meta-row"><span>待補引用與驗證標記</span><b>{hasProject ? "0 項" : "—"}</b></div>
          <div className="home2-meta-row"><span>Zotero 同步狀態</span><b style={{ color: "var(--muted)", fontWeight: 500 }}>尚未綁定或未同步</b></div>
        </div>
        <button type="button" className="home2-fn ghost" style={{ width: "100%" }} disabled={!hasProject} onClick={() => onNavigate("evidence")}>
          進入文獻與證據中心
        </button>
      </div>

      {/* 近期產出版本 */}
      <div className="home2-panel">
        <div className="home2-panel-head">
          <div>
            <h3>近期研究成果與版本</h3>
            <p>{hasProject ? "即時摘要" : "未選專案"}</p>
          </div>
        </div>
        <div className="home2-empty-dash">
          {hasProject ? "目前尚無產出草稿或分析結果" : "選定專案後即可查看最新版本與圖表"}
        </div>
        <button type="button" className="home2-fn ghost" style={{ width: "100%" }} disabled={!hasProject} onClick={() => onNavigate("blueprint")}>
          查看研究藍圖規劃
        </button>
      </div>
    </>
  );
}
