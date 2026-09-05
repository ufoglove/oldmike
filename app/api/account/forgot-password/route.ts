import { NextResponse } from "next/server";
import { guardAuthRequest } from "@/lib/auth-http";
import { guardSensitiveAuthRateLimit } from "@/lib/persistent-rate-limit";

export async function POST(request: Request) {
  const blocked = guardAuthRequest(request, "/admin-assisted-password-recovery");
  if (blocked) return blocked;
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 254) : "";
  if (!email || !email.includes("@")) return NextResponse.json({ ok: false, code: "invalid_email" }, { status: 400 });
  const limited = await guardSensitiveAuthRateLimit({ scope: "forgot-password", identifier: email, windowSeconds: 3600, max: 3 });
  if (limited) return limited;
  return NextResponse.json(
    { ok: true, code: "contact_administrator" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
