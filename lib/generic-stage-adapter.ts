/**
 * Generic Stage Adapter & Batch Automation Engine (規格第15-18節，T15-T17, T23-T28)
 * 
 * 支援三種通用批次動作：
 * 1. FILL_BLANKS: 只補齊為空且為 AI_WRITABLE 的欄位
 * 2. OPTIMIZE_UNLOCKED: 在保留已鎖定欄位前提下，重構或優化未鎖定欄位
 * 3. FILL_AND_LOCK: 補齊空白並直接自動鎖定為 AUTO_LOCKED (標註 AI_PROPOSED，非 HUMAN_APPROVED)
 * 
 * 支援全階段通用 StageAdapter 與 TopicSelectionSnapshot 交接規格
 */

import { isFieldAiWritable } from "./field-policy-service.ts";
import { StageOperationRepository } from "./stage-operation-repository.ts";
import type {
  StageId,
  FieldLockRecord,
  TopicSelectionSnapshot,
} from "./stage-operation-contracts.ts";

export type BatchActionMode = "FILL_BLANKS" | "OPTIMIZE_UNLOCKED" | "FILL_AND_LOCK";

export interface BatchAutomationRequest {
  workspaceId: string;
  projectId: string;
  stageId: StageId;
  userId: string;
  mode: BatchActionMode;
  currentPayload: Record<string, any>;
}

export interface BatchAutomationResult {
  mode: BatchActionMode;
  updatedPayload: Record<string, any>;
  appliedPatchesCount: number;
  newLocksAcquiredCount: number;
  skippedLockedFields: string[];
  protectedFields: string[];
}

export class GenericStageAdapter {
  /**
   * T23-T28: 執行全階段通用的老麥批次自動化
   */
  static async executeBatchAction(
    req: BatchAutomationRequest
  ): Promise<BatchAutomationResult> {
    const locks = await StageOperationRepository.getFieldLocks(
      req.workspaceId,
      req.projectId,
      req.stageId
    );
    const lockMap = new Map<string, FieldLockRecord>();
    for (const l of locks) {
      lockMap.set(l.fieldRef, l);
    }

    const payload = { ...req.currentPayload };
    const skippedLockedFields: string[] = [];
    const protectedFields: string[] = [];
    let appliedPatchesCount = 0;
    let newLocksAcquiredCount = 0;

    // 定義各欄位的 AI 生成生成器（範例）
    const candidateDrafts: Record<string, string> = {
      research_question: "在智慧工安與教育場域中，結合多模態感知能否顯著縮短操作失誤反應時間？",
      gap_statement: "過往研究缺乏邊緣即時視訊與感測資料之聯邦學習實證架構。",
      expected_contribution: "提出一套具備自適應容錯機制的邊緣端智慧工安預警框架。",
      methodology_overview: "採準實驗設計與 4 組對照訓練模擬進行實測。",
      risk_mitigation: "建立模擬環境防範誤報，並採取雙盲專家評估。",
    };

    for (const [fieldRef, draftValue] of Object.entries(candidateDrafts)) {
      // 1. 檢查政策防護 (如 IRB、簽名、p-value)
      if (!isFieldAiWritable(req.stageId, fieldRef)) {
        protectedFields.push(fieldRef);
        continue;
      }

      // 2. 檢查是否已被鎖定
      if (lockMap.has(fieldRef)) {
        skippedLockedFields.push(fieldRef);
        continue; // 保留鎖定欄位，絕不覆蓋
      }

      const isCurrentEmpty = !payload[fieldRef] || String(payload[fieldRef]).trim() === "";

      // 模式 1: 僅補空白
      if (req.mode === "FILL_BLANKS" && !isCurrentEmpty) {
        continue;
      }

      // 模式 2 & 3: 更新欄位
      payload[fieldRef] = draftValue;
      appliedPatchesCount++;

      // 模式 3: 填補並自動上鎖 (AUTOMATION_POLICY 標籤)
      if (req.mode === "FILL_AND_LOCK") {
        await StageOperationRepository.acquireFieldLock({
          workspaceId: req.workspaceId,
          projectId: req.projectId,
          stageId: req.stageId,
          fieldRef,
          lockedValue: draftValue,
          userId: req.userId,
          lockPolicy: "AUTOMATION_POLICY",
        });
        newLocksAcquiredCount++;
      }
    }

    return {
      mode: req.mode,
      updatedPayload: payload,
      appliedPatchesCount,
      newLocksAcquiredCount,
      skippedLockedFields,
      protectedFields,
    };
  }

  /**
   * T15-T17: 建立合規的 TopicSelectionSnapshot (交接至投稿導航)
   */
  static buildTopicSelectionSnapshot(params: {
    workspaceId: string;
    projectId: string;
    topicId: string;
    title: string;
    rq: string;
    gapStatement: string;
    expectedContribution: string;
    methodology: string;
    userId: string;
    isHumanApproved?: boolean;
  }): TopicSelectionSnapshot {
    const selectedAt = new Date().toISOString();
    return {
      projectId: params.projectId,
      topicId: params.topicId,
      topicTitle: params.title,
      researchQuestion: params.rq,
      gapStatement: params.gapStatement,
      methodologyOverview: params.methodology,
      expectedContribution: params.expectedContribution,
      knownLimitations: [
        "Novelty claims are preliminary until a formal novelty search is confirmed.",
        "Methodology feasibility depends on actual field/center participant availability.",
      ],
      assumptions: [
        "Multimodal edge telemetry is deployable in the intended target settings.",
        "Access to representative training or operational data can be arranged.",
      ],
      risks: [
        "Data-availability delay may shift timeline; requires confirmation.",
        "Simulated-environment effects may not transfer to live operations.",
      ],
      literatureIds: [],
      citationSourceIds: [],
      sourceSnapshotIds: [],
      selectedBy: params.userId,
      // Auto/build-time adoption marks an AI-assisted DRAFT. Human approval is
      // never fabricated here; a manual click in the lab flags MANUAL_ADOPTION.
      selectionMethod: params.isHumanApproved ? "MANUAL_ADOPTION" : "AUTO_SELECTED_DRAFT",
      selectedAt,
      handoffLimitations: [
        "Novelty claims are preliminary until formal novelty (Gap) confirmation in a later stage.",
        "To avoid over-claim, VERIFIED vs UNVERIFIED evidence state is preserved into Stage 3.",
        "Methodology feasibility depends on site participant availability and resource access.",
      ],
      downstreamOpenRequirements: [
        "In Stage 3 (投稿導航): confirm target journal, output track and citation format without re-asking the topic.",
        "If human subjects are involved, prepare an ethics application draft in the specialist stage.",
      ],
      lockManifest: [
        { fieldRef: "research_question", lockVersion: 1 },
        { fieldRef: "gap_statement", lockVersion: 1 },
      ],
    };
  }
}
