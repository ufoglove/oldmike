import { NextRequest, NextResponse } from "next/server";
import { buildRouteWorkspaceFromDesign } from "@/lib/route-studio-service";
import { type DesignAnalysisPlanningSnapshot } from "@/lib/study-design-planning-contract";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { designSnapshot, workspaceId = `ws_route_${projectId}` } = body as {
      designSnapshot: DesignAnalysisPlanningSnapshot;
      workspaceId?: string;
    };

    if (!designSnapshot || !designSnapshot.snapshotId) {
      return NextResponse.json(
        { error: "MISSING_DESIGN_SNAPSHOT", message: "必須提供有效的 DesignAnalysisPlanningSnapshot 以初始化工作室" },
        { status: 400 }
      );
    }

    if (designSnapshot.projectId !== projectId) {
      return NextResponse.json(
        { error: "PROJECT_ID_MISMATCH", message: "快照專案 ID 與當前路由不符" },
        { status: 403 }
      );
    }

    const workspace = buildRouteWorkspaceFromDesign({
      workspaceId,
      projectId,
      designSnapshot,
    });

    return NextResponse.json({
      success: true,
      workspace,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "INITIALIZE_FAILED", message: error.message || "初始化三路線工作室失敗" },
      { status: 500 }
    );
  }
}
