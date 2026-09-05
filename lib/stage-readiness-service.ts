/**
 * Stage Readiness Service (V3-U02-R1)
 *
 * Implements Section 4 & 15 of the V3.1 spec:
 * Evaluates whether a stage satisfies minimum requirements to proceed to the next stage.
 * Never allows AI free-text to bypass programmatic gate criteria.
 */

import { Pool } from "pg";
import type {
  StageId,
  StageReadinessSnapshot,
  RequirementIssue,
} from "./stage-operation-contracts.ts";
import { StageOperationRepository } from "./stage-operation-repository.ts";

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 })
  : null;

async function query<T extends object = Record<string, any>>(text: string, params?: unknown[]) {
  if (!pool) throw new Error("stage_readiness_storage_unavailable");
  return pool.query(text, params);
}

export class StageReadinessService {
  /**
   * Evaluate readiness for Exploration Stage 2 (Topic Lab & Selection)
   */
  static async evaluateTopicLabReadiness(
    workspaceId: string,
    projectId: string
  ): Promise<StageReadinessSnapshot> {
    const issues: Omit<RequirementIssue, "issueId" | "evaluatedAt">[] = [];

    // 1. Fetch current project state
    const projRes = await pool!.query(
      `SELECT * FROM projects WHERE workspace_id = $1 AND project_id = $2`,
      [workspaceId, projectId]
    );
    if (projRes.rows.length === 0) {
      throw new Error(`Project ${projectId} not found in workspace ${workspaceId}`);
    }
    const project = projRes.rows[0];

    // 2. Fetch project draft meta directly from projects.project_draft
    const metaRes = await pool!.query(
      `SELECT project_draft FROM projects WHERE workspace_id = $1 AND project_id = $2`,
      [workspaceId, projectId]
    ).catch(() => ({ rows: [] }));
    const meta = metaRes.rows[0]?.project_draft || {};

    const activeTopic = meta.selectedTopic || meta.activeTopic || {};

    // Check Requirement 1: Research Question (Mandatory, blocks transition)
    const rq = activeTopic.researchQuestion || activeTopic.rq || "";
    if (!rq || rq.trim().length < 10) {
      issues.push({
        projectId,
        stageId: "topic-lab",
        requirementId: "topic_lab.research_question",
        entityId: activeTopic.id || "default",
        fieldRef: "research_question",
        status: "MISSING",
        blocksTransition: true,
        message: "尚未填寫明確且可回答的主要研究問題 (RQ)",
        destination: {
          routeId: "topic-lab",
          tabId: "core",
          anchor: "field-research-question",
          fieldRef: "research_question",
        },
        assistActions: ["EXPLAIN", "DRAFT_FROM_CONTEXT", "POLISH"],
        requiresUserFact: false,
      });
    }

    // Check Requirement 2: Research Gap Statement (Mandatory, blocks transition)
    const gap = activeTopic.gapStatement || activeTopic.gap || "";
    if (!gap || gap.trim().length < 10) {
      issues.push({
        projectId,
        stageId: "topic-lab",
        requirementId: "topic_lab.gap_statement",
        entityId: activeTopic.id || "default",
        fieldRef: "gap_statement",
        status: "MISSING",
        blocksTransition: true,
        message: "尚未標註具體的研究缺口 (Research Gap) 或核心矛盾",
        destination: {
          routeId: "topic-lab",
          tabId: "gap",
          anchor: "field-gap-statement",
          fieldRef: "gap_statement",
        },
        assistActions: ["FIND_GAP", "DRAFT_FROM_CONTEXT"],
        requiresUserFact: false,
      });
    }

    // Check Requirement 3: Expected Contribution (Mandatory)
    const contribution = activeTopic.expectedContribution || activeTopic.contribution || "";
    if (!contribution || contribution.trim().length < 10) {
      issues.push({
        projectId,
        stageId: "topic-lab",
        requirementId: "topic_lab.contribution",
        entityId: activeTopic.id || "default",
        fieldRef: "contribution",
        status: "MISSING",
        blocksTransition: true,
        message: "尚未具體陳述本研究的預期學術或實務貢獻",
        destination: {
          routeId: "topic-lab",
          tabId: "core",
          anchor: "field-contribution",
          fieldRef: "contribution",
        },
        assistActions: ["DRAFT_FROM_CONTEXT", "POLISH"],
        requiresUserFact: false,
      });
    }

    // Check Requirement 4: Methodology Direction (Non-blocking warning)
    const method = activeTopic.methodologyOverview || activeTopic.method || "";
    if (!method) {
      issues.push({
        projectId,
        stageId: "topic-lab",
        requirementId: "topic_lab.methodology_direction",
        entityId: activeTopic.id || "default",
        fieldRef: "methodology_direction",
        status: "MISSING",
        blocksTransition: false, // Advisory only, doesn't block exploration exit
        message: "建議補充初步研究設計或方法方向，以利下游研究藍圖開展",
        destination: {
          routeId: "topic-lab",
          tabId: "method",
          anchor: "field-methodology",
          fieldRef: "methodology_direction",
        },
        assistActions: ["DRAFT_FROM_CONTEXT", "EXPLAIN"],
        requiresUserFact: false,
      });
    }

    // Persist issues into repository
    const savedIssues = await StageOperationRepository.syncRequirementIssues(
      workspaceId,
      projectId,
      "topic-lab",
      issues
    );

    const blocking = savedIssues.filter((i) => i.blocksTransition);
    const nonBlocking = savedIssues.filter((i) => !i.blocksTransition);

    return {
      stageId: "topic-lab",
      projectId,
      isReady: blocking.length === 0,
      canProceed: blocking.length === 0,
      totalRequirements: 4,
      satisfiedRequirements: 4 - blocking.length,
      blockingIssues: blocking,
      nonBlockingIssues: nonBlocking,
      nextStageId: "blueprint",
      nextStageLabel: "研究藍圖 (Research Blueprint)",
      evaluatedAt: new Date().toISOString(),
    };
  }
}
