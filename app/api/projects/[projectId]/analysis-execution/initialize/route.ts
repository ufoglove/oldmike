import { NextRequest, NextResponse } from "next/server";
import { buildAnalysisExecutionWorkspaceFromStage13 } from "@/lib/analysis-execution-service";
import { type DataGovernanceSnapshot } from "@/lib/data-governance-contract";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { governanceSnapshot, workspaceId = `ws_anal_${projectId}` } = body as {
      governanceSnapshot: DataGovernanceSnapshot;
      workspaceId?: string;
    };

    if (!governanceSnapshot || !governanceSnapshot.snapshotId) {
      return NextResponse.json(
        { error: "MISSING_GOVERNANCE_SNAPSHOT", message: "必須提供有效的 DataGovernanceSnapshot 以初始化分析實驗室工作區" },
        { status: 400 }
      );
    }

    if (governanceSnapshot.projectId !== projectId) {
      return NextResponse.json(
        { error: "PROJECT_ID_MISMATCH", message: "快照專案 ID 與當前路由不符" },
        { status: 403 }
      );
    }

    const workspace = buildAnalysisExecutionWorkspaceFromStage13({
      workspaceId,
      projectId,
      governanceSnapshot,
    });

    return NextResponse.json({
      success: true,
      workspace,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "INITIALIZE_FAILED", message: error.message || "初始化分析實驗室工作區失敗" },
      { status: 500 }
    );
  }
}
