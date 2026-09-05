import "server-only";

import { Pool, type PoolClient } from "pg";
import type { ResearchTenant } from "./research-repository.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;
async function withClient<T>(operation: (client: PoolClient) => Promise<T>) {
  if (!pool) throw new Error("overview_progress_storage_unavailable");
  const client = await pool.connect();
  try { return await operation(client); } finally { client.release(); }
}
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function tenantWhere(alias = ""): string { const p = alias ? `${alias}.` : ""; return `${p}workspace_id=$1 AND ${p}project_id=$2`; }
type Row = Record<string, unknown>;
async function one(client: PoolClient, sql: string, params: unknown[]): Promise<Row | null> {
  const r = await client.query(sql, params);
  return (r.rows[0] as Row) ?? null;
}
async function countOne(client: PoolClient, sql: string, params: unknown[]): Promise<number> {
  const r = await client.query(sql, params);
  return Number(r.rows[0]?.n ?? 0);
}

export type OverviewMilestoneKey =
  | "research_project"
  | "navigator_run"
  | "blueprint_approved"
  | "gap_validated"
  | "theory_approved"
  | "design_approved"
  | "route_approved"
  | "ethics_determined"
  | "instruments_approved"
  | "pilot_ready"
  | "raw_data_locked"
  | "manuscript_complete"
  | "scientific_approved"
  | "language_approved";

export type OverviewMilestone = {
  key: OverviewMilestoneKey;
  label: string;
  stageTag: string;
  navId: string;
  note: string;
  cta: string;
  done: boolean;
};

const MILESTONE_DEFS: ReadonlyArray<{
  key: OverviewMilestoneKey;
  label: string;
  stageTag: string;
  navId: string;
  note: string;
  cta: string;
}> = [
  { key: "research_project", label: "建立正式研究專案", stageTag: "S1", navId: "quick-start", note: "尚無正式研究專案（research project）。請在投稿與計畫導航完成一次分析，或於智慧建立專案確認 S0 後建立。", cta: "前往建立研究專案" },
  { key: "navigator_run", label: "完成投稿／計畫導航分析", stageTag: "S1", navId: "navigator", note: "尚未完成任何投稿或計畫導航分析。請執行一次分析以對照期刊、學門與資格。", cta: "前往投稿與計畫導航" },
  { key: "blueprint_approved", label: "研究藍圖核准", stageTag: "S1", navId: "blueprint", note: "研究藍圖尚未核准。請補齊藍圖 12 項 Gate（題目、Gap、RQ、方法…）後按「核准」。", cta: "前往研究藍圖補齊" },
  { key: "gap_validated", label: "Gap 與新穎性驗證", stageTag: "S2", navId: "gap", note: "Gap 尚未驗證（需 VALIDATED）。請在 Gap 與新穎性 Lab 建立 Gap Claims、連結證據並通過 Gate。", cta: "前往 Gap 與新穎性" },
  { key: "theory_approved", label: "理論與機制鎖定", stageTag: "S3", navId: "theory", note: "理論與機制尚未鎖定（需 APPROVED）。請建立候選理論、補齊機制模型與假設後鎖定。", cta: "前往理論與機制" },
  { key: "design_approved", label: "研究設計核准", stageTag: "S4", navId: "design", note: "研究設計尚未核准（需 APPROVED）。請完成 RQ 矩陣、分析計畫與 15 項 Gate 後核准。", cta: "前往研究設計" },
  { key: "route_approved", label: "研究路線 Gate 核准", stageTag: "S5", navId: "route-workspace", note: "研究路線（期刊／NSTC／MOE）尚未核准。請補齊路線段落並通過 Gate。", cta: "前往研究路線工作室" },
  { key: "ethics_determined", label: "倫理範圍確定", stageTag: "S5", navId: "ethics-center", note: "倫理範圍（ETHICS_SCOPE_DETERMINED）尚未核准。請完成範圍初篩、風險清單、DMP 與 Readiness 後核准。", cta: "前往研究倫理／IRB 中心" },
  { key: "instruments_approved", label: "工具與 Protocol 核准", stageTag: "S6", navId: "instruments-protocol", note: "工具與 Protocol（INSTRUMENTS_AND_PROTOCOL_APPROVED）尚未核准。請選定測量工具並完成 Protocol。", cta: "前往工具與量表 Protocol" },
  { key: "pilot_ready", label: "Pilot 驗證通過", stageTag: "S6", navId: "pilot-protocol-validation", note: "Pilot 驗證（FORMAL_STUDY_EXECUTION_READY）尚未通過。請完成前導驗證或記錄 Waiver 依據。", cta: "前往前導驗證（Pilot）" },
  { key: "raw_data_locked", label: "正式執行資料鎖定", stageTag: "S7", navId: "execution", note: "正式資料尚未鎖定（RAW_DATA_LOCKED_AND_HANDOFF_READY）。請完成收案並鎖定原始資料。", cta: "前往正式研究與執行" },
  { key: "manuscript_complete", label: "全文寫作完成", stageTag: "S8", navId: "manuscript", note: "全文稿件尚未完成（需全部章節核准）。請在全文寫作工作室完成各章節。", cta: "前往全文寫作工作室" },
  { key: "scientific_approved", label: "科學審查核准", stageTag: "S8", navId: "scientific-review", note: "老麥科學審查尚未核准（需 SCIENTIFICALLY_APPROVED）。請完成審查輪次並關閉所有 blocker。", cta: "前往老麥科學審查" },
  { key: "language_approved", label: "語言潤稿核准", stageTag: "S8", navId: "language-center", note: "語言潤稿尚未核准（需 work order APPROVED）。請完成委託、處理 findings 並通過 QA。", cta: "前往翻譯與學術潤稿" },
];

