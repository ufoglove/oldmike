import React from "react";
import Icon from "../Icons";
import { ModuleDefinition, CapabilityStatus } from "../../lib/module-registry";

interface Home2FunctionCardProps {
  module: ModuleDefinition;
  onNavigate: (routeId: string) => void;
  onOpenHelp: (module: ModuleDefinition) => void;
  hasProject: boolean;
}

const moduleIconMap: Record<string, string> = {
  radar: "compass", "one-click": "target", "topic-lab": "microscope", navigator: "route",
  blueprint: "layers", evidence: "bookOpen", gap: "target", theory: "layers", design: "route",
  "route-workspace": "route", proposals: "doc", "ethics-center": "check",
  "instruments-protocol": "gear", "pilot-protocol-validation": "microscope",
  "formal-execution": "check", "data-governance": "layers", "analysis-lab": "microscope",
  "manuscript-studio": "pen", "scientific-review": "check", "language-center": "copy",
  "submission-spec": "doc", "reviewer-response": "list", trash: "logout",
};

function statusInfo(status: CapabilityStatus): { cls: string; text: string } {
  switch (status) {
    case "MAINTENANCE": return { cls: "s-warn", text: "維護中" };
    case "CONFIG_REQUIRED": return { cls: "s-warn", text: "外部設定待補" };
    case "NOT_BUILT": return { cls: "s-mute", text: "尚未建置" };
    default: return { cls: "s-ready", text: "可使用" };
  }
}

export default function Home2FunctionCard({ module, onNavigate, onOpenHelp, hasProject }: Home2FunctionCardProps) {
  const iconName = moduleIconMap[module.moduleId] || "doc";
  const blockedByProject = module.capabilityNeed === "PROJECT_REQUIRED" && !hasProject;
  const available = module.status === "AVAILABLE" && !blockedByProject;
  const badge = { cls: blockedByProject ? "s-mute" : statusInfo(module.status).cls, text: blockedByProject ? "需先選專案" : statusInfo(module.status).text };

  return (
    <article className="home2-card">
      <div>
        <div className="home2-card-top">
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start", minWidth: 0 }}>
            <div className="home2-card-ico"><Icon name={iconName} size={17} /></div>
            <div style={{ minWidth: 0 }}>
              <span className="home2-card-name">{module.displayName}</span>
              {module.englishSub && <span className="home2-card-eng">{module.englishSub}</span>}
            </div>
          </div>
          <span className={`home2-status ${badge.cls}`}>{badge.text}</span>
        </div>
        <p style={{ margin: "9px 0", minHeight: 34 }}>{module.plainSummary}</p>
        <div className="home2-output-box"><b>產出摘要：</b>{module.expectedOutputs}</div>
      </div>

      <div className="home2-card-foot">
        <button type="button" className="home2-help-btn" onClick={() => onOpenHelp(module)}>
          <Icon name="help" size={13} /> 說明
        </button>
        <button type="button" className="home2-fn" disabled={!available} onClick={() => onNavigate(module.routeNavId)}>
          {module.actionLabel}
        </button>
      </div>
    </article>
  );
}
