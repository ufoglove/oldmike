import { NextRequest, NextResponse } from "next/server";
import { runRouteReviewLogicCheck, buildStage09HandoffSnapshot } from "@/lib/route-review-compliance-service";
import { type RouteReviewWorkspace } from "@/lib/route-review-compliance-contract";
import { type RouteWorkspaceSnapshot } from "@/lib/route-studio-contract";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { workspace, routeSnapshot } = body as {
      workspace: RouteReviewWorkspace;
      routeSnapshot: RouteWorkspaceSnapshot;
    };

    if (!workspace || !routeSnapshot) {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD", message: "必須提供完整的 workspace 與 routeSnapshot" },
        { status: 400 }
      );
    }

    // Run Review & Compliance Logic Check
    const issues = runRouteReviewLogicCheck(workspace);
    const fatalIssues = issues.filter((i) => i.severity === "FATAL");

    if (fatalIssues.length > 0) {
      return NextResponse.json(
        {
          error: "FATAL_COMPLIANCE_ERRORS",
          message: "存在重大合規或倫理風險尚未緩解，無法完成交接",
          fatalIssues,
        },
        { status: 422 }
      );
    }

    const snapshot = buildStage09HandoffSnapshot({
      workspace,
      routeSnapshot,
    });

    return NextResponse.json({
      success: true,
      snapshot,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "COMPLETE_FAILED", message: error.message || "完成第九階段交接快照失敗" },
      { status: 500 }
    );
  }
}
