import React from "react";

interface Home2OldMikeAssistRailProps {
  hasProject: boolean;
  onNavigate: (routeId: string) => void;
  onOpenHelpModal?: () => void;
}

export default function Home2OldMikeAssistRail({
  hasProject,
  onNavigate,
  onOpenHelpModal,
}: Home2OldMikeAssistRailProps) {
  return (
    <div className="home2-panel">
      <div className="home2-panel-head" style={{ paddingBottom: 10, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="home2-brand-mark" style={{ width: 34, height: 34, fontSize: 15, borderRadius: 10 }} aria-hidden="true">麥</div>
          <div>
            <h3 style={{ font: '700 14px "Source Serif 4","Noto Sans TC",serif', margin: 0, color: "var(--ink)" }}>老麥即時科研協作</h3>
            <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: 11 }}>
              {hasProject ? "已綁定當前專案上下文" : "獨立模式（未綁定專案）"}
            </p>
          </div>
        </div>
      </div>

      <div className="home2-assist-tip">
        <b>探索提示：</b>{" "}
        {hasProject
          ? "您已進入專案工作區。建議先至「研究藍圖」確認研究問題與架構，或至「文獻與證據中心」收錄核心文獻。"
          : "尚未選定專案。您可以先新增研究專案，或用獨立工具先進行「前沿雷達」或「翻譯潤稿」。"}
      </div>

      <div className="home2-quick-list">
        <button type="button" className="home2-q" onClick={() => onNavigate("radar")}>
          <span>我想看看現在最熱門的研究主題</span>
          <span style={{ color: "var(--teal)" }} aria-hidden="true">→</span>
        </button>
        <button type="button" className="home2-q" onClick={() => onNavigate("standalone-language")}>
          <span>我只想快速潤稿或翻譯現有摘要</span>
          <span style={{ color: "var(--teal)" }} aria-hidden="true">→</span>
        </button>
      </div>

      {onOpenHelpModal && (
        <button type="button" className="home2-link"
          style={{ marginTop: 12, borderTop: "1px solid #e9ece8", paddingTop: 12, width: "100%", justifyContent: "center" }}
          onClick={onOpenHelpModal}>
          觀看平台操作新手導覽
        </button>
      )}
    </div>
  );
}
