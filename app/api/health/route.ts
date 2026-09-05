import { NextResponse } from "next/server";
import { RELEASE_IDENTITY, RELEASE_VERSION } from "@/lib/release-identity";

export const dynamic = "force-dynamic";

export async function GET() {
  const response = NextResponse.json({
    status: "ok",
    service: "research-portal",
    version: RELEASE_VERSION,
    mode: process.env.OPENCLAW_BASE_URL && process.env.OPENCLAW_GATEWAY_TOKEN ? "connected" : "demo",
    releaseIdentity: RELEASE_IDENTITY,
  });
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  response.headers.set("CDN-Cache-Control", "no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}
