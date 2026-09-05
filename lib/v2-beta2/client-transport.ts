import {
  parseV2Beta2MutationRequest,
  parseV2Beta2ProjectId,
  parseV2Beta2SuccessHttpResponse,
  parseV2Beta2TerminalFailureHttpResponse,
  type V2Beta2MutationRequest,
  type V2Beta2ResponseExpectation,
  type V2Beta2SuccessEnvelope,
  type V2Beta2TerminalFailureEnvelope,
} from "./contracts.ts";

export class V2Beta2ClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly terminalOutcome: V2Beta2TerminalFailureEnvelope | null;

  constructor(code: string, status: number, terminalOutcome: V2Beta2TerminalFailureEnvelope | null = null) {
    super(code);
    this.code = code;
    this.status = status;
    this.terminalOutcome = terminalOutcome;
  }
}

async function parseResponse(response: Response, expectation: V2Beta2ResponseExpectation): Promise<V2Beta2SuccessEnvelope> {
  const value = await response.json().catch(() => null);
  if (!response.ok) {
    const responseCode = value && typeof value === "object" && !Array.isArray(value) && typeof (value as Record<string, unknown>).code === "string"
      ? (value as Record<string, unknown>).code as string
      : null;
    if (response.status === 409 && responseCode === "beta2_provider_terminal_rejected") {
      try {
        if (expectation.request === null) throw new Error("beta2_response_invalid");
        const terminalOutcome = parseV2Beta2TerminalFailureHttpResponse(value, response.status, expectation.request);
        throw new V2Beta2ClientError(terminalOutcome.code, response.status, terminalOutcome);
      } catch (error) {
        if (error instanceof V2Beta2ClientError) throw error;
        throw new V2Beta2ClientError("beta2_response_invalid", response.status);
      }
    }
    if (responseCode === "beta2_provider_terminal_rejected") throw new V2Beta2ClientError("beta2_response_invalid", response.status);
    const code = responseCode ?? "beta2_response_invalid";
    throw new V2Beta2ClientError(code, response.status);
  }
  try {
    return parseV2Beta2SuccessHttpResponse(value, response.status, expectation);
  } catch {
    throw new V2Beta2ClientError("beta2_response_invalid", response.status);
  }
}

export function createV2Beta2ClientTransport(projectIdValue: string) {
  const projectId = parseV2Beta2ProjectId(projectIdValue);
  const endpoint = `/api/v2-beta2/projects/${encodeURIComponent(projectId)}`;
  return {
    async resume() {
      return parseResponse(await fetch(endpoint, { method: "GET", credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } }), { projectId, request: null });
    },
    async mutate(raw: unknown) {
      const request: V2Beta2MutationRequest = parseV2Beta2MutationRequest(raw);
      if (request.projectId !== projectId) throw new V2Beta2ClientError("beta2_project_scope_mismatch", 400);
      return parseResponse(await fetch(endpoint, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(request) }), { projectId, request });
    },
  };
}
