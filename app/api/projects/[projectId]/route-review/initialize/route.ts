import { NextRequest, NextResponse } from "next/server";
import { buildRouteReviewWorkspaceFromRoute } from "@/lib/route-review-compliance-service";
import { type RouteWorkspaceSnapshot } from "@/lib/route-studio-contract";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { routeSnapshot, workspaceId = `ws_review_${projectId}` } = body as {
      routeSnapshot: RouteWorkspaceSnapshot;
      workspaceId?: string;
    };

    if (!routeSnapshot || !routeSnapshot.snapshotId) {
      return NextResponse.json(
        { error: "MISSING_ROUTE_SNAPSHOT", message: "必須提供有效的 RouteWorkspaceSnapshot 以初始化審查工作區" },
        { status: 400 }
      );
    }

    if (routeSnapshot.projectId !== projectId) {
      return NextResponse.json(
        { error: "PROJECT_ID_MISMATCH", message: "快照專案 ID 與當前路由不符" },
        { status: 403 }
      );
    }

    const workspace = buildRouteReviewWorkspaceFromRoute({
      workspaceId,
      projectId,
      routeSnapshot,
    });

    return NextResponse.json({
      success: true,
      workspace,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "INITIALIZE_FAILED", message: error.message || "初始化路線審查與倫理工作區失敗" },
      { status: 500 }
    );
  }
}
