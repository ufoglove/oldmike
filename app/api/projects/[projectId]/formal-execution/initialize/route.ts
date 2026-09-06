import { NextRequest, NextResponse } from "next/server";
import { buildFormalExecutionWorkspaceFromStage11 } from "@/lib/formal-execution-service";
import { type PilotValidationSnapshot } from "@/lib/pilot-validation-contract";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { pilotSnapshot, workspaceId = `ws_exec_${projectId}` } = body as {
      pilotSnapshot: PilotValidationSnapshot;
      workspaceId?: string;
    };

    if (!pilotSnapshot || !pilotSnapshot.snapshotId) {
      return NextResponse.json(
        { error: "MISSING_PILOT_SNAPSHOT", message: "必須提供有效的 PilotValidationSnapshot 以初始化正式執行工作區" },
        { status: 400 }
      );
    }

    if (pilotSnapshot.projectId !== projectId) {
      return NextResponse.json(
        { error: "PROJECT_ID_MISMATCH", message: "快照專案 ID 與當前路由不符" },
        { status: 403 }
      );
    }

    const workspace = buildFormalExecutionWorkspaceFromStage11({
      workspaceId,
      projectId,
      pilotSnapshot,
    });

    return NextResponse.json({
      success: true,
      workspace,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "INITIALIZE_FAILED", message: error.message || "初始化正式執行工作區失敗" },
      { status: 500 }
    );
  }
}
