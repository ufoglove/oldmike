import { NextRequest, NextResponse } from "next/server";
import { runPilotValidationGateCheck, buildPilotValidationSnapshot } from "@/lib/pilot-validation-service";
import { type PilotValidationWorkspace } from "@/lib/pilot-validation-contract";
import { type InstrumentProtocolSnapshot } from "@/lib/instrument-protocol-contract";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { workspace, instrumentSnapshot } = body as {
      workspace: PilotValidationWorkspace;
      instrumentSnapshot: InstrumentProtocolSnapshot;
    };

    if (!workspace || !instrumentSnapshot) {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD", message: "必須提供完整的 workspace 與 instrumentSnapshot" },
        { status: 400 }
      );
    }

    // Run Gate Checks
    const issues = runPilotValidationGateCheck(workspace);
    const fatalIssues = issues.filter((i) => i.severity === "FATAL");

    if (fatalIssues.length > 0) {
      return NextResponse.json(
        {
          error: "FATAL_PILOT_GATE_ERRORS",
          message: "存在重大放行閘門違規（如未獲倫理許可卻放行人體試驗），無法完成交接",
          fatalIssues,
        },
        { status: 422 }
      );
    }

    const snapshot = buildPilotValidationSnapshot({
      workspace,
      instrumentSnapshot,
    });

    return NextResponse.json({
      success: true,
      snapshot,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "COMPLETE_FAILED", message: error.message || "完成第十一階段交接快照失敗" },
      { status: 500 }
    );
  }
}
