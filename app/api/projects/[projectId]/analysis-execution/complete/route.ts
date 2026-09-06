import { NextRequest, NextResponse } from "next/server";
import { runAnalysisExecutionGateCheck, buildAnalysisResultsSnapshot } from "@/lib/analysis-execution-service";
import { type AnalysisExecutionWorkspace } from "@/lib/analysis-execution-contract";
import { type DataGovernanceSnapshot } from "@/lib/data-governance-contract";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { workspace, governanceSnapshot } = body as {
      workspace: AnalysisExecutionWorkspace;
      governanceSnapshot: DataGovernanceSnapshot;
    };

    if (!workspace || !governanceSnapshot) {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD", message: "必須提供完整的 workspace 與 governanceSnapshot" },
        { status: 400 }
      );
    }

    // Run Analysis Execution Gate Checks
    const issues = runAnalysisExecutionGateCheck(workspace);
    const fatalIssues = issues.filter((i) => i.severity === "FATAL");

    if (fatalIssues.length > 0) {
      return NextResponse.json(
        {
          error: "FATAL_ANALYSIS_GATE_ERRORS",
          message: "存在重大統計結果或簽章違規，無法完成交接",
          fatalIssues,
        },
        { status: 422 }
      );
    }

    const snapshot = buildAnalysisResultsSnapshot({
      workspace,
      governanceSnapshot,
    });

    return NextResponse.json({
      success: true,
      snapshot,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "COMPLETE_FAILED", message: error.message || "完成第十四階段交接快照失敗" },
      { status: 500 }
    );
  }
}
