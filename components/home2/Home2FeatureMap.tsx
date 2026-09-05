import React, { useState } from "react";
import {
  MODULE_GROUPS,
  GROUP_ORDER,
  MODULE_REGISTRY,
  ModuleGroupId,
  ModuleDefinition,
} from "../../lib/module-registry";
import Home2FunctionCard from "./Home2FunctionCard";

interface Home2FeatureMapProps {
  hasProject: boolean;
  onNavigate: (routeId: string) => void;
  onOpenHelp: (module: ModuleDefinition) => void;
}

export default function Home2FeatureMap({ hasProject, onNavigate, onOpenHelp }: Home2FeatureMapProps) {
  const [selectedGroup, setSelectedGroup] = useState<ModuleGroupId | "all">("all");
  const modules = Object.values(MODULE_REGISTRY);
  const displayedGroups = selectedGroup === "all" ? GROUP_ORDER : [selectedGroup];

  return (
    <div>
      {/* 篩選標籤列 */}
      <div className="home2-groups" role="tablist" aria-label="功能群組篩選">
        <button type="button" role="tab" aria-selected={selectedGroup === "all"}
          onClick={() => setSelectedGroup("all")}
          className={`home2-group-tab ${selectedGroup === "all" ? "active" : ""}`}>
          全部六大群組<span className="home2-group-count">{modules.length}</span>
        </button>
        {GROUP_ORDER.map((gid) => {
          const group = MODULE_GROUPS[gid];
          const count = modules.filter((m) => m.groupId === gid).length;
          const isActive = selectedGroup === gid;
          return (
            <button key={gid} type="button" role="tab" aria-selected={isActive}
              onClick={() => setSelectedGroup(gid)}
              className={`home2-group-tab ${isActive ? "active" : ""}`}>
              {group.label}<span className="home2-group-count">{count}</span>
            </button>
          );
        })}
      </div>

      {displayedGroups.map((gid) => {
        const group = MODULE_GROUPS[gid];
        const groupModules = modules.filter((m) => m.groupId === gid);
        if (groupModules.length === 0) return null;
        return (
          <section key={gid} aria-labelledby={`home2-g-${gid}`}>
            <div className="home2-feature-group-title">
              <h4 id={`home2-g-${gid}`}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--navy)", marginRight: 8 }} />
                {group.label}
              </h4>
              <small>{groupModules.length} 項能力</small>
            </div>
            <div className="home2-feature-grid">
              {groupModules.map((module) => (
                <Home2FunctionCard key={module.moduleId} module={module} onNavigate={onNavigate} onOpenHelp={onOpenHelp} hasProject={hasProject} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
