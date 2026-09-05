import React, { useState } from "react";
import ProjectControlBar from "../ProjectControlBar";
import ProjectTrashCta from "../ProjectTrashCta";
import PhaseProgressCards from "../PhaseProgressCards";
import ResearchPathOverview from "../ResearchPathOverview";
import Icon from "../Icons";

import Home2IntentRail from "./Home2IntentRail";
import Home2SearchBar from "./Home2SearchBar";
import Home2FeatureMap from "./Home2FeatureMap";
import Home2HelpDrawer from "./Home2HelpDrawer";
import Home2Tour from "./Home2Tour";
import Home2RecentOutcomes from "./Home2RecentOutcomes";
import Home2OldMikeAssistRail from "./Home2OldMikeAssistRail";
import { ModuleDefinition } from "../../lib/module-registry";
import type { ProjectSummary } from "@/lib/project-contract";

/** 弱化索引型別：與 GuidedResearchCenter 的 IndexedProject 相容（欄位可選）。 */
type WorkIndexedProject = Partial<ProjectSummary> & { projectId: string; title?: string };

interface Home2WorkbenchOverviewProps {
  currentProject: WorkIndexedProject | null;
  projects: WorkIndexedProject[];
  onSwitchProject: (projectId: string) => void;
  onNewProject: () => void;
  onNavigate: (routeId: string) => void;
  onTrashed: (projectId: string) => void;
}

export default function Home2WorkbenchOverview({
  currentProject,
  onSwitchProject,
  onNewProject,
  onNavigate,
  onTrashed,
}: Home2WorkbenchOverviewProps) {
  const [activeHelpModule, setActiveHelpModule] = useState<ModuleDefinition | null>(null);
  const [showTour, setShowTour] = useState(false);

  const hasProject = Boolean(currentProject);
  const workingTitle = currentProject?.workingTitle || currentProject?.title || "未命名研究專案";
  const currentStage = currentProject?.currentStage || "S0_INTAKE";
  const nextGate = currentProject?.nextGate || "RESEARCH_DIRECTION Human Gate 待確認";

  return (
    <div className="home2-shell">
      {/* 1. 頂部專案控制列（保留原有後端持久與切換能力） */}
      <ProjectControlBar
        projectId={currentProject?.projectId ?? null}
        projectTitle={workingTitle}
        onSwitch={onSwitchProject}
        onNew={onNewProject}
      />

      {/* 2. 品牌與輔助搜尋列 + 新手導覽 */}
      <div className="home2-head">
        <div className="home2-brand">
          <div className="home2-brand-mark" aria-hidden="true">麥</div>
          <div>
            <h1>老麥科研工作台</h1>
            <p>{hasProject ? `目前專案：${workingTitle}` : "尚未選定專案 · 請建立或從上方選擇專案"}</p>
          </div>
        </div>
        <div className="home2-head-tools">
          <div className="home2-search">
            <Home2SearchBar onNavigate={onNavigate} onOpenHelp={(mod) => setActiveHelpModule(mod)} />
          </div>
          <button type="button" className="home2-chip" onClick={() => setShowTour(true)}>
            <Icon name="compass" size={14} />
            <span>新手導覽</span>
          </button>
        </div>
      </div>

      {/* 3. 主要任務卡（動態下一步建議） */}
      <div className="home2-primary">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="home2-amber-pill">目前階段：{currentStage}</span>
            <span style={{ color: "#cfdcd8", fontSize: 11 }}>下一個 Gate：{nextGate}</span>
          </div>
          <h2>{hasProject ? "現在建議做什麼：推進研究藍圖與文獻證據" : "現在建議做什麼：建立或選定一個研究專案"}</h2>
          <p>
            {hasProject
              ? "依目前專案進度，建議先前往「研究藍圖」確認研究問題與設計架構，並將相關文獻納入「文獻與證據中心」形成證據鏈。"
              : "首頁所有研究進度與文獻成果均綁定專案。請點選上方「新增專案」或「選擇專案」以解鎖完整協作能力。"}
          </p>
        </div>
        <button type="button" className="home2-primary-act" onClick={() => onNavigate(hasProject ? "blueprint" : "quick-start")}>
          <span>{hasProject ? "前往研究藍圖" : "立即建立專案"}</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>

      {/* 4. 今日意圖入口（六個核心意圖） */}
      <Home2IntentRail onNavigate={onNavigate} hasProject={hasProject} />

      {/* 5. 兩欄式主工作區 */}
      <div className="home2-cols">
        {/* 左側主要內容 */}
        <div className="home2-main">
          {/* 研究流程與進度摘要 */}
          <div className="home2-panel">
            <div className="home2-panel-head">
              <div>
                <h3>研究流程與進度摘要</h3>
                <p>六個階段群組與成果路線概覽（不強制硬性線性前進）</p>
              </div>
              <button type="button" className="home2-link" onClick={() => onNavigate("blueprint")}>
                完整規劃 <span aria-hidden="true">→</span>
              </button>
            </div>
            <ResearchPathOverview projectId={currentProject?.projectId ?? null} onNavigate={onNavigate} />
            <div style={{ marginTop: 16 }}>
              <PhaseProgressCards projectId={currentProject?.projectId ?? null} onNavigate={onNavigate} />
            </div>
          </div>

          {/* 六群功能完整地圖 */}
          <div className="home2-panel">
            <div className="home2-panel-head">
              <div>
                <h3>全站能力與功能地圖</h3>
                <p>六大科研領域群組，每項能力清楚標示用途、輸入、產出與限制</p>
              </div>
            </div>
            <Home2FeatureMap hasProject={hasProject} onNavigate={onNavigate} onOpenHelp={(mod) => setActiveHelpModule(mod)} />
          </div>
        </div>

        {/* 右側輔助面板 */}
        <div className="home2-rail">
          <Home2OldMikeAssistRail hasProject={hasProject} onNavigate={onNavigate} onOpenHelpModal={() => setShowTour(true)} />
          <Home2RecentOutcomes hasProject={hasProject} onNavigate={onNavigate} />
        </div>
      </div>

      {/* 6. 頁面最下方：危險操作與專案回收筒（保留規格四項指定操作） */}
      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 20 }}>
        <ProjectTrashCta
          projectId={currentProject?.projectId ?? null}
          projectTitle={workingTitle}
          onTrashed={onTrashed}
        />
      </div>

      {/* 彈出層：詳細使用說明抽屜 */}
      <Home2HelpDrawer module={activeHelpModule} onClose={() => setActiveHelpModule(null)} onNavigate={onNavigate} hasProject={hasProject} />

      {/* 彈出層：新手導覽 Modal */}
      {showTour && <Home2Tour onClose={() => setShowTour(false)} />}
    </div>
  );
}
