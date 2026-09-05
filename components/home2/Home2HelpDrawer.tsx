import React from "react";
import { ModuleDefinition } from "../../lib/module-registry";

interface Home2HelpDrawerProps {
  module: ModuleDefinition | null;
  onClose: () => void;
  onNavigate: (routeId: string) => void;
  hasProject: boolean;
}

export default function Home2HelpDrawer({ module, onClose, onNavigate, hasProject }: Home2HelpDrawerProps) {
  if (!module) return null;
  const blockedByProject = module.capabilityNeed === "PROJECT_REQUIRED" && !hasProject;
  const available = module.status === "AVAILABLE" && !blockedByProject;

  return (
    <div className="home2-drawer-backdrop" role="presentation" onClick={onClose}>
      <div className="home2-drawer" role="dialog" aria-modal="true" aria-labelledby="help-drawer-title" onClick={(e) => e.stopPropagation()}>
        <div>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <span className="home2-kicker">模組說明規範 v{module.helpVersion}</span>
              <h2 id="help-drawer-title">
                {module.displayName}
                {module.englishSub && <span style={{ fontWeight: 400, color: "var(--faint)", fontSize: 12, marginLeft: 6 }}>{module.englishSub}</span>}
              </h2>
            </div>
            <button type="button" className="h2-x" onClick={onClose} aria-label="關閉說明">✕</button>
          </div>

          <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 11, padding: "11px 13px", marginTop: 12 }}>
            <h3>功能用途</h3>
            <p>{module.plainSummary}</p>
          </div>
        </div>

        <div>
          <h3>適合使用時機</h3>
          <p>{module.whenToUse}</p>
        </div>

        <div>
          <h3>需要準備的輸入資料</h3>
          <ul>{module.requiredInputs.map((input, idx) => <li key={idx}>{input}</li>)}</ul>
        </div>

        <div>
          <h3>操作步驟</h3>
          <ul style={{ listStyle: "none", paddingLeft: 0 }}>
            {module.steps.map((step, idx) => (
              <li key={idx} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "3px 0" }}>
                <span style={{ flexShrink: 0, width: 17, height: 17, borderRadius: "50%", background: "var(--teal-light)", color: "var(--teal)", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, marginTop: 2 }}>{idx + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="doc-row">
          <p style={{ margin: "0 0 3px" }}><b style={{ color: "var(--ink)" }}>產出成果：</b>{module.expectedOutputs}</p>
          <p style={{ margin: 0 }}><b style={{ color: "var(--ink)" }}>保存位置：</b>{module.saveLocation}</p>
        </div>

        <div className="note-box">
          <b>關鍵限制與邊界原則：</b> {module.limitations}
        </div>

        <div className="home2-drawer-foot">
          <button type="button" className="home2-fn ghost" onClick={onClose}>關閉</button>
          <button type="button" className="home2-fn" disabled={!available}
            onClick={() => { onNavigate(module.routeNavId); onClose(); }}>
            {module.actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
