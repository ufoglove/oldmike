import "server-only";

import { academicLanguageHash } from "@/lib/academic-language-contract";
import { alpha3OriginAllowed, alpha3Response, boundedAlpha3Json } from "@/lib/v2-alpha3/http";
import { resolveV2Alpha3Principal } from "@/lib/v2-alpha3/runtime";
import { V2_ALPHA6_CONTRACT_VERSION } from "@/lib/v2-alpha6/contracts";
import { alpha6PrototypeEnabled } from "@/lib/v2-alpha6/page-authority";
import {
  createAlpha6LanguageAssistance,
  createSyntheticAlpha6PastedRequest,
  createSyntheticAlpha6ProjectRequest,
  createSyntheticAlpha6Workspace,
  createV2Alpha6Coordinator,
} from "@/lib/v2-alpha6/runtime";

const coordinator = createV2Alpha6Coordinator(async (request) => createSyntheticAlpha6Workspace(request));
const languageSettled = new Map<string, { requestHash: string; result: ReturnType<typeof createAlpha6LanguageAssistance> }>();

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export async function POST(request: Request) {
  if (!alpha6PrototypeEnabled()) return alpha3Response({ ok: false, code: "not_found" }, 404);
  if (!alpha3OriginAllowed(request)) return alpha3Response({ ok: false, code: "origin_rejected" }, 403);
  const authority = await resolveV2Alpha3Principal(request);
  if (!authority.ok) return alpha3Response({ ok: false, code: authority.code }, authority.status);
  try {
    const raw = await boundedAlpha3Json(request) as Record<string, unknown>;
    if (raw.operation === "GENERATE_WORKSPACE") {
      const project = raw.entryMode === "PROJECT_ARTIFACT";
      const expected = project
        ? ["operation", "requestId", "entryMode", "declaredLanguage", "projectSourceId"]
        : ["operation", "requestId", "entryMode", "declaredLanguage", "sourceText"];
      if (!exactKeys(raw, expected)) throw new Error("alpha6_route_shape_invalid");
      if (project && raw.projectSourceId !== "project-s0-alpha6-local") throw new Error("alpha6_project_source_not_found");
      const requestValue = project
        ? createSyntheticAlpha6ProjectRequest(String(raw.requestId ?? ""))
        : createSyntheticAlpha6PastedRequest(String(raw.requestId ?? ""), String(raw.sourceText ?? ""), raw.declaredLanguage === "ZH_TW" ? "ZH_TW" : "EN");
      if (requestValue.declaredLanguage !== raw.declaredLanguage) requestValue.declaredLanguage = raw.declaredLanguage === "EN" ? "EN" : "ZH_TW";
      const outcome = await coordinator.run({ ...requestValue, scope: `${authority.principal.workspaceId}:${authority.principal.userId}` });
      return alpha3Response({
        ok: true,
        contractVersion: V2_ALPHA6_CONTRACT_VERSION,
        workspace: outcome.result,
        replayed: outcome.replayed,
        providerSubmissionCount: outcome.replayed ? 0 : 1,
        formalResearchWriteCount: 0,
        onlineDatabaseWriteCount: 0,
        liveIntegrationCallCount: 0,
        externalMutationCount: 0,
      }, 200);
    }
    if (raw.operation === "LANGUAGE_ASSIST") {
      if (!exactKeys(raw, ["operation", "requestId", "task", "sourceText", "sourceHash"])) throw new Error("alpha6_language_route_shape_invalid");
      const requestId = String(raw.requestId ?? "");
      if (!/^[A-Za-z0-9._:-]{8,160}$/u.test(requestId)) throw new Error("alpha6_request_id_invalid");
      const sourceText = String(raw.sourceText ?? "");
      if (academicLanguageHash(sourceText) !== raw.sourceHash) throw new Error("alpha6_language_source_hash_mismatch");
      const key = `${authority.principal.workspaceId}:${authority.principal.userId}:${requestId}`;
      const requestHash = academicLanguageHash({ task: raw.task, sourceText });
      const prior = languageSettled.get(key);
      if (prior) {
        if (prior.requestHash !== requestHash) return alpha3Response({ ok: false, code: "alpha6_idempotency_conflict" }, 409);
        return alpha3Response({ ok: true, contractVersion: V2_ALPHA6_CONTRACT_VERSION, assistance: prior.result, replayed: true, providerSubmissionCount: 0, formalResearchWriteCount: 0 }, 200);
      }
      const result = createAlpha6LanguageAssistance(String(raw.task ?? ""), sourceText);
      languageSettled.set(key, { requestHash, result });
      return alpha3Response({ ok: true, contractVersion: V2_ALPHA6_CONTRACT_VERSION, assistance: result, replayed: false, providerSubmissionCount: 1, formalResearchWriteCount: 0 }, 200);
    }
    throw new Error("alpha6_operation_invalid");
  } catch (error) {
    const code = error instanceof Error && error.message.startsWith("alpha6_") ? error.message : "alpha6_request_invalid";
    if (code === "alpha6_idempotency_conflict") return alpha3Response({ ok: false, code }, 409);
    if (code === "alpha6_completion_unknown") return alpha3Response({ ok: false, code, completionClass: "COMPLETION_UNKNOWN" }, 503);
    return alpha3Response({ ok: false, code }, 400);
  }
}
