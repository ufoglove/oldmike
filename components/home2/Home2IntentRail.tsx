import React, { useState } from "react";
import Icon from "../Icons";
import { INTENTS, IntentEntry } from "../../lib/module-registry";

interface Home2IntentRailProps {
  onNavigate: (routeId: string) => void;
  hasProject: boolean;
}

export default function Home2IntentRail({ onNavigate, hasProject }: Home2IntentRailProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="home2-intent">
      <div className="home2-intent-title">
        <div className="home2-brand" style={{ justifyContent: "flex-start" }}>
          <div className="home2-card-ico" style={{ width: 34, height: 34, borderRadius: 10 }}>
            <Icon name="compass" size={18} />
          </div>
          <div>
            <h3 style={{ font: '700 16px "Source Serif 4","Noto Sans TC",serif', margin: 0, color: "var(--ink)" }}>
              今天想做什麼？
            </h3>
            <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: 11 }}>
              依您當前的研究意圖直接前往，不需先理解複雜模組術語
            </p>
          </div>
        </div>
        {hasProject && (
          <button type="button" className="home2-link" onClick={() => setIsCollapsed(!isCollapsed)}>
            {isCollapsed ? "展開意圖入口" : "收合"}
          </button>
        )}
      </div>

      {!isCollapsed && (
        <div className="home2-intent-grid">
          {INTENTS.map((intent: IntentEntry) => (
            <div key={intent.intentId} className="home2-intent-card">
              <b>{intent.label}<span style={{ color: "var(--teal)" }} aria-hidden="true">→</span></b>
              <span>{intent.tagline}</span>
              <button type="button" onClick={() => onNavigate(intent.primaryNavId)}>
                立即前往
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
