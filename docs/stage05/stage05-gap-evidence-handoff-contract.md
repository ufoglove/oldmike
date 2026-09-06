# V3-U05-FULL 第五至第六階段交接契約 (Gap Evidence Handoff Contract)

**工程識別：V3-U05-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、不可變交接快照契約 (`GapEvidenceSnapshot`)

```typescript
export interface GapEvidenceSnapshot {
  snapshotId: string;                              // e.g. ges_proj_stage5_eval_1757138000
  schemaVersion: "gap-evidence/1.0.0";            // 版本固定
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "gap-novelty";
  nextStageId: "theory-mechanism";                 // 指向第六階段：理論與機制
  sourceBlueprintSnapshotId: string;
  goalContextRevision: number;
  primaryGoal: "JOURNAL_SCI_SSCI" | "NSTC_GENERAL" | "MOE_TPR";
  fundingIntent: string;
  publicationIntent: string;

  reviewId: string;
  reviewRevision: number;
  reviewDecision: "RETAIN_DIRECTION" | "REFINE_WITH_ACCEPTED_CHANGES" | "PROVISIONAL_EXPLORATION" | "RECONSIDER_TOPIC" | "INSUFFICIENT_EVIDENCE";
  decisionRationale: string;
  evidenceSufficiency: "SUFFICIENT" | "PARTIAL" | "INSUFFICIENT";
  noveltyAssessment: string;

  // 核心範圍
  scope: {
    workingTitleZh: string;
    workingTitleEn: string;
    overallPurpose: string;
  };

  // 關聯與參照
  rqRefs: string[];
  evidenceNeedRefs: string[];
  fulfilledNeedRefs: string[];
  literatureIds: string[];
  studyFamilyRefs: string[];
  gapClaimRefs: string[];
  closestStudyRefs: string[];
  contributionDeltaRefs: string[];
  counterevidenceRefs: string[];

  // 晚期需求
  downstreamRequirements: DownstreamRequirementItem[];
  duePhases: string[];

  // 理論與機制提示（交由 Stage 6 承接）
  theoryEvidenceNeedRefs: string[];
  candidateTheories: string[];
  competingExplanationHints: string[];

  limitations: string[];
  checksum: string;
  createdAt: string;
}
```

## 二、第六階段消費者契約保證 (Consumer Contract Guarantees)

1. **零重複輸入**：第六階段直接自快照讀取 `scope.workingTitleZh`, `rqRefs`, `candidateTheories`，不要求重新設定研究主題。
2. **理論線索傳遞**：第六階段直接承接 `competingExplanationHints`（如霍桑效應、注意力分散等替代解釋）進行機制構建。
3. **安全冪等**：重複呼叫 `POST /api/projects/:id/gap-novelty/complete` 回傳既有 snapshot ID，不重複扣費或產生分歧快照。
