import "server-only";

import { NextResponse } from "next/server";
import { requireAssist } from "../_shared";
import {
  OneClickInspirationContractError,
  parseOneClickInspirationRequest,
} from "@/lib/one-click-inspiration-contract";
import { executeOneClickInspiration, OneClickInspirationError } from "@/lib/one-click-inspiration-service";
import { sha256CanonicalPortable as sha256Canonical } from "@/lib/canonical-sha256";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const required = await requireAssist(request);
  if (required instanceof NextResponse) return required;
  try {
    const parsed = parseOneClickInspirationRequest(required.body);
    const result = await executeOneClickInspiration(parsed, { signal: request.signal });
    return NextResponse.json({ ok: true, persistence: "NONE", ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof OneClickInspirationContractError) {
      return NextResponse.json({ ok: false, code: error.code, error: "一鍵靈感要求未通過固定資料契約。" }, { status: error.status });
    }
    if (error instanceof OneClickInspirationError) {
      return NextResponse.json({ ok: false, code: error.code, stage: error.stage, recoverableFields: error.recoverableFields, error: `一鍵靈感未完成（${error.stage}）；目前尚未產生任何推薦。` }, { status: error.status });
    }
    return NextResponse.json({ ok: false, code: "one_click_inspiration_unavailable", error: "老麥目前無法完成這項靈感操作。" }, { status: 503 });
  }
}
