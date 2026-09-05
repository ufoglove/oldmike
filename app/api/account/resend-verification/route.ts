import { NextResponse } from "next/server";
import { guardAuthRequest } from "@/lib/auth-http";

export async function POST(request: Request) {
  const blocked = guardAuthRequest(request, "/resend-verification-disabled");
  if (blocked) return blocked;
  return NextResponse.json({ ok: true, code: "contact_administrator" }, { headers: { "Cache-Control": "no-store" } });
}
