# Phase 03 Research Goal Registry (V3-U03-R2 Batch A)

Spec: v3.3.0 (V3-U03-R2) — Section 2, 3, 4
Verified date: 2026-09-06 (UTC).

## Single Source of Truth: Three Primary Goals

All goal selections across the site now originate from `lib/research-goal-registry.ts`:

1. **`JOURNAL_SCI_SSCI`**：SCI／SSCI 國際期刊論文
   - 核心產出：期刊研究規劃、實證或適用文章類型稿件、投稿包
   - 預設 publicationIntent: JOURNAL, fundingIntent: NONE
2. **`NSTC_GENERAL`**：國科會一般研究計畫
   - 核心產出：一般研究計畫學門規劃、計畫書、經費及申請附件
   - 預設 fundingIntent: NSTC_GENERAL, publicationIntent: DEFERRED
3. **`MOE_TPR`**：教育部教學實踐研究計畫
   - 核心產出：課程問題、教學介入與評量、計畫書、授課及申請附件
   - 預設 fundingIntent: MOE_TPR, publicationIntent: DEFERRED
   - 要求 `requiresCourseProfile: true`

## Resolved Discrepancies (Spec §2 & §4)
- **Fixed missing MOE_TPR in one-click inspiration**: `lib/one-click-inspiration-contract.ts` added `MOE_TPR` to `RESEARCH_GOALS` enum.
- **Removed duplicate array in UI**: `components/OneClickInspiration.tsx` now imports from `ResearchGoalRegistry`.
- **Legacy Migration**: `migrateLegacyGoal()` maps old values ("科技部計畫", "教育部計畫", "SSCI", "SCI") while preserving `rawLegacyValue` (Spec §3).

## Verification
- Automated test: `scripts/verify-stage03-r2-batch-a.ts` (15/15 PASS).
- TypeScript check: `npx tsc --noEmit` (0 errors).
- Commit: `dcb95a5`.
