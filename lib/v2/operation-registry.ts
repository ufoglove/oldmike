import type { V2StageId } from "./prototype-contract.ts";

export const V2_OPERATION_CONTRACT_VERSION = "old-mike-v2-operation/1.0.0" as const;

const shared = {
  transport: "SERVER_ONLY_SHARED_ENVELOPE" as const,
  formalWriteBoundary: "HUMAN_GATE_OR_EXISTING_VERSION_ENDPOINT" as const,
  timeoutClass: "BOUNDED_OPERATION_SPECIFIC" as const,
  retryPolicy: "NO_AUTOMATIC_RETRY_AFTER_SUBMISSION" as const,
};

export const V2_OPERATION_REGISTRY = [
  { ...shared, operation: "GENERATE_DIRECTIONS", stage: "DISCOVER", payloadSchemaId: "v2/directions/1", consumedFields: ["researchDirection", "constraints"], requiredFields: ["researchDirection"], tools: ["RESEARCH_IDEATION"] },
  { ...shared, operation: "ASSESS_INTERDISCIPLINARY_FIT", stage: "DISCOVER", payloadSchemaId: "v2/interdisciplinary-fit/1", consumedFields: ["directionRef", "disciplines"], requiredFields: ["directionRef", "disciplines"], tools: ["EVIDENCE_PLAN_REASONING"] },
  { ...shared, operation: "EXPAND_SELECTED_S0", stage: "BLUEPRINT", payloadSchemaId: "v2/s0-expansion/1", consumedFields: ["rootIntentHash", "selectedDirection"], requiredFields: ["rootIntentHash", "selectedDirection"], tools: ["DRAFT_GENERATION"] },
  { ...shared, operation: "DRAFT_PROPOSAL_STRUCTURE", stage: "BLUEPRINT", payloadSchemaId: "v2/proposal-structure/1", consumedFields: ["mode", "effectiveYear", "sourceMatrixRef"], requiredFields: ["mode", "effectiveYear", "sourceMatrixRef"], tools: ["PROPOSAL_DRAFTING"] },
  { ...shared, operation: "SYNTHESIZE_EVIDENCE", stage: "EVIDENCE", payloadSchemaId: "v2/evidence-synthesis/1", consumedFields: ["claimRefs", "sourceRefs"], requiredFields: ["claimRefs", "sourceRefs"], tools: ["EVIDENCE_SYNTHESIS"] },
  { ...shared, operation: "MANAGE_CITATIONS", stage: "EVIDENCE", payloadSchemaId: "v2/citations/1", consumedFields: ["citationRefs"], requiredFields: ["citationRefs"], tools: ["CITATION_METADATA"] },
  { ...shared, operation: "DESIGN_ANALYSIS", stage: "ANALYZE", payloadSchemaId: "v2/analysis-design/1", consumedFields: ["artifactRefs", "dataAuthority"], requiredFields: ["artifactRefs", "dataAuthority"], tools: ["REPRODUCIBLE_ANALYSIS_SPEC"] },
  { ...shared, operation: "SPECIFY_FIGURES", stage: "ANALYZE", payloadSchemaId: "v2/figure-spec/1", consumedFields: ["analysisRef", "dataCommitment"], requiredFields: ["analysisRef", "dataCommitment"], tools: ["REPRODUCIBLE_PLOT_SPEC"] },
  { ...shared, operation: "DRAFT_MANUSCRIPT", stage: "WRITE", payloadSchemaId: "v2/manuscript-draft/1", consumedFields: ["artifactRefs", "targetSection"], requiredFields: ["artifactRefs", "targetSection"], tools: ["ACADEMIC_DRAFTING"] },
  { ...shared, operation: "TRANSLATE_AND_HUMANIZE", stage: "WRITE", payloadSchemaId: "v2/language-transform/1", consumedFields: ["textRef", "direction", "preservationCommitment"], requiredFields: ["textRef", "direction", "preservationCommitment"], tools: ["FACT_PRESERVING_REWRITE"] },
  { ...shared, operation: "REVIEW_READ_ONLY", stage: "REVIEW_SUBMIT", payloadSchemaId: "v2/read-only-review/1", consumedFields: ["artifactRef", "reviewSchemaId"], requiredFields: ["artifactRef", "reviewSchemaId"], tools: ["READ_ONLY_REVIEW"] },
  { ...shared, operation: "PREPARE_SUBMISSION_PACKAGE", stage: "REVIEW_SUBMIT", payloadSchemaId: "v2/submission-package/1", consumedFields: ["artifactRef", "targetAuthorityRef"], requiredFields: ["artifactRef", "targetAuthorityRef"], tools: ["BOUNDED_EXPORT_PREVIEW"] },
] as const satisfies readonly {
  operation: string;
  stage: V2StageId;
  payloadSchemaId: string;
  consumedFields: readonly string[];
  requiredFields: readonly string[];
  tools: readonly string[];
  transport: "SERVER_ONLY_SHARED_ENVELOPE";
  formalWriteBoundary: "HUMAN_GATE_OR_EXISTING_VERSION_ENDPOINT";
  timeoutClass: "BOUNDED_OPERATION_SPECIFIC";
  retryPolicy: "NO_AUTOMATIC_RETRY_AFTER_SUBMISSION";
}[];

export type V2Operation = (typeof V2_OPERATION_REGISTRY)[number]["operation"];

export type V2OperationRequest = {
  contractVersion: typeof V2_OPERATION_CONTRACT_VERSION;
  operation: V2Operation;
  requestId: string;
  projectScope: "PRE_PROJECT" | "TENANT_PROJECT";
  input: Record<string, unknown>;
};

export function validateV2OperationRequest(value: unknown): V2OperationRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("v2_operation_request_invalid");
  const input = value as Record<string, unknown>;
  if (input.contractVersion !== V2_OPERATION_CONTRACT_VERSION) throw new Error("v2_operation_contract_version_invalid");
  if (!V2_OPERATION_REGISTRY.some((item) => item.operation === input.operation)) throw new Error("v2_operation_not_allowed");
  if (typeof input.requestId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/u.test(input.requestId)) throw new Error("v2_operation_request_id_invalid");
  if (input.projectScope !== "PRE_PROJECT" && input.projectScope !== "TENANT_PROJECT") throw new Error("v2_operation_scope_invalid");
  if (!input.input || typeof input.input !== "object" || Array.isArray(input.input)) throw new Error("v2_operation_payload_invalid");
  const specification = V2_OPERATION_REGISTRY.find((item) => item.operation === input.operation);
  if (!specification) throw new Error("v2_operation_not_allowed");
  const payload = input.input as Record<string, unknown>;
  for (const field of specification.requiredFields) {
    if (!Object.hasOwn(payload, field)) throw new Error(`v2_operation_required_field_missing:${field}`);
  }
  const consumedInput = Object.fromEntries(specification.consumedFields.filter((field) => Object.hasOwn(payload, field)).map((field) => [field, payload[field]]));
  return {
    contractVersion: V2_OPERATION_CONTRACT_VERSION,
    operation: input.operation as V2Operation,
    requestId: input.requestId,
    projectScope: input.projectScope,
    input: consumedInput,
  };
}
