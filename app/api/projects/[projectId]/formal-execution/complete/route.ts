import { NextRequest, NextResponse } from "next/server";
import { runFormalExecutionGateCheck, buildFormalExecutionSnapshot } from "@/lib/formal-execution-service";
import { type FormalExecutionWorkspace } from "@/lib/formal-execution-contract";
import { type PilotValidationSnapshot } from "@/lib/pilot-validation-contract";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { workspace, pilotSnapshot } = body as {
      workspace: FormalExecutionWorkspace;
      pilotSnapshot: PilotValidationSnapshot;
    };

    if (!workspace || !pilotSnapshot) {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD", message: "必須提供完整的 workspace 與 pilotSnapshot" },
        { status: 400 }
      );
    }

    // Run Formal Execution Gate Checks
    const issues = runFormalExecutionGateCheck(workspace);
    const fatalIssues = issues.filter((i) => i.severity === "FATAL");

    if (fatalIssues.length > 0) {
      return NextResponse.json(
        {
          error: "FATAL_EXECUTION_GATE_ERRORS",
          message: "存在重大執行放行違規（如未獲授權人體試驗或假造同意書），無法完成交接",
          fatalIssues,
        },
        { status: 422 }
      );
    }

    const snapshot = buildFormalExecutionSnapshot({
      workspace,
      pilotSnapshot,
    });

    return NextResponse.json({
      success: true,
      snapshot,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "COMPLETE_FAILED", message: error.message || "完成第十二階段交接快照失敗" },
      { status: 500 }
    );
  }
}
