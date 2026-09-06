import { NextRequest, NextResponse } from "next/server";
import { runDataGovernanceGateCheck, buildDataGovernanceSnapshot } from "@/lib/data-governance-service";
import { type DataGovernanceWorkspace } from "@/lib/data-governance-contract";
import { type FormalExecutionSnapshot } from "@/lib/formal-execution-contract";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { workspace, formalSnapshot } = body as {
      workspace: DataGovernanceWorkspace;
      formalSnapshot: FormalExecutionSnapshot;
    };

    if (!workspace || !formalSnapshot) {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD", message: "必須提供完整的 workspace 與 formalSnapshot" },
        { status: 400 }
      );
    }

    // Run Governance Gate Checks
    const issues = runDataGovernanceGateCheck(workspace);
    const fatalIssues = issues.filter((i) => i.severity === "FATAL");

    if (fatalIssues.length > 0) {
      return NextResponse.json(
        {
          error: "FATAL_GOVERNANCE_GATE_ERRORS",
          message: "存在重大資料治理違規（如資料洩漏或未同意學生紀錄流出），無法完成交接",
          fatalIssues,
        },
        { status: 422 }
      );
    }

    const snapshot = buildDataGovernanceSnapshot({
      workspace,
      formalSnapshot,
    });

    return NextResponse.json({
      success: true,
      snapshot,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "COMPLETE_FAILED", message: error.message || "完成第十三階段交接快照失敗" },
      { status: 500 }
    );
  }
}
