import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { ok: false, code: "registration_unavailable" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
