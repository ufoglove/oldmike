export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export default {};", shortCircuit: true };
  if (specifier === "./auth.ts" && context.parentURL?.endsWith("/lib/v2-beta2/route-handlers.ts")) {
    return {
      url: "data:text/javascript,export async function authenticateV2Beta2Request(){throw new Error('route_test_auth_not_injected')}export async function resolveResearchTenant(){throw new Error('route_test_tenant_not_injected')}",
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
