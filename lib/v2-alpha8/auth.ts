import "server-only";

export type V2Alpha8Principal = { workspaceId: string; userId: string };

export async function resolveV2Alpha8Principal(request: Request): Promise<{ ok: true; principal: V2Alpha8Principal } | { ok: false; status: number; code: string }> {
  const workspaceId = request.headers.get("x-old-mike-v2-workspace")?.trim() ?? "";
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,159}$/u.test(workspaceId)) return { ok: false, status: 400, code: "workspace_authority_invalid" };
  if (process.env.NODE_ENV !== "production" && process.env.TEST_FIXTURE === "1" && process.env.OLD_MIKE_V2_ALPHA8_SYNTHETIC_PRINCIPAL === "1") {
    if (workspaceId !== "fixture-workspace-v2") return { ok: false, status: 404, code: "workspace_not_found" };
    return { ok: true, principal: { workspaceId, userId: "fixture-user-v2" } };
  }
  return { ok: false, status: 404, code: "not_found" };
}
