export const ADMIN_ACCOUNT_CONTRACT = "old-mike.admin-provisioned-accounts.v1";

export function evaluateAdminOperation(input) {
  if (input.adminRows !== 1) return { allowed: false, code: "ADMIN_SINGLETON_INVALID" };
  if (!input.actorIsSingletonAdministrator) return { allowed: false, code: "ADMINISTRATOR_REQUIRED" };
  if (input.action === "SET_ADMIN" || input.action === "IMPERSONATE" || input.action === "READ_PASSWORD") {
    return { allowed: false, code: "ADMIN_CAPABILITY_PROHIBITED" };
  }
  if (input.targetIsAdministrator && input.action !== "LIST_MINIMAL_IDENTITY") {
    return { allowed: false, code: "ADMINISTRATOR_LIFECYCLE_LOCKED" };
  }
  if (!input.idempotencyKeyValid && input.action !== "LIST_MINIMAL_IDENTITY") {
    return { allowed: false, code: "INVALID_IDEMPOTENCY_KEY" };
  }
  return { allowed: true, code: "PASS" };
}

export function evaluateProtectedAccess(input) {
  if (input.status === "DISABLED") return { status: 403, code: "account_disabled" };
  if (input.mustChangePassword && !new Set(["ACCOUNT_STATUS", "CHANGE_PASSWORD", "LOGOUT"]).has(input.resource)) {
    return { status: 428, code: "password_change_required" };
  }
  if (input.resource === "RESEARCH" && !input.membershipMatchesTenantTuple) return { status: 404, code: "not_found" };
  return { status: 200, code: "PASS" };
}

export function evaluateProvisioningAtomicity(input) {
  const graphComplete = input.user && input.credentialHash && input.personalWorkspace
    && input.ownerMembership && input.provisioningState && input.adminEvent;
  if (input.plaintextPersisted) return { commit: false, code: "PLAINTEXT_PASSWORD_LEAK" };
  if (!graphComplete) return { commit: false, code: "ATOMIC_ACCOUNT_GRAPH_INCOMPLETE" };
  return { commit: true, code: "PASS" };
}
