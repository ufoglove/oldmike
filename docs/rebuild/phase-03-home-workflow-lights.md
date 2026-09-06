# Phase 03 Home Workflow Lights (V3-U03-R2 Batch B)

Spec: v3.3.0 (V3-U03-R2) — Section 5, 6, 7
Verified date: 2026-09-06 (UTC).

## Delivered

1. **`lib/research-workflow-registry.ts`** (commit `a904fc8`)
   - Three-route workflow templates: JOURNAL_SCI_SSCI (20 nodes), NSTC_GENERAL (19), MOE_TPR (19).
   - Shared COMMON backbone: 研究目標與背景 → 前沿雷達(可選) → 一鍵靈感(可選) → 選題實驗室 → 投稿與計畫導航 → 研究藍圖 → 文獻深化/Gap → 理論與機制(適用時) → 研究設計與分析規劃.
   - Stable node_ids + prerequisites + gates (no pageIndex+1).
   - 10 node states incl. COMPLETED_VALID, STALE, NOT_APPLICABLE, MODULE_UNAVAILABLE.
   - `computeWorkflowProgress()` per spec §6: required-only completion rate, optional separate, unbuilt stays in denominator, shared counted once, awaiting/blocked/unbuilt counters.

2. **`components/ResearchWorkflowLightPanel.tsx`** (commit `2b95437`)
   - Renders route template nodes with 10-state lights (text + icon + color; color never sole indicator).
   - Graph (grid) + list dual view; ARIA list/listitem labels.
   - Next-step panel navigable; AWAITING_INPUT nodes show "前往補足 →".
   - Green light ONLY from COMPLETED_VALID (back-end completion snapshot semantics); opening page / save / lock / build test never lights a node.

3. **`components/GuidedResearchCenter.tsx`** — integrated into home `renderOverview` after Home2WorkbenchOverview; goal derived from project outputTrack (fallback JOURNAL_SCI_SSCI); onNavigate maps nodeId → station navId.

## Verification
- Contract tests: `scripts/verify-stage03-r2-batch-b.ts` 18/18 PASS.
- Typecheck: `npx tsc --noEmit` 0 errors.
- Honest limits: progress prop is currently `[]` from home (real completion wiring comes from stage-operation snapshots in Batch C/D); the panel renders all nodes as NOT_STARTED until real snapshot data flows in. No fabricated green lights.
