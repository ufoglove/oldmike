import { NextRequest, NextResponse } from "next/server";
import { buildInstrumentProtocolWorkspaceFromStage09 } from "@/lib/instrument-protocol-service";
import { type Stage09HandoffSnapshot } from "@/lib/route-review-compliance-contract";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { stage09Snapshot, workspaceId = `ws_inst_${projectId}` } = body as {
      stage09Snapshot: Stage09HandoffSnapshot;
      workspaceId?: string;
    };

    if (!stage09Snapshot || !stage09Snapshot.snapshotId) {
      return NextResponse.json(
        { error: "MISSING_STAGE09_SNAPSHOT", message: "必須提供有效的 Stage09HandoffSnapshot 以初始化工具工作區" },
        { status: 400 }
      );
    }

    if (stage09Snapshot.projectId !== projectId) {
      return NextResponse.json(
        { error: "PROJECT_ID_MISMATCH", message: "快照專案 ID 與當前路由不符" },
        { status: 403 }
      );
    }

    const workspace = buildInstrumentProtocolWorkspaceFromStage09({
      workspaceId,
      projectId,
      stage09Snapshot,
    });

    return NextResponse.json({
      success: true,
      workspace,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "INITIALIZE_FAILED", message: error.message || "初始化工具與 Protocol 工作區失敗" },
      { status: 500 }
    );
  }
}
