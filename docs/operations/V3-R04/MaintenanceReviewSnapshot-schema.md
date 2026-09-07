# MaintenanceReviewSnapshot Schema 與下游相容性

## 1. Schema 定義與契約標準
- **契約版本**：`maintenance-review/3.4.0`
- **主要型別**：`MaintenanceReviewSnapshot`（定義於 `lib/maintenance-review-v3-contract.ts`）
- **關聯上游**：
  * `upstreamRealProjectDeliveryRef`（引用 R03 採用快照 ID）
  * `upstreamRealProjectDeliveryDigest`（SHA-256 雜湊校驗）
  * `productionLaunchRef`（引用 R02 正式上線快照 ID）

## 2. 契約欄位結構
```typescript
export type MaintenanceReviewSnapshot = {
  schemaVersion: "maintenance-review/3.4.0";
  snapshotId: string;
  taskKey: "V3-R04";

  upstreamRealProjectDeliveryRef: string;
  upstreamRealProjectDeliveryDigest: string;
  productionLaunchRef: string;
  observedReleaseConfigPromptRefs: string[];

  maintenanceWorkOrderRef: string;
  maintenanceWorkOrderRevision: number;
  maintenanceAuthorizationRef: string;

  allowedObservationScope: string;
  allowedProjectDocumentRefs: string[];

  windowStartUtc: string;
  windowEndUtc: string;
  sourceCutoff: string;
  eventManifestRef: string;

  coverageStatus: "FULL_COVERAGE" | "TELEMETRY_GAP" | "MONITORING_UNKNOWN" | "INSUFFICIENT_OBSERVATION";
  eligibleWorkOrderCount: number;
  unknownEventCount: number;

  metricDefinitionRefs: string[];
  serviceMetricRollupRefs: ServiceMetricEntry[];
  sloPolicyRef: string;

  researchIntegrityCheckRefs: string[];
  semanticReviewRefs: string[];
  humanAdjudicationRefs: string[];

  evaluationSuiteRef: string;
  baselineCandidateRefs: string[];
  evalDataPurpose: string;
  holdoutExposureRef: string;

  providerCapabilityRefs: string[];
  sourceChangeImpactRefs: string[];
  officialRuleCheckRefs: string[];

  costActualRefs: string[];
  costEstimateRefs: string[];
  costUnreconciledRefs: string[];

  incidentIssueRefs: string[];
  dispositionRefs: string[];
  affectedScopeRestrictions: string[];

  patchManifestRefs: string[];
  releaseStatus: MaintenancePatchStatus;
  releaseEvidenceRefs: string[];

  backupCheckRef: string;
  recoveryVerificationRef: string;
  permissionsCheckRefs: string[];

  maintenancePolicyRef: string;
  policyAdoptionRef: string;
  ownerRef: string;

  scheduleState: MaintenanceWorkOrder["scheduleState"];
  scheduleAuthorizationRef: string | null;
  actualScheduleRunRefs: string[];

  notificationScopeRef: string;
  pendingObservationItems: string[];
  remainingResearchActions: string[];

  reviewDisposition: "MAINTENANCE_REVIEW_AND_CONTROL_HANDOFF_COMPLETE" | "UPSTREAM_EVIDENCE_PENDING" | "MAINTENANCE_POLICY_READY_AWAITING_OWNER_APPROVAL";
  controlValidationStatus: "PASSED" | "INSUFFICIENT_EVIDENCE";
  operatingHealthStatus: "WITHIN_CONFIRMED_TARGET" | "DEGRADED" | "INCIDENT_OPEN" | "INSUFFICIENT_OBSERVATION" | "UNKNOWN";

  sourceLockManifestRef: string;
  auditRefs: string[];
  createdBy: string;
  createdAt: string;

  // 嚴格安全約束：永久禁止自動越權
  engineeringProgressNotInResearchDenominator: true;
  rawResearchFactMutationAuthorized: false;
  submissionPaymentPublicationAuthorized: false;
  unspecifiedProductionChangeAuthorized: false;
};
```

## 3. 冪等性與 ACL 驗證規則
- **冪等性**：相同 `snapshotId` 且內容相同（Digest 一致）時，返回已存在之快照；若相同 ID 內容不同，後端直接拒絕寫入。
- **ACL 邊界**：Consumer 解析時僅能讀取其具備權限之欄位，未授權者不可透過快照解引用取得私稿全文或金鑰憑證。
- **無損下游相容**：下游各模組（原研究首頁、管理後台、備份系統）可直接消費本快照，無需調整資料表結構。
