"use client";

import React from "react";
import { RequirementIssue } from "@/lib/stage-operation-contracts";

interface RequirementIssuePanelProps {
  issues: RequirementIssue[];
  onNavigateToIssue?: (issue: RequirementIssue) => void;
}

export const RequirementIssuePanel: React.FC<RequirementIssuePanelProps> = ({
  issues,
  onNavigateToIssue,
}) => {
  if (!issues || issues.length === 0) {
    return null;
  }

  const blockingCount = issues.filter((i) => i.blocksTransition).length;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 mb-6 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
          <h4 className="text-sm font-semibold text-amber-200">
            階段缺項清單 ({issues.length} 項，其中 {blockingCount} 項阻擋前進)
          </h4>
        </div>
        <span className="text-xs text-amber-300/70 font-mono">
          StageReadiness Engine
        </span>
      </div>

      <div className="space-y-2">
        {issues.map((iss) => (
          <div
            key={iss.issueId || iss.requirementId}
            className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border text-sm gap-2 ${
              iss.blocksTransition
                ? "bg-rose-950/20 border-rose-500/30 text-rose-200"
                : "bg-neutral-900/40 border-neutral-700/40 text-neutral-300"
            }`}
          >
            <div className="flex items-start gap-2.5">
              <span
                className={`mt-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded ${
                  iss.blocksTransition
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                    : "bg-neutral-800 text-neutral-400"
                }`}
              >
                {iss.blocksTransition ? "必填缺失" : "建議補充"}
              </span>
              <div>
                <p className="font-medium text-xs sm:text-sm">{iss.message}</p>
                <span className="text-[11px] text-neutral-400">
                  欄位錨點: <code className="font-mono text-amber-300/80">{iss.fieldRef}</code>
                </span>
              </div>
            </div>

            <button
              onClick={() => onNavigateToIssue?.(iss)}
              className="self-end sm:self-center px-3 py-1 text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md transition-colors flex items-center gap-1 shrink-0"
            >
              <span>前往補齊</span>
              <span>→</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
