import { NextResponse } from "next/server";
import { makePreviewHash, makeProjectId } from "@/lib/project-id";
import { normalizeS0Intake, type ProjectPreview } from "@/lib/project-contract";
import { requirePortalSession } from "@/lib/request-auth";

export async function POST(request: Request) {
  const authFailure = await requirePortalSession();
  if (authFailure) return authFailure;
  const parsed = await request.json().catch(() => null);
  const result = normalizeS0Intake(parsed && typeof parsed === "object" && "intake" in parsed ? (parsed as { intake?: unknown }).intake : parsed);
  if (!result.ok) return NextResponse.json({ ok: false, code: "invalid_intake", error: result.error, fieldErrors: result.fieldErrors }, { status: 400 });

  const projectId = makeProjectId(result.value);
  const preview: ProjectPreview = {
    projectId,
    path: `projects/active/${projectId}`,
    workingTitle: result.value.workingTitle,
    domain: result.value.domain,
    outputTrack: result.value.outputTrack,
    currentStage: "S0_INTAKE",
    nextGate: "define_project_charter",
    recommendedAction: "確認這份 S0 Intake，之後由 Portal 以單一資料庫交易建立正式專案。",
    evidenceStatus: "UNVERIFIED",
    riskStatus: "UNVERIFIED",
    humanGateStatus: "REQUIRED",
    known: [
      `USER_PROVIDED｜暫定研究題目：${result.value.workingTitle}`,
      `USER_PROVIDED｜研究領域：${result.value.domain}`,
      `USER_PROVIDED｜主成果路徑：${result.value.outputTrack}`,
      "SYSTEM_VERIFIED｜Project ID 由 Portal 依完整 Intake deterministic 產生。",
    ],
    unknown: [
      "研究問題、研究缺口與外部證據尚未經 fresh verification。",
      "資料可得性、樣本／場域與方法可行性尚未由研究者與正式證據確認。",
    ],
    assumptions: ["本次欄位內容均視為研究者提供的待核對輸入，不視為已驗證研究證據。"],
    risks: [result.value.ethicsPrivacyRisks, "尚未完成正式倫理、隱私、授權與資料治理審查。"],
      humanConfirmations: ["確認研究題目、領域、成果路徑與 Intake 內容無誤。", "確認正式資料寫入 Portal/PostgreSQL，且不建立或覆蓋共享專案檔案。"],
    artifactPaths: ["portal-db:research_documents/s0-intake"],
    previewHash: makePreviewHash(result.value, projectId),
    source: "preview",
  };
  return NextResponse.json({ ok: true, preview }, { headers: { "Cache-Control": "no-store" } });
}
