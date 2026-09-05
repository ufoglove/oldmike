import "server-only";

import { NextResponse } from "next/server";
import { requireAssist } from "../_shared";
import { parseRadarScanRequest, RadarContractError } from "@/lib/research-opportunity-radar-contract";
import { executeRadarScan, RadarGenerationError } from "@/lib/research-opportunity-radar-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const required = await requireAssist(request);
  if (required instanceof NextResponse) return required;
  try {
    const parsed = parseRadarScanRequest(required.body);
    const result = await executeRadarScan(parsed, { signal: request.signal });
    return NextResponse.json({ ok: true, persistence: "NONE", ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RadarContractError) {
      return NextResponse.json({ ok: false, code: error.code, error: "前沿雷達掃描要求未通過固定資料契約。" }, { status: error.status });
    }
    if (error instanceof RadarGenerationError) {
      return NextResponse.json({ ok: false, code: error.code, stage: error.stage, recoverableFields: error.recoverableFields, error: `前沿掃描未完成（${error.stage}）；尚未產生任何機會判斷。` }, { status: error.status });
    }
    return NextResponse.json({ ok: false, code: "radar_unavailable", error: "老麥目前無法完成前沿掃描。" }, { status: 503 });
  }
}
