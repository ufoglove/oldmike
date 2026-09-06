import { NextRequest, NextResponse } from "next/server";
import { buildPilotValidationWorkspaceFromStage10 } from "@/lib/pilot-validation-service";
import { type InstrumentProtocolSnapshot } from "@/lib/instrument-protocol-contract";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { instrumentSnapshot, workspaceId = `ws_pilot_${projectId}` } = body as {
      instrumentSnapshot: InstrumentProtocolSnapshot;
      workspaceId?: string;
    };

    if (!instrumentSnapshot || !instrumentSnapshot.snapshotId) {
      return NextResponse.json(
        { error: "MISSING_INSTRUMENT_SNAPSHOT", message: "必須提供有效的 InstrumentProtocolSnapshot 以初始化 Pilot 工作區" },
        { status: 400 }
      );
    }

    if (instrumentSnapshot.projectId !== projectId) {
      return NextResponse.json(
        { error: "PROJECT_ID_MISMATCH", message: "快照專案 ID 與當前路由不符" },
        { status: 403 }
      );
    }

    const workspace = buildPilotValidationWorkspaceFromStage10({
      workspaceId,
      projectId,
      instrumentSnapshot,
    });

    return NextResponse.json({
      success: true,
      workspace,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "INITIALIZE_FAILED", message: error.message || "初始化 Pilot 驗證工作區失敗" },
      { status: 500 }
    );
  }
}
