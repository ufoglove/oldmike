import { NextResponse } from "next/server";
import { originAllowed } from "@/lib/auth-http";
import { readBoundedJson } from "@/lib/foundation-runtime-contract";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import {
  ARTIFACT_REQUEST_CONTRACT_VERSION,
  ARTIFACT_REQUEST_MAX_BODY_BYTES,
  base64ByteLength,
  isArtifactRequestBody,
  isAuthorizationValid,
  type ArtifactManifestEntry,
  type ArtifactRequestFailure,
} from "@/lib/artifact-request-contract";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ projectId: string }> };

function noStore(body: ArtifactRequestFailure | Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function fail(code: ArtifactRequestFailure["code"], error: string, status: number) {
  return noStore({ ok: false, code, error } satisfies ArtifactRequestFailure, status);
}

export async function POST(request: Request, context: Context) {
  if (!originAllowed(request)) return fail("origin_rejected", "Request origin was rejected.", 403);
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;

  const { projectId } = await context.params;

  let parsedBody: unknown;
  try {
    parsedBody = await readBoundedJson(request, ARTIFACT_REQUEST_MAX_BODY_BYTES);
  } catch {
    return fail("body_too_large", `Request body exceeds ${ARTIFACT_REQUEST_MAX_BODY_BYTES} bytes.`, 413);
  }
  if (!isArtifactRequestBody(parsedBody)) {
    return fail("malformed_body", "Request body does not match artifact-request/1.0.0 contract.", 400);
  }
  const body = parsedBody;

  try {
    const { artifactStore } = await import("@/lib/artifact-request-store");
    const result = await artifactStore.append({
      userId: auth.session.user.id,
      projectId,
      idempotencyKey: body.idempotencyKey,
      workOrderId: body.workOrderId,
      authorizationId: body.authorizationId,
      filename: body.entry.filename,
      format: body.entry.format,
      bytes: base64ByteLength(body.entry.contentBase64),
      contentBase64: body.entry.contentBase64,
    });

    if (!result.ok) {
      const statusMap: Record<string, number> = {
        work_order_not_found: 404,
        authorization_revoked: 403,
        authorization_expired: 403,
        work_order_not_running: 409,
        storage_unavailable: 503,
        idempotency_conflict: 409,
      };
      return fail(result.code, result.error, statusMap[result.code] ?? 400);
    }

    const manifestEntry: ArtifactManifestEntry = {
      filename: body.entry.filename,
      format: body.entry.format,
      bytes: result.entry.bytes,
      sha256: result.entry.sha256,
      storageRef: result.entry.storageRef,
      createdAt: result.entry.createdAt,
    };
    return noStore(
      {
        ok: true,
        contractVersion: ARTIFACT_REQUEST_CONTRACT_VERSION,
        artifactId: result.artifactId,
        manifestEntry,
        workOrderStatus: result.workOrderStatus,
      },
      201,
    );
  } catch {
    return fail("internal_error", "Artifact request could not be processed.", 500);
  }
}
