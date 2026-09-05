import "server-only";

import {
  V2_BETA2_CONTRACT_VERSION,
  V2_BETA2_DURABILITY_CLASS,
  V2_BETA2_REQUEST_MAX_BYTES,
  V2_BETA2_TRUST_CLASS,
  createV2Beta2RequestAuthority,
  expectedV2Beta2SuccessHttpStatus,
  parseV2Beta2MutationRequest,
  parseV2Beta2ProjectId,
  parseV2Beta2SuccessEnvelope,
  parseV2Beta2TerminalFailureEnvelope,
  type V2Beta2SuccessEnvelope,
  type V2Beta2TerminalFailureEnvelope,
  type V2Beta2MutationRequest,
} from "./contracts.ts";
import { authenticateV2Beta2Request, resolveResearchTenant, type V2Beta2AuthenticationResult, type V2Beta2ResearchTenant } from "./auth.ts";
import { createV2Beta2Coordinator, type V2Beta2Coordinator, type V2Beta2CoordinatorOutcome } from "./coordinator.ts";
import { getV2Beta2DisposablePool, PostgresV2Beta2Repository, V2Beta2RepositoryError } from "./repository.ts";
import { createV2Beta2RuntimeProvider } from "./provider-runtime.ts";

type RouteDependencies = {
  authenticate(request: Request): Promise<V2Beta2AuthenticationResult>;
  resolveTenant(userId: string, projectId: string): Promise<V2Beta2ResearchTenant | null>;
  coordinator(): V2Beta2Coordinator;
};

let defaultCoordinator: V2Beta2Coordinator | null = null;

function getDefaultCoordinator() {
  if (!defaultCoordinator) defaultCoordinator = createV2Beta2Coordinator({ repository: new PostgresV2Beta2Repository(getV2Beta2DisposablePool()), provider: createV2Beta2RuntimeProvider() });
  return defaultCoordinator;
}

function defaultDependencies(): RouteDependencies {
  return {
    authenticate: authenticateV2Beta2Request,
    resolveTenant: (userId, projectId) => resolveResearchTenant(getV2Beta2DisposablePool(), userId, projectId),
    coordinator: getDefaultCoordinator,
  };
}

function response(body: Record<string, unknown>, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" } });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  try {
    const actual = new URL(origin);
    if (actual.username || actual.password || actual.pathname !== "/" || actual.search || actual.hash) return false;
    const expectedOrigins = new Set([new URL(request.url).origin]);
    if (process.env.BETTER_AUTH_URL) {
      const configured = new URL(process.env.BETTER_AUTH_URL);
      if (!configured.username && !configured.password) expectedOrigins.add(configured.origin);
    }
    return expectedOrigins.has(actual.origin);
  } catch {
    return false;
  }
}

async function boundedJson(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > V2_BETA2_REQUEST_MAX_BYTES) throw new V2Beta2RepositoryError("beta2_request_too_large", 413);
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > V2_BETA2_REQUEST_MAX_BYTES) throw new V2Beta2RepositoryError("beta2_request_too_large", 413);
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new V2Beta2RepositoryError("beta2_request_invalid", 400);
  }
}

function envelope(operation: V2Beta2SuccessEnvelope["operation"], outcome: V2Beta2CoordinatorOutcome, projectId: string, request: V2Beta2MutationRequest | null): V2Beta2SuccessEnvelope {
  return parseV2Beta2SuccessEnvelope({
    ok: true,
    contractVersion: V2_BETA2_CONTRACT_VERSION,
    trustClass: V2_BETA2_TRUST_CLASS,
    durabilityClass: V2_BETA2_DURABILITY_CLASS,
    operation,
    requestAuthority: request === null ? null : createV2Beta2RequestAuthority(request),
    project: outcome.head,
    replayed: outcome.replayed,
    providerSubmissionDelta: outcome.providerSubmissionDelta,
    snapshotAppendDelta: outcome.snapshotAppendDelta,
    eventAppendDelta: outcome.eventAppendDelta,
    formalResearchWriteCount: 0,
    liveProviderCallCount: 0,
  }, { projectId, request });
}

