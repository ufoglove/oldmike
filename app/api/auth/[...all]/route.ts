import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/better-auth";
import { guardAuthRequest } from "@/lib/auth-http";

const handlers = toNextJsHandler(auth);

async function preserveRetryAfter(response: Response) {
  if (response.status !== 429) return response;
  const retryAfter = response.headers.get("Retry-After") || response.headers.get("X-Retry-After");
  if (!retryAfter) return response;
  const headers = new Headers(response.headers);
  headers.set("Retry-After", retryAfter);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function endpointPath(request: Request) {
  const pathname = new URL(request.url).pathname;
  return pathname.replace(/^\/api\/auth/, "") || "/";
}

export async function GET(request: Request) {
  const blocked = guardAuthRequest(request, endpointPath(request));
  return blocked || preserveRetryAfter(await handlers.GET(request));
}

export async function POST(request: Request) {
  const blocked = guardAuthRequest(request, endpointPath(request));
  return blocked || preserveRetryAfter(await handlers.POST(request));
}

export async function PATCH(request: Request) {
  const blocked = guardAuthRequest(request, endpointPath(request));
  return blocked || preserveRetryAfter(await handlers.PATCH(request));
}

export async function DELETE(request: Request) {
  const blocked = guardAuthRequest(request, endpointPath(request));
  return blocked || preserveRetryAfter(await handlers.DELETE(request));
}

export async function PUT(request: Request) {
  const blocked = guardAuthRequest(request, endpointPath(request));
  return blocked || preserveRetryAfter(await handlers.PUT(request));
}
