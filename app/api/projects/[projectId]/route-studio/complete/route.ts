import { NextRequest, NextResponse } from "next/server";
import { runDraftAlignmentCheck, buildRouteWorkspaceSnapshot } from "@/lib/route-studio-service";
import { type RouteWorkspace } from "@/lib/route-studio-contract";
import { type DesignAnalysisPlanningSnapshot } from "@/lib/study-design-planning-contract";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { workspace, designSnapshot } = body as {
      workspace: RouteWorkspace;
      designSnapshot: DesignAnalysisPlanningSnapshot;
    };

    if (!workspace || !designSnapshot) {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD", message: "必須提供完整的 workspace 與 designSnapshot" },
        { status: 400 }
      );
    }

    // Run Draft Alignment Check
    const findings = runDraftAlignmentCheck(workspace);
    const fatalErrors = findings.filter((f) => f.severity === "FATAL");

    if (fatalErrors.length > 0) {
      return NextResponse.json(
        {
          error: "FATAL_ALIGNMENT_ERRORS",
          message: "存在重大草稿矛盾或虛構內容，無法完成交接",
          fatalErrors,
        },
        { status: 422 }
      );
    }

    const snapshot = buildRouteWorkspaceSnapshot({
      workspace,
      designSnapshot,
    });

    return NextResponse.json({
      success: true,
      snapshot,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "COMPLETE_FAILED", message: error.message || "完成交接快照失敗" },
      { status: 500 }
    );
  }
}