function terminalFailureEnvelope(request: Exclude<V2Beta2MutationRequest, { operation: "SAVE_DIRECTION_SELECTION" | "SAVE_CONFIRMED_WORKSPACE" }>, outcome: V2Beta2CoordinatorOutcome): V2Beta2TerminalFailureEnvelope {
  const operation = request.operation;
  if (outcome.head.stageOutcome?.status !== "REJECTED" || outcome.head.stageOutcome.terminalEvent?.operation !== operation) throw new V2Beta2RepositoryError("beta2_terminal_outcome_authority_invalid", 503);
  return parseV2Beta2TerminalFailureEnvelope({
    ok: false,
    code: "beta2_provider_terminal_rejected",
    contractVersion: V2_BETA2_CONTRACT_VERSION,
    trustClass: V2_BETA2_TRUST_CLASS,
    durabilityClass: V2_BETA2_DURABILITY_CLASS,
    operation,
    requestAuthority: createV2Beta2RequestAuthority(request),
    project: outcome.head,
    replayed: outcome.replayed,
    providerSubmissionDelta: outcome.providerSubmissionDelta,
    snapshotAppendDelta: 0,
    eventAppendDelta: outcome.eventAppendDelta,
    formalResearchWriteCount: 0,
    liveProviderCallCount: 0,
  }, request);
}

async function authority(dependencies: RouteDependencies, request: Request, projectIdValue: string) {
  let projectId: string;
  try {
    projectId = parseV2Beta2ProjectId(projectIdValue);
  } catch {
    return { ok: false as const, result: response({ ok: false, code: "not_found" }, 404) };
  }
  const authentication = await dependencies.authenticate(request);
  if (!authentication.ok) return { ok: false as const, result: authentication.response };
  const tenant = await dependencies.resolveTenant(authentication.userId, projectId);
  if (!tenant) return { ok: false as const, result: response({ ok: false, code: "not_found" }, 404) };
  return { ok: true as const, context: { workspaceId: tenant.workspaceId, projectId: tenant.projectId, userId: tenant.userId } };
}

function failure(error: unknown) {
  if (error instanceof V2Beta2RepositoryError) return response({ ok: false, code: error.code }, error.status);
  const code = error instanceof Error && /^beta2_[a-z0-9_]+$/u.test(error.message) ? error.message : "beta2_request_invalid";
  if (code === "beta2_request_too_large") return response({ ok: false, code }, 413);
  return response({ ok: false, code }, 400);
}

export function createV2Beta2RouteHandlers(overrides?: RouteDependencies) {
  const dependencies = overrides ?? defaultDependencies();
  return {
    async GET(request: Request, projectId: string) {
      const resolved = await authority(dependencies, request, projectId);
      if (!resolved.ok) return resolved.result;
      try {
        return response(envelope("RESUME", await dependencies.coordinator().resume(resolved.context), resolved.context.projectId, null), 200);
      } catch (error) {
        return failure(error);
      }
    },

    async POST(request: Request, projectId: string) {
      const resolved = await authority(dependencies, request, projectId);
      if (!resolved.ok) return resolved.result;
      if (!sameOrigin(request)) return response({ ok: false, code: "origin_rejected" }, 403);
      try {
        const parsed = parseV2Beta2MutationRequest(await boundedJson(request));
        if (parsed.projectId !== resolved.context.projectId) return response({ ok: false, code: "not_found" }, 404);
        const coordinator = dependencies.coordinator();
        const outcome = parsed.operation === "GENERATE_DURABLE_CORE"
          ? await coordinator.generate(resolved.context, parsed)
          : parsed.operation === "SAVE_DIRECTION_SELECTION"
            ? await coordinator.saveSelection(resolved.context, parsed)
            : parsed.operation === "SAVE_CONFIRMED_WORKSPACE"
              ? await coordinator.saveConfirmedWorkspace(resolved.context, parsed)
              : await coordinator.reconcile(resolved.context, parsed);
        if (outcome.head.stageOutcome?.status === "REJECTED") {
          if (parsed.operation === "SAVE_DIRECTION_SELECTION" || parsed.operation === "SAVE_CONFIRMED_WORKSPACE") throw new V2Beta2RepositoryError("beta2_job_terminal", 409);
          return response(terminalFailureEnvelope(parsed, outcome), 409);
        }
        const body = envelope(parsed.operation, outcome, resolved.context.projectId, parsed);
        return response(body, expectedV2Beta2SuccessHttpStatus(body));
      } catch (error) {
        return failure(error);
      }
    },
  };
}
