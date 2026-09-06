import { NextRequest, NextResponse } from "next/server";
import { runInstrumentProtocolAlignmentCheck, buildInstrumentProtocolSnapshot } from "@/lib/instrument-protocol-service";
import { type InstrumentProtocolWorkspace } from "@/lib/instrument-protocol-contract";
import { type Stage09HandoffSnapshot } from "@/lib/route-review-compliance-contract";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { workspace, stage09Snapshot } = body as {
      workspace: InstrumentProtocolWorkspace;
      stage09Snapshot: Stage09HandoffSnapshot;
    };

    if (!workspace || !stage09Snapshot) {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD", message: "必須提供完整的 workspace 與 stage09Snapshot" },
        { status: 400 }
      );
    }

    // Run Triple Alignment Check
    const findings = runInstrumentProtocolAlignmentCheck(workspace);
    const fatalFindings = findings.filter((f) => f.severity === "FATAL");

    if (fatalFindings.length > 0) {
      return NextResponse.json(
        {
          error: "FATAL_ALIGNMENT_ERRORS",
          message: "存在重大工具、分析或權限矛盾，無法完成交接",
          fatalFindings,
        },
        { status: 422 }
      );
    }

    const snapshot = buildInstrumentProtocolSnapshot({
      workspace,
      stage09Snapshot,
    });

    return NextResponse.json({
      success: true,
      snapshot,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "COMPLETE_FAILED", message: error.message || "完成第十階段交接快照失敗" },
      { status: 500 }
    );
  }
}
