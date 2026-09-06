"use client";

// 老麥・研究流程與完成燈號 (Spec v3.3.0 §5/§6/§7)
// 綠燈只由後端有效 completion snapshot 決定；開頁/儲存/鎖定/建站測試不點燈。
import { useMemo, useState } from "react";
import {
  WORKFLOW_ROUTE_TEMPLATES,
  computeWorkflowProgress,
  type WorkflowNodeState,
} from "@/lib/research-workflow-registry";
import { RESEARCH_GOAL_DEFINITIONS, type PrimaryGoalId } from "@/lib/research-goal-registry";

type RouteProgressInput = {
  nodeId: string;
  state: WorkflowNodeState;
  completionSnapshotId?: string;
  issueCount: number;
};

const STATE_META: Record<WorkflowNodeState, { label: string; color: string; icon: string }> = {
  NOT_STARTED: { label: "尚未開始", color: "#9aa8a0", icon: "○" },
  IN_PROGRESS: { label: "進行中", color: "#2f6fed", icon: "●" },
  AWAITING_INPUT: { label: "待補資料", color: "#e6a23c", icon: "▲" },
  AWAITING_APPROVAL: { label: "待確認", color: "#e6a23c", icon: "▲" },
  BLOCKED: { label: "受阻", color: "#d64541", icon: "✖" },
  FAILED: { label: "失敗", color: "#d64541", icon: "✖" },
  COMPLETED_VALID: { label: "已完成", color: "#0f7a3d", icon: "✔" },
  STALE: { label: "需重驗", color: "#e6a23c", icon: "↻" },
  NOT_APPLICABLE: { label: "不適用", color: "#9aa8a0", icon: "≡" },
  MODULE_UNAVAILABLE: { label: "未建置", color: "#8a8a8a", icon: "🔒" },
};

function nodeTitle(state: WorkflowNodeState): string {
  return STATE_META[state].label;
}

export default function ResearchWorkflowLightPanel({
  goalId,
  progress,
  onNavigate,
}: {
  goalId: PrimaryGoalId;
  progress: RouteProgressInput[];
  onNavigate?: (nodeId: string) => void;
}) {
  const [view, setView] = useState<"graph" | "list">("graph");
  const template = WORKFLOW_ROUTE_TEMPLATES[goalId];
  const goal = RESEARCH_GOAL_DEFINITIONS[goalId];
  const byId = useMemo(() => new Map(progress.map((p) => [p.nodeId, p])), [progress]);

  const nodesWithState = useMemo(
    () => template.nodes.map((node) => ({ node, state: byId.get(node.nodeId)?.state ?? ("NOT_STARTED" as WorkflowNodeState), issueCount: byId.get(node.nodeId)?.issueCount ?? 0 })),
    [template, byId],
  );

  const stats = useMemo(
    () => computeWorkflowProgress(template.nodes, nodesWithState.map(({ node, state, issueCount }) => ({ node, state, issueCount }))),
    [template, nodesWithState],
  );

  const nextIncomplete = nodesWithState.find(({ state }) => state === "NOT_STARTED" || state === "AWAITING_INPUT" || state === "AWAITING_APPROVAL" || state === "MODULE_UNAVAILABLE");

  const renderNode = (item: { node: { nodeId: string; titleZh: string }; state: WorkflowNodeState; issueCount: number }) => {
    const meta = STATE_META[item.state];
    const isNext = nextIncomplete?.node.nodeId === item.node.nodeId;
    return (
      <div
        key={item.node.nodeId}
        role="listitem"
        aria-label={`${item.node.titleZh}：${meta.label}`}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, border: isNext ? "1px solid var(--accent, #2f6fed)" : "1px solid transparent", background: "#fbfdfc" }}
      >
        <span style={{ color: meta.color, fontSize: 16, width: 18, textAlign: "center" }} aria-hidden="true">{meta.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{item.node.titleZh}</div>
          <div style={{ fontSize: 11, color: "#5b6b63" }}>{meta.label}{item.issueCount > 0 ? ` · 缺 ${item.issueCount} 項` : ""}</div>
        </div>
        {item.state === "AWAITING_INPUT" && onNavigate && (
          <button type="button" className="text-button" onClick={() => onNavigate(item.node.nodeId)}>前往補足 →</button>
        )}
        {item.state === "MODULE_UNAVAILABLE" && <span style={{ fontSize: 11, color: "#8a8a8a" }}>能力缺口</span>}
      </div>
    );
  };

  return (
    <section aria-label="研究流程與完成燈號" style={{ margin: "16px 0", border: "1px solid #e6ede9", borderRadius: 12, padding: 14, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <p className="section-kicker">研究流程與完成燈號</p>
          <h3 style={{ margin: 0, fontSize: 16 }}>{goal.labelZh}</h3>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className={view === "graph" ? "primary-button" : "text-button"} onClick={() => setView("graph")} style={{ fontSize: 12 }}>流程圖</button>
          <button type="button" className={view === "list" ? "primary-button" : "text-button"} onClick={() => setView("list")} style={{ fontSize: 12 }}>清單</button>
        </div>
      </div>

      <div style={{ fontSize: 13, color: "#5b6b63", marginBottom: 10 }}>
        本次成果完成度：<strong>{stats.requiredComplete} / {stats.requiredTotal}</strong> 個必要節點
        （{Math.round(stats.completionRate * 100)}%）· 待補 {stats.awaitingInputCount} · 受阻 {stats.blockedCount} · 未建置 {stats.unbuiltCount}
      </div>

      {view === "graph" ? (
        <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }} role="list">
          {nodesWithState.map(renderNode)}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }} role="list">
          {nodesWithState.map(renderNode)}
        </div>
      )}

      {nextIncomplete && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: "#f3f8f5", fontSize: 13 }}>
          <b>下一步：</b>{nextIncomplete.node.titleZh}
          <span style={{ color: "#5b6b63" }}>（{nodeTitle(nextIncomplete.state)}）</span>
          {onNavigate && <button type="button" className="text-button" onClick={() => onNavigate(nextIncomplete.node.nodeId)}>進入 →</button>}
        </div>
      )}
    </section>
  );
}
