import "server-only";

import { v2Beta1PrototypeEnabled } from "./page-authority.ts";
import { V2_BETA1_LOCAL_TRUSTED_SCOPE, V2_BETA1_LOCAL_USER_AUTHORITY, V2_BETA1_LOCAL_WORKSPACE_AUTHORITY } from "./scope-authority.ts";

export type V2Beta1Principal = { workspaceId: typeof V2_BETA1_LOCAL_WORKSPACE_AUTHORITY; userId: typeof V2_BETA1_LOCAL_USER_AUTHORITY; scope: typeof V2_BETA1_LOCAL_TRUSTED_SCOPE };
export type V2Beta1PrincipalResult = { ok: true; principal: V2Beta1Principal } | { ok: false; status: 400 | 404; code: string };

export async function resolveV2Beta1Principal(request: Request): Promise<V2Beta1PrincipalResult> {
  if (!v2Beta1PrototypeEnabled()) return { ok: false, status: 404, code: "not_found" };
  const workspaceId = request.headers.get("x-old-mike-v2-workspace")?.trim() ?? "";
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,159}$/u.test(workspaceId)) return { ok: false, status: 400, code: "workspace_authority_invalid" };
  if (process.env.OLD_MIKE_V2_BETA1_SYNTHETIC_PRINCIPAL !== "1") return { ok: false, status: 404, code: "not_found" };
  if (workspaceId !== V2_BETA1_LOCAL_WORKSPACE_AUTHORITY) return { ok: false, status: 404, code: "workspace_not_found" };
  return { ok: true, principal: { workspaceId, userId: V2_BETA1_LOCAL_USER_AUTHORITY, scope: V2_BETA1_LOCAL_TRUSTED_SCOPE } };
}
