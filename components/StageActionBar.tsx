"use client";

import React from "react";
import { StageReadinessSnapshot } from "@/lib/stage-operation-contracts";

interface StageActionBarProps {
  stageName: string;
  readiness: StageReadinessSnapshot | null;
  isLoading?: boolean;
  onProceed?: () => void;
  onAutoFillBlanks?: () => void;
  onOptimizeUnlocked?: () => void;
  onFillAndLock?: () => void;
}

export const StageActionBar: React.FC<StageActionBarProps> = ({
  stageName,
  readiness,
  isLoading = false,
  onProceed,
  onAutoFillBlanks,
  onOptimizeUnlocked,
  onFillAndLock,
}) => {
  const canProceed = readiness?.canProceed ?? false;
  const blockingCount = readiness?.blockingIssues?.length ?? 0;
  const nextStageLabel = readiness?.nextStageLabel || "下一研究階段";

  return (
    <div className="sticky bottom-4 z-30 w-full mt-8">
      <div className="rounded-2xl border border-neutral-700/60 bg-neutral-900/90 backdrop-blur-md p-4 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left: AI batch actions */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={onAutoFillBlanks}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs font-medium text-sky-200 bg-sky-950/40 hover:bg-sky-900/60 border border-sky-500/30 rounded-lg transition-colors flex items-center gap-1.5"
            title="只補齊未填寫的空白欄位，保留已鎖定與人工輸入內容"
          >
            <span>✨</span>
            <span>老麥一鍵補空白</span>
          </button>

          <button
            onClick={onOptimizeUnlocked}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs font-medium text-purple-200 bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 rounded-lg transition-colors flex items-center gap-1.5"
            title="優化未鎖定內容的語氣與嚴謹度"
          >
            <span>🪄</span>
            <span>優化未鎖定內容</span>
          </button>

          <button
            onClick={onFillAndLock}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs font-medium text-emerald-200 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 rounded-lg transition-colors flex items-center gap-1.5"
            title="補齊合規欄位並加上保護鎖"
          >
            <span>🔒</span>
            <span>補全並鎖定</span>
          </button>
        </div>

        {/* Right: Stage Advancement Status & Next Button */}
        <div className="flex items-center justify-end gap-4 w-full md:w-auto">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-neutral-300">
              {stageName} 階段完成度
            </div>
            <div className="text-[11px] text-neutral-400">
              {canProceed ? (
                <span className="text-emerald-400 font-medium">✅ 所有必填條件已達成</span>
              ) : (
                <span className="text-amber-400 font-medium">⚠️ 尚餘 {blockingCount} 個必填缺項</span>
              )}
            </div>
          </div>

          <button
            onClick={onProceed}
            disabled={!canProceed || isLoading}
            className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center gap-2 shadow-lg ${
              canProceed
                ? "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white cursor-pointer hover:shadow-emerald-500/20"
                : "bg-neutral-800 text-neutral-500 border border-neutral-700/50 cursor-not-allowed opacity-75"
            }`}
          >
            <span>前進：{nextStageLabel}</span>
            <span>➔</span>
          </button>
        </div>
      </div>
    </div>
  );
};
