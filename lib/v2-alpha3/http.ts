import "server-only";

import { NextResponse } from "next/server";

import { originAllowed } from "../auth-http.ts";

export const V2_ALPHA3_HTTP_MAX_BYTES = 24_576;

export function alpha3Response(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function boundedAlpha3Json(request: Request) {
  const declared = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > V2_ALPHA3_HTTP_MAX_BYTES) throw new Error("request_too_large");
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > V2_ALPHA3_HTTP_MAX_BYTES) throw new Error("request_too_large");
  return JSON.parse(body) as unknown;
}

export function alpha3OriginAllowed(request: Request) { return originAllowed(request); }