export type OverviewProgress = {
  ok: true;
  milestones: OverviewMilestone[];
  doneCount: number;
  totalCount: number;
  nextKey: OverviewMilestoneKey | null;
  projectExists: boolean;
};

export async function getOverviewProgress(tenant: ResearchTenant): Promise<OverviewProgress> {
  const result = await withClient(async (client) => {
    const [researchProjectN, navigatorN, blueprintApprovedN, gapValidatedN, theoryApprovedN, designApprovedN, routeApprovedN, ethicsN, instrumentsN, pilotN, rawDataN, manuscriptN, manuscriptIncompleteN, scientificN, languageN] = await Promise.all([
      countOne(client, `SELECT count(*)::int AS n FROM research_projects WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      countOne(client, `SELECT count(*)::int AS n FROM submission_navigator_runs WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      countOne(client, `SELECT count(*)::int AS n FROM research_blueprints WHERE ${tenantWhere()} AND status='APPROVED'`, [tenant.workspaceId, tenant.projectId]),
      countOne(client, `SELECT count(*)::int AS n FROM gap_novelty_analyses WHERE ${tenantWhere()} AND status='VALIDATED'`, [tenant.workspaceId, tenant.projectId]),
      countOne(client, `SELECT count(*)::int AS n FROM theory_mechanism_analyses WHERE ${tenantWhere()} AND status='APPROVED'`, [tenant.workspaceId, tenant.projectId]),
      countOne(client, `SELECT count(*)::int AS n FROM research_design_analyses WHERE ${tenantWhere()} AND status='APPROVED'`, [tenant.workspaceId, tenant.projectId]),
      countOne(client, `SELECT count(*)::int AS n FROM route_workspaces WHERE ${tenantWhere()} AND status='APPROVED'`, [tenant.workspaceId, tenant.projectId]),
      countOne(client, `SELECT count(*)::int AS n FROM research_human_gates WHERE ${tenantWhere()} AND gate_type='ETHICS_SCOPE_DETERMINED' AND decision='APPROVED'`, [tenant.workspaceId, tenant.projectId]),
      countOne(client, `SELECT count(*)::int AS n FROM research_human_gates WHERE ${tenantWhere()} AND gate_type='INSTRUMENTS_AND_PROTOCOL_APPROVED' AND decision='APPROVED'`, [tenant.workspaceId, tenant.projectId]),
      countOne(client, `SELECT count(*)::int AS n FROM research_human_gates WHERE ${tenantWhere()} AND gate_type='FORMAL_STUDY_EXECUTION_READY' AND decision='APPROVED'`, [tenant.workspaceId, tenant.projectId]),
      countOne(client, `SELECT count(*)::int AS n FROM research_human_gates WHERE ${tenantWhere()} AND gate_type='RAW_DATA_LOCKED_AND_HANDOFF_READY' AND decision='APPROVED'`, [tenant.workspaceId, tenant.projectId]),
      countOne(client, `SELECT count(*)::int AS n FROM manuscript_projects WHERE ${tenantWhere()} AND status IN ('DRAFT','ACTIVE')`, [tenant.workspaceId, tenant.projectId]),
      0,
      countOne(client, `SELECT count(*)::int AS n FROM scientific_review_runs WHERE ${tenantWhere()} AND status='SCIENTIFICALLY_APPROVED'`, [tenant.workspaceId, tenant.projectId]),
      countOne(client, `SELECT count(*)::int AS n FROM language_work_orders WHERE ${tenantWhere()} AND status='APPROVED'`, [tenant.workspaceId, tenant.projectId]),
    ]);
    // 稿件「完成」＝有稿件且沒有未核准章節
    let manuscriptDone = manuscriptN > 0;
    if (manuscriptN > 0) {
      const row = await one(client, `SELECT manuscript_id AS "id" FROM manuscript_projects WHERE ${tenantWhere()} AND status IN ('DRAFT','ACTIVE') ORDER BY updated_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
      const manuscriptId = text(row?.id);
      const incomplete = manuscriptId ? await countOne(client, `SELECT count(*)::int AS n FROM manuscript_sections WHERE ${tenantWhere()} AND manuscript_id=$3 AND status<>'APPROVED'`, [tenant.workspaceId, tenant.projectId, manuscriptId]) : 0;
      manuscriptDone = incomplete === 0;
    }
    const flags: Record<OverviewMilestoneKey, boolean> = {
      research_project: researchProjectN > 0,
      navigator_run: navigatorN > 0,
      blueprint_approved: blueprintApprovedN > 0,
      gap_validated: gapValidatedN > 0,
      theory_approved: theoryApprovedN > 0,
      design_approved: designApprovedN > 0,
      route_approved: routeApprovedN > 0,
      ethics_determined: ethicsN > 0,
      instruments_approved: instrumentsN > 0,
      pilot_ready: pilotN > 0,
      raw_data_locked: rawDataN > 0,
      manuscript_complete: manuscriptDone,
      scientific_approved: scientificN > 0,
      language_approved: languageN > 0,
    };
    return flags;
  });
  const milestones: OverviewMilestone[] = MILESTONE_DEFS.map((def) => ({ ...def, done: result[def.key] }));
  const doneCount = milestones.filter((m) => m.done).length;
  const next = milestones.find((m) => !m.done) ?? null;
  return {
    ok: true,
    milestones,
    doneCount,
    totalCount: milestones.length,
    nextKey: next ? next.key : null,
    projectExists: result.research_project,
  };
}
