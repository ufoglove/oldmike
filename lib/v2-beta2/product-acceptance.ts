export const V2_BETA2_PRODUCT_ACCEPTANCE_CONTRACT_ID = "old-mike-v2-beta2/product-acceptance/4" as const;
export const V2_BETA2_PRODUCT_ACCEPTANCE_SCHEMA_ID = "old-mike-v2-beta2/product-acceptance-contract/4" as const;
export const V2_BETA2_PRODUCT_ACCEPTANCE_VECTOR_SCHEMA_ID = "old-mike-v2-beta2/product-acceptance-vectors/4" as const;
export const V2_BETA2_PRODUCT_ACCEPTANCE_VERIFIER_RESULT_SCHEMA_ID = "old-mike-v2-beta2/product-acceptance-verifier-result/4" as const;
export const V2_BETA2_PRODUCT_ACCEPTANCE_ATTEMPT_START_SCHEMA_ID = "old-mike-v2-beta2/product-acceptance-attempt-start/4" as const;
export const V2_BETA2_PRODUCT_ACCEPTANCE_OBSERVATION_RECEIPT_SCHEMA_ID = "old-mike-v2-beta2/product-acceptance-observation-receipt/4" as const;
export const V2_BETA2_PRODUCT_ACCEPTANCE_BROWSER_FAILURE_SCHEMA_ID = "old-mike-v2-beta2/product-acceptance-browser-failure/4" as const;
export const V2_BETA2_PRODUCT_ACCEPTANCE_CLEANUP_RECEIPT_SCHEMA_ID = "old-mike-v2-beta2/product-acceptance-cleanup-receipt/4" as const;
export const V2_BETA2_PRODUCT_ACCEPTANCE_INNER_OUTCOME_SCHEMA_ID = "old-mike-v2-beta2/product-acceptance-inner-outcome/4" as const;
export const V2_BETA2_PRODUCT_ACCEPTANCE_LAUNCHER_TERMINAL_SCHEMA_ID = "old-mike-v2-beta2/product-acceptance-launcher-terminal/4" as const;
export const V2_BETA2_PRODUCT_ACCEPTANCE_RUNTIME_CONTRACT = "old-mike-v2-beta2/2.0.0-alpha.11" as const;

export const V2_BETA2_ACCEPTANCE_CONTROLS = Object.freeze({
  loginEmail: "v2-beta2-login-email",
  loginPassword: "v2-beta2-login-password",
  loginSubmit: "v2-beta2-login-submit",
  projectWorkspace: "v2-beta2-project-workspace",
  materialMode: "v2-beta2-material-mode",
  materialItem: "v2-beta2-material-item",
  materialKind: "v2-beta2-material-kind",
  materialTitle: "v2-beta2-material-title",
  materialContent: "v2-beta2-material-original-content",
  generate: "v2-beta2-generate",
  directionList: "v2-beta2-direction-list",
  direction: "v2-beta2-direction",
  s0: "v2-beta2-s0",
  assist: "v2-beta2-assist",
  saveSelection: "v2-beta2-save-selection",
  saveWorkspace: "v2-beta2-save-workspace",
  reloadResume: "v2-beta2-reload-resume",
  reconciliation: "v2-beta2-reconciliation",
  humanGate: "v2-beta2-human-gate",
  status: "v2-beta2-status",
} as const);

export const V2_BETA2_ACCEPTANCE_MATERIAL_IDENTITY = Object.freeze({
  firstMaterialId: "beta2-material-01",
  materialIdTemplate: "beta2-material-{zero-padded-monotonic-session-ordinal}",
  itemAcceptanceIdTemplate: "v2-beta2-material-item:{materialId}",
  kindAcceptanceIdTemplate: "v2-beta2-material-kind:{materialId}",
  titleAcceptanceIdTemplate: "v2-beta2-material-title:{materialId}",
  contentAcceptanceIdTemplate: "v2-beta2-material-original-content:{materialId}",
  nonReuseRule: "MONOTONIC_SESSION_ORDINAL_NEVER_DERIVED_FROM_CURRENT_COUNT",
} as const);

export type V2Beta2AcceptanceControlName = keyof typeof V2_BETA2_ACCEPTANCE_CONTROLS;

const V2_BETA2_ACCEPTANCE_VECTOR_KINDS = Object.freeze([
  "PARTIAL_SUCCESS",
  "MATERIAL_REJECT",
  "COMPLETION_UNKNOWN",
  "TERMINAL_REJECTED",
  "EXACT_REPLAY",
  "SAME_KEY_CONFLICT",
  "AUTHORITY_REJECT",
  "PARTIAL_BROWSER_DOM",
] as const);

const V2_BETA2_MATERIAL_HASH_KNOWN_ANSWERS = Object.freeze([
  { id: "ascii", content: "abc", contentByteLength: 3, canonicalPreimageByteLength: 5, contentHash: "6cc43f858fbb763301637b5af970e2a46b46f461f27e5a0f41e009c59b827b25", rawUtf8Sha256Negative: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" },
  { id: "crlf", content: "line1\r\nline2", contentByteLength: 12, canonicalPreimageByteLength: 16, contentHash: "5fcbd27b066836fb900c48269972054847075260e87794824a021c48d6caa0f7", rawUtf8Sha256Negative: "d14a91a6d1c6ee83bf0c774ebecbee6d8b393b395dae29eea839c354d6fba9c0" },
  { id: "leading-trailing-whitespace", content: "  abc  ", contentByteLength: 7, canonicalPreimageByteLength: 9, contentHash: "91ef169521304d6da79f9652cd8bc88ac6f4c9730c2dd31496cc8acd97cfb3bc", rawUtf8Sha256Negative: "e1df0bfff7ba8ed81085b91ad7dde5d31777855835b80db6d99b56ef9f3aaa6b" },
  { id: "combining-mark", content: "é", contentByteLength: 3, canonicalPreimageByteLength: 5, contentHash: "3d68ce21f2899a475713cdbe7562ba9bdb6b1dfde8af1f221bdff4a0935b53b2", rawUtf8Sha256Negative: "bf12767b0f2a56b2190075bae8169f656e3ce8d6357d4aff184bc6c7ea48f9f6" },
  { id: "emoji-nonbmp", content: "😀", contentByteLength: 4, canonicalPreimageByteLength: 6, contentHash: "7a0c50b92434b015545fe93ab723db2d4b2cdd14a441405624a9ce8be29f1d5a", rawUtf8Sha256Negative: "f0443a342c5ef54783a111b51ba56c938e474c32324d90c3a60c9c8e3a37e2d9" },
  { id: "quote-backslash-json-escape", content: "a\"b\\c", contentByteLength: 5, canonicalPreimageByteLength: 9, contentHash: "29e409e74462be098277d1428e52e22cd782e73a9f50b4f4f26e6527ab583eca", rawUtf8Sha256Negative: "bd558229236e7dc57de12841c13ceb1457fb3f8d462404e7fab1c93914d5a8a0" },
] as const);

export type V2Beta2ProductAcceptanceContract = {
  schemaId: typeof V2_BETA2_PRODUCT_ACCEPTANCE_SCHEMA_ID;
  contractId: typeof V2_BETA2_PRODUCT_ACCEPTANCE_CONTRACT_ID;
  version: 4;
  productContract: typeof V2_BETA2_PRODUCT_ACCEPTANCE_RUNTIME_CONTRACT;
  status: "STABLE_PRODUCT_OWNED_LOCAL_ACCEPTANCE";
  trustCeiling: "LOCAL_PRODUCT_ACCEPTANCE_PASS_NOT_PROFESSOR_UAT";
  scope: {
    sourceJourney: "PARTIAL_MATERIAL";
    providerRuntime: "LOCAL_DETERMINISTIC_FIXTURE_ONLY";
    durableDatabase: "LOOPBACK_DISPOSABLE_POSTGRES_ONLY";
    formalResearchWrites: 0;
  };
  canonicalHashRules: {
    algorithm: "SHA256";
    json: "UTF8_LEXICOGRAPHIC_OBJECT_KEYS_ARRAY_ORDER_PRESERVED_NO_WHITESPACE";
    material: {
      contentByteLength: "UTF8_ORIGINAL_JAVASCRIPT_STRING_BYTE_LENGTH";
      contentHashPreimage: "UTF8_JSON_STRINGIFY_ORIGINAL_JAVASCRIPT_STRING";
      contentHash: "SHA256_CONTENT_HASH_PREIMAGE";
      originalContent: "EXACT_JS_STRING_AND_ORDER_PRESERVED";
      normalization: "NO_TRIM_NO_NFC_NO_CASE_FOLD_NO_ALIAS_NO_FALLBACK";
    };
  };
  controlIds: typeof V2_BETA2_ACCEPTANCE_CONTROLS;
  materialControlIdentity: typeof V2_BETA2_ACCEPTANCE_MATERIAL_IDENTITY;
  executionAuthority: {
    oneRunScope: "EXACT_PRODUCT_BUNDLE_AND_RESOLVED_WORKSPACE_AUTHORITY_ROOT";
    claimRule: "ATOMIC_CREATE_NEW_BEFORE_PORT_DATABASE_OR_CHILD";
    environmentRule: "ORDERED_NONSECRET_VALUES_AND_CHILD_FINGERPRINT_EQUALITY";
    terminalRule: "STARTED_CONVERGES_TO_PASS_FAIL_BLOCKED_OR_EXTERNAL_BLOCKED";
    observationRule: "APPEND_ONLY_HASH_BOUND_LEDGER_WITH_DATABASE_PARITY";
    cleanupRule: "REGISTERED_PROCESS_LISTENER_AND_OWNED_ROOT_INVENTORY";
  };
  journeyRequirements: readonly [
    "AUTHENTICATED_PROJECT",
    "PARTIAL_MATERIAL_BYTES",
    "THREE_DIRECTIONS_ONE_RECOMMENDED",
    "COMPLETE_13_FIELD_S0",
    "ASSIST_PREVIEW_APPLY_UNDO_SAVE",
    "DURABLE_RELOAD_RELOGIN",
    "COMPLETION_UNKNOWN_LOOKUP_ONLY",
    "HUMAN_GATE_ZERO_FORMAL_WRITE",
  ];
  professorReview: {
    automatedVerdictForbidden: true;
    visibleMeaning: "Professor manually reviews one frozen product hash after a separate environment preflight";
  };
};

function object(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function exact(value: unknown, keys: readonly string[], code: string) {
  const input = object(value, code);
  const actual = Object.keys(input).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error(code);
  return input;
}

function parseJsonStringToken(raw: string, cursor: { index: number }, code: string) {
  const start = cursor.index;
  if (raw[cursor.index] !== '"') throw new Error(code);
  cursor.index += 1;
  while (cursor.index < raw.length) {
    const character = raw[cursor.index];
    if (character === '"') {
      cursor.index += 1;
      try { return JSON.parse(raw.slice(start, cursor.index)) as string; } catch { throw new Error(code); }
    }
    if (character === "\\") {
      cursor.index += 2;
      continue;
    }
    if (character.charCodeAt(0) < 0x20) throw new Error(code);
    cursor.index += 1;
  }
  throw new Error(code);
}

function assertDuplicateAwareJson(raw: string, code: string) {
  if (raw.startsWith("\uFEFF")) throw new Error(code);
  const cursor = { index: 0 };
  const whitespace = () => { while (/\s/u.test(raw[cursor.index] ?? "")) cursor.index += 1; };
  const value = (): void => {
    whitespace();
    const character = raw[cursor.index];
    if (character === "{") {
      cursor.index += 1;
      whitespace();
      const keys = new Set<string>();
      if (raw[cursor.index] === "}") { cursor.index += 1; return; }
      while (cursor.index < raw.length) {
        whitespace();
        const key = parseJsonStringToken(raw, cursor, code);
        if (keys.has(key)) throw new Error(code);
        keys.add(key);
        whitespace();
        if (raw[cursor.index] !== ":") throw new Error(code);
        cursor.index += 1;
        value();
        whitespace();
        if (raw[cursor.index] === "}") { cursor.index += 1; return; }
        if (raw[cursor.index] !== ",") throw new Error(code);
        cursor.index += 1;
      }
      throw new Error(code);
    }
    if (character === "[") {
      cursor.index += 1;
      whitespace();
      if (raw[cursor.index] === "]") { cursor.index += 1; return; }
      while (cursor.index < raw.length) {
        value();
        whitespace();
        if (raw[cursor.index] === "]") { cursor.index += 1; return; }
        if (raw[cursor.index] !== ",") throw new Error(code);
        cursor.index += 1;
      }
      throw new Error(code);
    }
    if (character === '"') { parseJsonStringToken(raw, cursor, code); return; }
    const remainder = raw.slice(cursor.index);
    const token = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/u.exec(remainder)?.[0];
    if (!token) throw new Error(code);
    cursor.index += token.length;
  };
  value();
  whitespace();
  if (cursor.index !== raw.length) throw new Error(code);
}

function parseDuplicateAwareJson(raw: unknown, code: string) {
  if (typeof raw !== "string") throw new Error(code);
  assertDuplicateAwareJson(raw, code);
  try { return JSON.parse(raw) as unknown; } catch { throw new Error(code); }
}

export function parseV2Beta2ProductAcceptanceContractJson(raw: unknown) {
  return parseV2Beta2ProductAcceptanceContract(parseDuplicateAwareJson(raw, "beta2_product_acceptance_contract_invalid"));
}

export function parseV2Beta2ProductAcceptanceVectorsJson(raw: unknown) {
  return parseV2Beta2ProductAcceptanceVectors(parseDuplicateAwareJson(raw, "beta2_product_acceptance_vectors_invalid"));
}

export function parseV2Beta2ProductAcceptanceContract(value: unknown): V2Beta2ProductAcceptanceContract {
  const code = "beta2_product_acceptance_contract_invalid";
  const input = exact(value, ["schemaId", "contractId", "version", "productContract", "status", "trustCeiling", "scope", "canonicalHashRules", "controlIds", "materialControlIdentity", "executionAuthority", "journeyRequirements", "professorReview"], code);
  const scope = exact(input.scope, ["sourceJourney", "providerRuntime", "durableDatabase", "formalResearchWrites"], code);
  const hashes = exact(input.canonicalHashRules, ["algorithm", "json", "material"], code);
  const materialHash = exact(hashes.material, ["contentByteLength", "contentHashPreimage", "contentHash", "originalContent", "normalization"], code);
  const controls = exact(input.controlIds, Object.keys(V2_BETA2_ACCEPTANCE_CONTROLS), code);
  const materialIdentity = exact(input.materialControlIdentity, Object.keys(V2_BETA2_ACCEPTANCE_MATERIAL_IDENTITY), code);
  const execution = exact(input.executionAuthority, ["oneRunScope", "claimRule", "environmentRule", "terminalRule", "observationRule", "cleanupRule"], code);
  const professor = exact(input.professorReview, ["automatedVerdictForbidden", "visibleMeaning"], code);
  const journeys = ["AUTHENTICATED_PROJECT", "PARTIAL_MATERIAL_BYTES", "THREE_DIRECTIONS_ONE_RECOMMENDED", "COMPLETE_13_FIELD_S0", "ASSIST_PREVIEW_APPLY_UNDO_SAVE", "DURABLE_RELOAD_RELOGIN", "COMPLETION_UNKNOWN_LOOKUP_ONLY", "HUMAN_GATE_ZERO_FORMAL_WRITE"] as const;
  const requirements = input.journeyRequirements;
  if (input.schemaId !== V2_BETA2_PRODUCT_ACCEPTANCE_SCHEMA_ID
    || input.contractId !== V2_BETA2_PRODUCT_ACCEPTANCE_CONTRACT_ID
    || input.version !== 4
    || input.productContract !== V2_BETA2_PRODUCT_ACCEPTANCE_RUNTIME_CONTRACT
    || input.status !== "STABLE_PRODUCT_OWNED_LOCAL_ACCEPTANCE"
    || input.trustCeiling !== "LOCAL_PRODUCT_ACCEPTANCE_PASS_NOT_PROFESSOR_UAT"
    || scope.sourceJourney !== "PARTIAL_MATERIAL"
    || scope.providerRuntime !== "LOCAL_DETERMINISTIC_FIXTURE_ONLY"
    || scope.durableDatabase !== "LOOPBACK_DISPOSABLE_POSTGRES_ONLY"
    || scope.formalResearchWrites !== 0
    || hashes.algorithm !== "SHA256"
    || hashes.json !== "UTF8_LEXICOGRAPHIC_OBJECT_KEYS_ARRAY_ORDER_PRESERVED_NO_WHITESPACE"
    || materialHash.contentByteLength !== "UTF8_ORIGINAL_JAVASCRIPT_STRING_BYTE_LENGTH"
    || materialHash.contentHashPreimage !== "UTF8_JSON_STRINGIFY_ORIGINAL_JAVASCRIPT_STRING"
    || materialHash.contentHash !== "SHA256_CONTENT_HASH_PREIMAGE"
    || materialHash.originalContent !== "EXACT_JS_STRING_AND_ORDER_PRESERVED"
    || materialHash.normalization !== "NO_TRIM_NO_NFC_NO_CASE_FOLD_NO_ALIAS_NO_FALLBACK"
    || execution.oneRunScope !== "EXACT_PRODUCT_BUNDLE_AND_RESOLVED_WORKSPACE_AUTHORITY_ROOT"
    || execution.claimRule !== "ATOMIC_CREATE_NEW_BEFORE_PORT_DATABASE_OR_CHILD"
    || execution.environmentRule !== "ORDERED_NONSECRET_VALUES_AND_CHILD_FINGERPRINT_EQUALITY"
    || execution.terminalRule !== "STARTED_CONVERGES_TO_PASS_FAIL_BLOCKED_OR_EXTERNAL_BLOCKED"
    || execution.observationRule !== "APPEND_ONLY_HASH_BOUND_LEDGER_WITH_DATABASE_PARITY"
    || execution.cleanupRule !== "REGISTERED_PROCESS_LISTENER_AND_OWNED_ROOT_INVENTORY"
    || professor.automatedVerdictForbidden !== true
    || professor.visibleMeaning !== "Professor manually reviews one frozen product hash after a separate environment preflight"
    || !Array.isArray(requirements)
    || requirements.length !== journeys.length
    || journeys.some((item, index) => requirements[index] !== item)) throw new Error(code);
  const ids = Object.entries(V2_BETA2_ACCEPTANCE_CONTROLS);
  if (ids.some(([name, id]) => controls[name] !== id)
    || Object.entries(V2_BETA2_ACCEPTANCE_MATERIAL_IDENTITY).some(([name, rule]) => materialIdentity[name] !== rule)
    || new Set(ids.map(([, id]) => id)).size !== ids.length) throw new Error(code);
  const serialized = JSON.stringify(input);
  if (/ACTION_ID|DELIVERY_KEY|candidate|localhost|127\.0\.0\.1|:\d{2,5}|\btemp(?:orary)?\b|harness|professorUat(?:Pass|Verdict)/iu.test(serialized)) throw new Error(code);
  return input as V2Beta2ProductAcceptanceContract;
}

export function parseV2Beta2ProductAcceptanceVectors(value: unknown) {
  const code = "beta2_product_acceptance_vectors_invalid";
  const input = exact(value, ["schemaId", "contractId", "materialHashKnownAnswers", "vectors"], code);
  if (input.schemaId !== V2_BETA2_PRODUCT_ACCEPTANCE_VECTOR_SCHEMA_ID
    || input.contractId !== V2_BETA2_PRODUCT_ACCEPTANCE_CONTRACT_ID
    || !Array.isArray(input.materialHashKnownAnswers)
    || input.materialHashKnownAnswers.length !== V2_BETA2_MATERIAL_HASH_KNOWN_ANSWERS.length
    || !Array.isArray(input.vectors)
    || input.vectors.length !== V2_BETA2_ACCEPTANCE_VECTOR_KINDS.length) throw new Error(code);
  const materialHashKnownAnswers = input.materialHashKnownAnswers.map((raw, index) => {
    const answer = exact(raw, ["id", "content", "contentByteLength", "canonicalPreimageByteLength", "contentHash", "rawUtf8Sha256Negative"], code);
    const expected = V2_BETA2_MATERIAL_HASH_KNOWN_ANSWERS[index];
    if (answer.id !== expected.id
      || answer.content !== expected.content
      || answer.contentByteLength !== expected.contentByteLength
      || answer.canonicalPreimageByteLength !== expected.canonicalPreimageByteLength
      || answer.contentHash !== expected.contentHash
      || answer.rawUtf8Sha256Negative !== expected.rawUtf8Sha256Negative
      || typeof answer.contentHash !== "string"
      || typeof answer.rawUtf8Sha256Negative !== "string"
      || !/^[0-9a-f]{64}$/u.test(answer.contentHash)
      || !/^[0-9a-f]{64}$/u.test(answer.rawUtf8Sha256Negative)
      || answer.contentHash === answer.rawUtf8Sha256Negative) throw new Error(code);
    return Object.freeze({ ...answer });
  });
  const seen = new Set<string>();
  const parsed = input.vectors.map((raw, index) => {
    const common = object(raw, code);
    if (typeof common.id !== "string" || !/^[a-z][a-z0-9-]{7,80}$/u.test(common.id) || seen.has(common.id)) throw new Error(code);
    seen.add(common.id);
    const kind = common.kind;
    if (kind !== V2_BETA2_ACCEPTANCE_VECTOR_KINDS[index]) throw new Error(code);
    if (kind === "PARTIAL_SUCCESS") {
      const vector = exact(common, ["id", "kind", "materials", "expected"], code);
      const expected = exact(vector.expected, ["directionCount", "recommendedLane", "s0FieldCount", "formalResearchWrites"], code);
      if (!Array.isArray(vector.materials) || vector.materials.length !== 3
        || expected.directionCount !== 3 || expected.recommendedLane !== "BALANCED_RECOMMENDED"
        || expected.s0FieldCount !== 13 || expected.formalResearchWrites !== 0) throw new Error(code);
      vector.materials.forEach((material) => {
        const item = exact(material, ["materialId", "kind", "title", "content", "contentByteLength", "contentHash"], code);
        if (typeof item.materialId !== "string" || typeof item.kind !== "string" || typeof item.title !== "string" || typeof item.content !== "string"
          || !Number.isSafeInteger(item.contentByteLength) || (item.contentByteLength as number) < 1
          || typeof item.contentHash !== "string" || !/^[0-9a-f]{64}$/u.test(item.contentHash)) throw new Error(code);
      });
    } else if (kind === "MATERIAL_REJECT") {
      const vector = exact(common, ["id", "kind", "content", "expectedCode"], code);
      if (typeof vector.content !== "string" || vector.expectedCode !== "beta2_material_content_invalid") throw new Error(code);
    } else if (kind === "COMPLETION_UNKNOWN" || kind === "TERMINAL_REJECTED") {
      const keys = kind === "COMPLETION_UNKNOWN" ? ["id", "kind", "expectedLookupOnly", "expectedResubmit"] : ["id", "kind", "expectedSuccess", "expectedResubmit"];
      const vector = exact(common, keys, code);
      if ((kind === "COMPLETION_UNKNOWN" && vector.expectedLookupOnly !== true)
        || (kind === "TERMINAL_REJECTED" && vector.expectedSuccess !== false)
        || vector.expectedResubmit !== 0) throw new Error(code);
    } else if (kind === "EXACT_REPLAY") {
      const vector = exact(common, ["id", "kind", "expectedAppendDelta", "expectedSubmissionDelta"], code);
      if (vector.expectedAppendDelta !== 0 || vector.expectedSubmissionDelta !== 0) throw new Error(code);
    } else if (kind === "SAME_KEY_CONFLICT") {
      const vector = exact(common, ["id", "kind", "expectedCode", "expectedEffectDelta"], code);
      if (vector.expectedCode !== "beta2_idempotency_conflict" || vector.expectedEffectDelta !== 0) throw new Error(code);
    } else if (kind === "AUTHORITY_REJECT") {
      const vector = exact(common, ["id", "kind", "expectedStatuses", "expectedEffectDelta"], code);
      const statuses = exact(vector.expectedStatuses, ["unauthenticated", "disabled", "passwordChangeRequired", "crossTenant", "inactive", "unknown"], code);
      if (statuses.unauthenticated !== 401 || statuses.disabled !== 401 || statuses.passwordChangeRequired !== 428
        || statuses.crossTenant !== 404 || statuses.inactive !== 404 || statuses.unknown !== 404
        || vector.expectedEffectDelta !== 0) throw new Error(code);
    } else {
      const vector = exact(common, ["id", "kind", "stage", "targetMaterialId", "content", "contentByteLength", "canonicalPreimageByteLength", "contentHash", "rawUtf8Sha256Negative"], code);
      if (vector.id !== "partial-material-browser-dom-lf"
        || vector.stage !== "BROWSER_DOM_TEXT_VALUE"
        || vector.targetMaterialId !== "acceptance-material-02"
        || vector.content !== "第一行\n第二行；限定為未驗證材料。"
        || vector.contentByteLength !== 49
        || vector.canonicalPreimageByteLength !== 52
        || vector.contentHash !== "256a44a40bc20a0c09b7c94277c33ad64a142f823c4d899de2178e78ad28a685"
        || vector.rawUtf8Sha256Negative !== "8da160dc6825a2267a8edc21ce5367c0f3642c51569aff48f77bb4a95351204d") throw new Error(code);
    }
    return common;
  });
  return Object.freeze({
    schemaId: V2_BETA2_PRODUCT_ACCEPTANCE_VECTOR_SCHEMA_ID,
    contractId: V2_BETA2_PRODUCT_ACCEPTANCE_CONTRACT_ID,
    materialHashKnownAnswers: Object.freeze(materialHashKnownAnswers),
    vectors: Object.freeze(parsed),
  });
}

const V2_BETA2_VERIFIER_FAIL_STAGES = Object.freeze([
  "LOAD_AUTHORITY", "CONTRACT_PARSE", "KNOWN_ANSWER_HASHES", "BEHAVIORAL_VECTORS",
  "PROVIDER_BOUNDARY", "PUBLIC_SURFACE", "TOTAL_TERMINAL", "FAULT_MATRIX", "ACCEPTANCE_BUNDLE", "COMPLETE",
] as const);

function acceptanceHash(value: unknown, code: string) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) throw new Error(code);
  return value;
}

function acceptanceCount(value: unknown, minimum: number, maximum: number, code: string) {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) throw new Error(code);
  return value as number;
}

function acceptanceReason(value: unknown, code: string) {
  if (typeof value !== "string" || !/^[A-Z][A-Z0-9_]{2,95}$/u.test(value)) throw new Error(code);
  return value;
}

function acceptanceText(value: unknown, minimum: number, maximum: number, code: string) {
  if (typeof value !== "string" || value.length < minimum || value.length > maximum || value.includes("\0")) throw new Error(code);
  return value;
}

function nullableText(value: unknown, maximum: number, code: string) {
  return value === null ? null : acceptanceText(value, 1, maximum, code);
}

function leafAuthority(value: unknown, code: string) {
  const input = exact(value, ["path", "size", "sha256"], code);
  return Object.freeze({ path: acceptanceText(input.path, 1, 2_048, code), size: acceptanceCount(input.size, 1, Number.MAX_SAFE_INTEGER, code), sha256: acceptanceHash(input.sha256, code) });
}

function nullableLeafAuthority(value: unknown, code: string) {
  return value === null ? null : leafAuthority(value, code);
}

function productAuthority(value: unknown, code: string) {
  const input = exact(value, ["fileCount", "totalBytes", "entryStreamBytes", "entryStreamSha256"], code);
  return Object.freeze({ fileCount: acceptanceCount(input.fileCount, 1, 1_000_000, code), totalBytes: acceptanceCount(input.totalBytes, 1, Number.MAX_SAFE_INTEGER, code), entryStreamBytes: acceptanceCount(input.entryStreamBytes, 1, Number.MAX_SAFE_INTEGER, code), entryStreamSha256: acceptanceHash(input.entryStreamSha256, code) });
}

function failureAuthority(value: unknown, code: string) {
  if (value === null) return null;
  const input = exact(value, ["stage", "reasonCode"], code);
  return Object.freeze({ stage: acceptanceReason(input.stage, code), reasonCode: acceptanceReason(input.reasonCode, code) });
}

function cleanupSummary(value: unknown, code: string) {
  const input = exact(value, ["status", "listenerCount", "processResidualCount", "tempResidualCount"], code);
  if (!["PASS", "FAIL", "UNKNOWN"].includes(input.status as string)) throw new Error(code);
  return Object.freeze({ status: input.status as "PASS" | "FAIL" | "UNKNOWN", listenerCount: acceptanceCount(input.listenerCount, 0, 10_000, code), processResidualCount: acceptanceCount(input.processResidualCount, 0, 10_000, code), tempResidualCount: acceptanceCount(input.tempResidualCount, 0, 10_000, code) });
}

function strictRecord(raw: unknown, parser: (value: unknown) => unknown, code: string) {
  if (typeof raw !== "string" || raw.startsWith("\uFEFF") || !raw.endsWith("\n") || raw.endsWith("\n\n")) throw new Error(code);
  const parsed = parser(parseDuplicateAwareJson(raw.slice(0, -1), code));
  if (`${JSON.stringify(parsed)}\n` !== raw) throw new Error(code);
  return parsed;
}

function environmentAuthority(value: unknown, code: string) {
  if (!Array.isArray(value) || value.length !== 6) throw new Error(code);
  const expected = ["SystemRoot", "WINDIR", "ComSpec", "PATH", "TEMP", "TMP"];
  const parsed = value.map((entry, index) => {
    const item = exact(entry, ["key", "value"], code);
    if (item.key !== expected[index]) throw new Error(code);
    return Object.freeze({ key: expected[index], value: acceptanceText(item.value, 1, 4_096, code) });
  });
  return Object.freeze(parsed);
}

function toolAuthority(value: unknown, code: string) {
  const input = exact(value, ["launcher", "runner", "node", "powershell", "taskkill"], code);
  return Object.freeze({ launcher: leafAuthority(input.launcher, code), runner: leafAuthority(input.runner, code), node: leafAuthority(input.node, code), powershell: leafAuthority(input.powershell, code), taskkill: leafAuthority(input.taskkill, code) });
}

function receiptCounters(value: unknown, code: string) {
  const input = exact(value, ["journeys", "viewports", "successfulAuthSessions", "productGetRequests", "productPostRequests", "providerSubmissions", "snapshots", "events", "reloads", "idempotentReplays", "idempotencyConflicts", "unknownLookupRequests", "formalResearchWrites", "nonloopbackBrowserRequests", "axeSerious", "axeCritical", "keyboardFocusChecks", "liveRegionChecks"], code);
  const parsed = Object.freeze({
    journeys: acceptanceCount(input.journeys, 1, 10, code), viewports: acceptanceCount(input.viewports, 1, 10, code), successfulAuthSessions: acceptanceCount(input.successfulAuthSessions, 1, 100, code),
    productGetRequests: acceptanceCount(input.productGetRequests, 1, 10_000, code), productPostRequests: acceptanceCount(input.productPostRequests, 1, 10_000, code), providerSubmissions: acceptanceCount(input.providerSubmissions, 0, 100, code), snapshots: acceptanceCount(input.snapshots, 0, 100, code), events: acceptanceCount(input.events, 0, 100, code),
    reloads: acceptanceCount(input.reloads, 1, 100, code), idempotentReplays: acceptanceCount(input.idempotentReplays, 0, 100, code), idempotencyConflicts: acceptanceCount(input.idempotencyConflicts, 0, 100, code), unknownLookupRequests: acceptanceCount(input.unknownLookupRequests, 0, 100, code), formalResearchWrites: acceptanceCount(input.formalResearchWrites, 0, 100, code), nonloopbackBrowserRequests: acceptanceCount(input.nonloopbackBrowserRequests, 0, 100, code),
    axeSerious: acceptanceCount(input.axeSerious, 0, 100, code), axeCritical: acceptanceCount(input.axeCritical, 0, 100, code), keyboardFocusChecks: acceptanceCount(input.keyboardFocusChecks, 1, 100, code), liveRegionChecks: acceptanceCount(input.liveRegionChecks, 1, 100, code),
  });
  if (parsed.journeys !== 1 || parsed.viewports !== 2 || parsed.successfulAuthSessions !== 7 || parsed.productPostRequests !== 7 || parsed.providerSubmissions !== 4 || parsed.snapshots !== 4 || parsed.events !== 6 || parsed.reloads !== 2 || parsed.idempotentReplays !== 1 || parsed.idempotencyConflicts !== 1 || parsed.unknownLookupRequests !== 1 || parsed.formalResearchWrites !== 0 || parsed.nonloopbackBrowserRequests !== 0 || parsed.axeSerious !== 0 || parsed.axeCritical !== 0) throw new Error(code);
  return parsed;
}

function externalEffects(value: unknown, code: string) {
  const input = exact(value, ["liveProvider", "formalResearchWrite", "nonloopbackNetwork"], code);
  if (input.liveProvider !== 0 || input.formalResearchWrite !== 0 || input.nonloopbackNetwork !== 0) throw new Error(code);
  return Object.freeze({ liveProvider: 0 as const, formalResearchWrite: 0 as const, nonloopbackNetwork: 0 as const });
}

function byteProvenance(value: unknown, code: string) {
  const input = exact(value, ["apiFileCrlf", "browserDomLf"], code);
  const parse = (entry: unknown, stage: string, byteLength: number, contentHash: string) => {
    const item = exact(entry, ["stage", "contentByteLength", "contentHash"], code);
    if (item.stage !== stage || item.contentByteLength !== byteLength || item.contentHash !== contentHash) throw new Error(code);
    return Object.freeze({ stage, contentByteLength: byteLength, contentHash });
  };
  return Object.freeze({
    apiFileCrlf: parse(input.apiFileCrlf, "ORIGINAL_API_OR_FILE_STRING", 50, "5be5c122cb4c06ebc61556389f3240c15b7dfc942bf301d2c7c4e009fd07f071"),
    browserDomLf: parse(input.browserDomLf, "BROWSER_DOM_TEXT_VALUE", 49, "256a44a40bc20a0c09b7c94277c33ad64a142f823c4d899de2178e78ad28a685"),
  });
}

export type V2Beta2ProductAcceptanceVerifierResult = ReturnType<typeof parseV2Beta2ProductAcceptanceVerifierResult>;

export function parseV2Beta2ProductAcceptanceVerifierResult(value: unknown) {
  const code = "beta2_product_acceptance_verifier_result_invalid";
  const discriminator = object(value, code);
  if (discriminator.status === "FAIL") {
    const input = exact(discriminator, ["schemaId", "status", "stage", "reasonCode"], code);
    if (input.schemaId !== V2_BETA2_PRODUCT_ACCEPTANCE_VERIFIER_RESULT_SCHEMA_ID || !V2_BETA2_VERIFIER_FAIL_STAGES.includes(input.stage as typeof V2_BETA2_VERIFIER_FAIL_STAGES[number])) throw new Error(code);
    return Object.freeze({ schemaId: V2_BETA2_PRODUCT_ACCEPTANCE_VERIFIER_RESULT_SCHEMA_ID, status: "FAIL" as const, stage: input.stage as typeof V2_BETA2_VERIFIER_FAIL_STAGES[number], reasonCode: acceptanceReason(input.reasonCode, code) });
  }
  const input = exact(discriminator, ["schemaId", "status", "contractId", "productContract", "acceptanceBundleSha256", "contractFileSha256", "vectorsFileSha256", "knownAnswerCount", "behavioralVectorCount", "assertions", "faultMatrixCases", "externalEffects", "trustClass"], code);
  if (input.schemaId !== V2_BETA2_PRODUCT_ACCEPTANCE_VERIFIER_RESULT_SCHEMA_ID || input.status !== "PASS" || input.contractId !== V2_BETA2_PRODUCT_ACCEPTANCE_CONTRACT_ID || input.productContract !== V2_BETA2_PRODUCT_ACCEPTANCE_RUNTIME_CONTRACT || input.knownAnswerCount !== 6 || input.behavioralVectorCount !== 8 || input.faultMatrixCases !== 12 || input.externalEffects !== 0 || input.trustClass !== "LOCAL_PRODUCT_ACCEPTANCE_PASS_NOT_PROFESSOR_UAT") throw new Error(code);
  return Object.freeze({ schemaId: V2_BETA2_PRODUCT_ACCEPTANCE_VERIFIER_RESULT_SCHEMA_ID, status: "PASS" as const, contractId: V2_BETA2_PRODUCT_ACCEPTANCE_CONTRACT_ID, productContract: V2_BETA2_PRODUCT_ACCEPTANCE_RUNTIME_CONTRACT, acceptanceBundleSha256: acceptanceHash(input.acceptanceBundleSha256, code), contractFileSha256: acceptanceHash(input.contractFileSha256, code), vectorsFileSha256: acceptanceHash(input.vectorsFileSha256, code), knownAnswerCount: 6 as const, behavioralVectorCount: 8 as const, assertions: acceptanceCount(input.assertions, 1, 100_000, code), faultMatrixCases: 12 as const, externalEffects: 0 as const, trustClass: "LOCAL_PRODUCT_ACCEPTANCE_PASS_NOT_PROFESSOR_UAT" as const });
}

export function parseV2Beta2ProductAcceptanceVerifierResultJson(raw: unknown) { return strictRecord(raw, parseV2Beta2ProductAcceptanceVerifierResult, "beta2_product_acceptance_verifier_result_invalid") as V2Beta2ProductAcceptanceVerifierResult; }
export function serializeV2Beta2ProductAcceptanceVerifierResult(value: unknown) { return `${JSON.stringify(parseV2Beta2ProductAcceptanceVerifierResult(value))}\n`; }

export function parseV2Beta2ProductAcceptanceAttemptStart(value: unknown) {
  const code = "beta2_product_acceptance_attempt_start_invalid";
  const input = exact(value, ["schemaId", "status", "runKey", "attemptId", "productAuthority", "acceptanceBundleSha256", "authorityRootIdentity", "claimAuthority", "tools", "argv", "cwd", "environment", "environmentFingerprint", "ownedRoot", "observationReceiptPath", "cleanupReceiptPath", "innerOutcomePath", "postgresPort", "webPort", "deadlineMs"], code);
  if (input.schemaId !== V2_BETA2_PRODUCT_ACCEPTANCE_ATTEMPT_START_SCHEMA_ID || input.status !== "STARTED" || typeof input.attemptId !== "string" || !/^[0-9a-f]{32}$/u.test(input.attemptId) || !Array.isArray(input.argv) || input.argv.length < 1 || input.argv.some((item) => typeof item !== "string" || item.length < 1)) throw new Error(code);
  const authorityRoot = exact(input.authorityRootIdentity, ["resolvedPath", "volumeIdentity", "fileIdentity"], code);
  return Object.freeze({
    schemaId: V2_BETA2_PRODUCT_ACCEPTANCE_ATTEMPT_START_SCHEMA_ID, status: "STARTED" as const, runKey: acceptanceHash(input.runKey, code), attemptId: input.attemptId,
    productAuthority: productAuthority(input.productAuthority, code), acceptanceBundleSha256: acceptanceHash(input.acceptanceBundleSha256, code),
    authorityRootIdentity: Object.freeze({ resolvedPath: acceptanceText(authorityRoot.resolvedPath, 1, 2_048, code), volumeIdentity: acceptanceText(authorityRoot.volumeIdentity, 1, 128, code), fileIdentity: acceptanceText(authorityRoot.fileIdentity, 1, 128, code) }),
    claimAuthority: leafAuthority(input.claimAuthority, code), tools: toolAuthority(input.tools, code), argv: Object.freeze([...(input.argv as string[])]), cwd: acceptanceText(input.cwd, 1, 2_048, code), environment: environmentAuthority(input.environment, code), environmentFingerprint: acceptanceHash(input.environmentFingerprint, code),
    ownedRoot: acceptanceText(input.ownedRoot, 1, 2_048, code), observationReceiptPath: acceptanceText(input.observationReceiptPath, 1, 2_048, code), cleanupReceiptPath: acceptanceText(input.cleanupReceiptPath, 1, 2_048, code), innerOutcomePath: acceptanceText(input.innerOutcomePath, 1, 2_048, code),
    postgresPort: acceptanceCount(input.postgresPort, 1_024, 65_535, code), webPort: acceptanceCount(input.webPort, 1_024, 65_535, code), deadlineMs: acceptanceCount(input.deadlineMs, 60_000, 1_800_000, code),
  });
}

export function parseV2Beta2ProductAcceptanceAttemptStartJson(raw: unknown) { return strictRecord(raw, parseV2Beta2ProductAcceptanceAttemptStart, "beta2_product_acceptance_attempt_start_invalid"); }
export function serializeV2Beta2ProductAcceptanceAttemptStart(value: unknown) { return `${JSON.stringify(parseV2Beta2ProductAcceptanceAttemptStart(value))}\n`; }

function observationData(value: unknown, code: string) {
  const input = exact(value, ["method", "path", "statusCode", "operation", "replayed", "providerSubmissionDelta", "snapshotAppendDelta", "eventAppendDelta", "formalResearchWriteCount", "liveProviderCallCount", "projectId", "revision", "snapshotPresent", "jobId", "providerSubmissionCount", "stageOutcome", "authOutcome", "provenanceStage", "contentByteLength", "contentHash"], code);
  const nullableCount = (item: unknown, max: number) => item === null ? null : acceptanceCount(item, 0, max, code);
  if ((input.replayed !== null && typeof input.replayed !== "boolean") || (input.snapshotPresent !== null && typeof input.snapshotPresent !== "boolean")) throw new Error(code);
  return Object.freeze({ method: nullableText(input.method, 16, code), path: nullableText(input.path, 512, code), statusCode: nullableCount(input.statusCode, 599), operation: nullableText(input.operation, 128, code), replayed: input.replayed as boolean | null, providerSubmissionDelta: nullableCount(input.providerSubmissionDelta, 1), snapshotAppendDelta: nullableCount(input.snapshotAppendDelta, 1), eventAppendDelta: nullableCount(input.eventAppendDelta, 1), formalResearchWriteCount: nullableCount(input.formalResearchWriteCount, 1), liveProviderCallCount: nullableCount(input.liveProviderCallCount, 1), projectId: nullableText(input.projectId, 180, code), revision: nullableCount(input.revision, Number.MAX_SAFE_INTEGER), snapshotPresent: input.snapshotPresent as boolean | null, jobId: nullableText(input.jobId, 180, code), providerSubmissionCount: nullableCount(input.providerSubmissionCount, 1), stageOutcome: nullableText(input.stageOutcome, 64, code), authOutcome: nullableText(input.authOutcome, 64, code), provenanceStage: nullableText(input.provenanceStage, 64, code), contentByteLength: nullableCount(input.contentByteLength, Number.MAX_SAFE_INTEGER), contentHash: input.contentHash === null ? null : acceptanceHash(input.contentHash, code) });
}

export function parseV2Beta2ProductAcceptanceObservationReceipt(value: unknown) {
  const code = "beta2_product_acceptance_observation_receipt_invalid";
  const input = exact(value, ["schemaId", "status", "attemptId", "ledger", "ledgerSha256", "counters", "externalEffects", "byteProvenance", "assertions"], code);
  if (input.schemaId !== V2_BETA2_PRODUCT_ACCEPTANCE_OBSERVATION_RECEIPT_SCHEMA_ID || input.status !== "PASS" || typeof input.attemptId !== "string" || !/^[0-9a-f]{32}$/u.test(input.attemptId) || !Array.isArray(input.ledger) || input.ledger.length < 20) throw new Error(code);
  let previous = "0".repeat(64);
  const ledger = input.ledger.map((entry, index) => {
    const item = exact(entry, ["sequence", "kind", "label", "data", "previousEntryHash", "entryHash"], code);
    if (item.sequence !== index + 1 || !["ACTION", "REQUEST", "RESPONSE", "ASSERTION"].includes(item.kind as string) || item.previousEntryHash !== previous) throw new Error(code);
    const parsed = Object.freeze({ sequence: index + 1, kind: item.kind as "ACTION" | "REQUEST" | "RESPONSE" | "ASSERTION", label: acceptanceReason(item.label, code), data: observationData(item.data, code), previousEntryHash: acceptanceHash(item.previousEntryHash, code), entryHash: acceptanceHash(item.entryHash, code) });
    previous = parsed.entryHash;
    return parsed;
  });
  if (input.ledgerSha256 !== previous) throw new Error(code);
  return Object.freeze({ schemaId: V2_BETA2_PRODUCT_ACCEPTANCE_OBSERVATION_RECEIPT_SCHEMA_ID, status: "PASS" as const, attemptId: input.attemptId, ledger: Object.freeze(ledger), ledgerSha256: acceptanceHash(input.ledgerSha256, code), counters: receiptCounters(input.counters, code), externalEffects: externalEffects(input.externalEffects, code), byteProvenance: byteProvenance(input.byteProvenance, code), assertions: acceptanceCount(input.assertions, 1, 100_000, code) });
}

export function parseV2Beta2ProductAcceptanceObservationReceiptJson(raw: unknown) { return strictRecord(raw, parseV2Beta2ProductAcceptanceObservationReceipt, "beta2_product_acceptance_observation_receipt_invalid"); }
export function serializeV2Beta2ProductAcceptanceObservationReceipt(value: unknown) { return `${JSON.stringify(parseV2Beta2ProductAcceptanceObservationReceipt(value))}\n`; }

export function parseV2Beta2ProductAcceptanceBrowserFailure(value: unknown) {
  const code = "beta2_product_acceptance_browser_failure_invalid";
  const input = exact(value, ["schemaId", "status", "attemptId", "stage", "reasonCode"], code);
  if (input.schemaId !== V2_BETA2_PRODUCT_ACCEPTANCE_BROWSER_FAILURE_SCHEMA_ID || input.status !== "FAIL" || typeof input.attemptId !== "string" || !/^[0-9a-f]{32}$/u.test(input.attemptId)) throw new Error(code);
  return Object.freeze({ schemaId: V2_BETA2_PRODUCT_ACCEPTANCE_BROWSER_FAILURE_SCHEMA_ID, status: "FAIL" as const, attemptId: input.attemptId, stage: acceptanceReason(input.stage, code), reasonCode: acceptanceReason(input.reasonCode, code) });
}

export function parseV2Beta2ProductAcceptanceBrowserFailureJson(raw: unknown) { return strictRecord(raw, parseV2Beta2ProductAcceptanceBrowserFailure, "beta2_product_acceptance_browser_failure_invalid"); }
export function serializeV2Beta2ProductAcceptanceBrowserFailure(value: unknown) { return `${JSON.stringify(parseV2Beta2ProductAcceptanceBrowserFailure(value))}\n`; }

export function parseV2Beta2ProductAcceptanceCleanupReceipt(value: unknown) {
  const code = "beta2_product_acceptance_cleanup_receipt_invalid";
  const input = exact(value, ["schemaId", "status", "attemptId", "environmentFingerprint", "registeredPids", "descendantPids", "listenerPorts", "ownedRootInventory", "listenerCount", "processResidualCount", "tempResidualCount"], code);
  if (input.schemaId !== V2_BETA2_PRODUCT_ACCEPTANCE_CLEANUP_RECEIPT_SCHEMA_ID || input.status !== "PASS" || typeof input.attemptId !== "string" || !/^[0-9a-f]{32}$/u.test(input.attemptId)) throw new Error(code);
  const integerArray = (candidate: unknown, minimum: number, maximum: number) => {
    if (!Array.isArray(candidate) || candidate.some((item) => !Number.isSafeInteger(item) || item < minimum || item > maximum) || new Set(candidate).size !== candidate.length) throw new Error(code);
    return Object.freeze([...(candidate as number[])]);
  };
  if (!Array.isArray(input.ownedRootInventory) || input.ownedRootInventory.some((item) => typeof item !== "string" || item.length < 1) || new Set(input.ownedRootInventory).size !== input.ownedRootInventory.length) throw new Error(code);
  const listenerCount = acceptanceCount(input.listenerCount, 0, 10_000, code); const processResidualCount = acceptanceCount(input.processResidualCount, 0, 10_000, code); const tempResidualCount = acceptanceCount(input.tempResidualCount, 0, 10_000, code);
  if (listenerCount !== 0 || processResidualCount !== 0 || tempResidualCount !== 0) throw new Error(code);
  return Object.freeze({ schemaId: V2_BETA2_PRODUCT_ACCEPTANCE_CLEANUP_RECEIPT_SCHEMA_ID, status: "PASS" as const, attemptId: input.attemptId, environmentFingerprint: acceptanceHash(input.environmentFingerprint, code), registeredPids: integerArray(input.registeredPids, 1, 4_294_967_295), descendantPids: integerArray(input.descendantPids, 1, 4_294_967_295), listenerPorts: integerArray(input.listenerPorts, 1_024, 65_535), ownedRootInventory: Object.freeze([...(input.ownedRootInventory as string[])]), listenerCount: 0 as const, processResidualCount: 0 as const, tempResidualCount: 0 as const });
}

export function parseV2Beta2ProductAcceptanceCleanupReceiptJson(raw: unknown) { return strictRecord(raw, parseV2Beta2ProductAcceptanceCleanupReceipt, "beta2_product_acceptance_cleanup_receipt_invalid"); }
export function serializeV2Beta2ProductAcceptanceCleanupReceipt(value: unknown) { return `${JSON.stringify(parseV2Beta2ProductAcceptanceCleanupReceipt(value))}\n`; }

function databaseObservation(value: unknown, code: string) {
  const input = exact(value, ["jobs", "providerSubmissions", "snapshots", "events", "formalResearchWrites"], code);
  const result = Object.freeze({ jobs: acceptanceCount(input.jobs, 0, 100, code), providerSubmissions: acceptanceCount(input.providerSubmissions, 0, 100, code), snapshots: acceptanceCount(input.snapshots, 0, 100, code), events: acceptanceCount(input.events, 0, 100, code), formalResearchWrites: acceptanceCount(input.formalResearchWrites, 0, 100, code) });
  if (result.jobs !== 4 || result.providerSubmissions !== 4 || result.snapshots !== 4 || result.events !== 6 || result.formalResearchWrites !== 0) throw new Error(code);
  return result;
}

export function parseV2Beta2ProductAcceptanceInnerOutcome(value: unknown) {
  const code = "beta2_product_acceptance_inner_outcome_invalid";
  const discriminator = object(value, code);
  if (discriminator.status !== "PASS") {
    const input = exact(discriminator, ["schemaId", "status", "attemptId", "environmentFingerprint", "observationReceiptAuthority", "cleanupReceiptAuthority", "cleanup", "primaryFailure", "cleanupFailure"], code);
    if (input.schemaId !== V2_BETA2_PRODUCT_ACCEPTANCE_INNER_OUTCOME_SCHEMA_ID || !["FAIL", "BLOCKED"].includes(input.status as string) || typeof input.attemptId !== "string" || !/^[0-9a-f]{32}$/u.test(input.attemptId)) throw new Error(code);
    const primaryFailure = failureAuthority(input.primaryFailure, code); const cleanupFailure = failureAuthority(input.cleanupFailure, code); const cleanup = cleanupSummary(input.cleanup, code);
    if (input.status === "FAIL" && (!primaryFailure || cleanupFailure || cleanup.status !== "PASS")) throw new Error(code);
    if (input.status === "BLOCKED" && !primaryFailure && !cleanupFailure) throw new Error(code);
    return Object.freeze({ schemaId: V2_BETA2_PRODUCT_ACCEPTANCE_INNER_OUTCOME_SCHEMA_ID, status: input.status as "FAIL" | "BLOCKED", attemptId: input.attemptId, environmentFingerprint: acceptanceHash(input.environmentFingerprint, code), observationReceiptAuthority: nullableLeafAuthority(input.observationReceiptAuthority, code), cleanupReceiptAuthority: nullableLeafAuthority(input.cleanupReceiptAuthority, code), cleanup, primaryFailure, cleanupFailure });
  }
  const input = exact(discriminator, ["schemaId", "status", "attemptId", "contractId", "runtimeContract", "environmentFingerprint", "acceptanceBundleSha256", "contractFileSha256", "vectorsFileSha256", "acceptanceAuthorityAssertions", "observationReceiptAuthority", "cleanupReceiptAuthority", "databaseObservation", "counts", "externalEffects", "protocol", "cleanup", "primaryFailure", "cleanupFailure"], code);
  const protocol = exact(input.protocol, ["verifier", "database", "browser", "environment"], code); const cleanup = cleanupSummary(input.cleanup, code); const counts = receiptCounters(input.counts, code); const database = databaseObservation(input.databaseObservation, code);
  if (input.schemaId !== V2_BETA2_PRODUCT_ACCEPTANCE_INNER_OUTCOME_SCHEMA_ID || input.status !== "PASS" || typeof input.attemptId !== "string" || !/^[0-9a-f]{32}$/u.test(input.attemptId) || input.contractId !== V2_BETA2_PRODUCT_ACCEPTANCE_CONTRACT_ID || input.runtimeContract !== V2_BETA2_PRODUCT_ACCEPTANCE_RUNTIME_CONTRACT || protocol.verifier !== "PASS" || protocol.database !== "PASS" || protocol.browser !== "PASS" || protocol.environment !== "PASS" || cleanup.status !== "PASS" || input.primaryFailure !== null || input.cleanupFailure !== null || counts.providerSubmissions !== database.providerSubmissions || counts.snapshots !== database.snapshots || counts.events !== database.events || counts.formalResearchWrites !== database.formalResearchWrites) throw new Error(code);
  return Object.freeze({ schemaId: V2_BETA2_PRODUCT_ACCEPTANCE_INNER_OUTCOME_SCHEMA_ID, status: "PASS" as const, attemptId: input.attemptId, contractId: V2_BETA2_PRODUCT_ACCEPTANCE_CONTRACT_ID, runtimeContract: V2_BETA2_PRODUCT_ACCEPTANCE_RUNTIME_CONTRACT, environmentFingerprint: acceptanceHash(input.environmentFingerprint, code), acceptanceBundleSha256: acceptanceHash(input.acceptanceBundleSha256, code), contractFileSha256: acceptanceHash(input.contractFileSha256, code), vectorsFileSha256: acceptanceHash(input.vectorsFileSha256, code), acceptanceAuthorityAssertions: acceptanceCount(input.acceptanceAuthorityAssertions, 1, 100_000, code), observationReceiptAuthority: leafAuthority(input.observationReceiptAuthority, code), cleanupReceiptAuthority: leafAuthority(input.cleanupReceiptAuthority, code), databaseObservation: database, counts, externalEffects: externalEffects(input.externalEffects, code), protocol: Object.freeze({ verifier: "PASS" as const, database: "PASS" as const, browser: "PASS" as const, environment: "PASS" as const }), cleanup, primaryFailure: null, cleanupFailure: null });
}

export function parseV2Beta2ProductAcceptanceInnerOutcomeJson(raw: unknown) { return strictRecord(raw, parseV2Beta2ProductAcceptanceInnerOutcome, "beta2_product_acceptance_inner_outcome_invalid"); }
export function serializeV2Beta2ProductAcceptanceInnerOutcome(value: unknown) { return `${JSON.stringify(parseV2Beta2ProductAcceptanceInnerOutcome(value))}\n`; }

export function parseV2Beta2ProductAcceptanceLauncherTerminal(value: unknown) {
  const code = "beta2_product_acceptance_launcher_terminal_invalid";
  const input = exact(value, ["schemaId", "status", "runKey", "attemptId", "duplicateClaim", "claimAuthority", "startedAuthority", "innerOutcomeAuthority", "observationReceiptAuthority", "cleanupReceiptAuthority", "childObservation", "environmentFingerprint", "childEnvironmentFingerprint", "preProductAuthority", "postProductAuthority", "preAcceptanceBundleSha256", "postAcceptanceBundleSha256", "outerCleanup", "primaryFailure", "cleanupFailure"], code);
  if (input.schemaId !== V2_BETA2_PRODUCT_ACCEPTANCE_LAUNCHER_TERMINAL_SCHEMA_ID || !["PASS", "FAIL", "BLOCKED"].includes(input.status as string) || typeof input.attemptId !== "string" || !/^[0-9a-f]{32}$/u.test(input.attemptId) || typeof input.duplicateClaim !== "boolean") throw new Error(code);
  const child = exact(input.childObservation, ["spawnAttempted", "pid", "exitCode", "signal", "timedOut", "overflowed", "stdoutBytes", "stdoutSha256", "stderrBytes", "stderrSha256", "gracefulTerminationAttempted", "forcedTerminationAttempted"], code);
  if (typeof child.spawnAttempted !== "boolean" || (child.pid !== null && (!Number.isSafeInteger(child.pid) || (child.pid as number) < 1)) || (child.exitCode !== null && (!Number.isSafeInteger(child.exitCode) || (child.exitCode as number) < 0 || (child.exitCode as number) > 255)) || (child.signal !== null && typeof child.signal !== "string") || typeof child.timedOut !== "boolean" || typeof child.overflowed !== "boolean" || typeof child.gracefulTerminationAttempted !== "boolean" || typeof child.forcedTerminationAttempted !== "boolean") throw new Error(code);
  const cleanup = cleanupSummary(input.outerCleanup, code); const pre = productAuthority(input.preProductAuthority, code); const post = productAuthority(input.postProductAuthority, code); const primaryFailure = failureAuthority(input.primaryFailure, code); const cleanupFailure = failureAuthority(input.cleanupFailure, code);
  const terminal = Object.freeze({ schemaId: V2_BETA2_PRODUCT_ACCEPTANCE_LAUNCHER_TERMINAL_SCHEMA_ID, status: input.status as "PASS" | "FAIL" | "BLOCKED", runKey: acceptanceHash(input.runKey, code), attemptId: input.attemptId, duplicateClaim: input.duplicateClaim, claimAuthority: leafAuthority(input.claimAuthority, code), startedAuthority: nullableLeafAuthority(input.startedAuthority, code), innerOutcomeAuthority: nullableLeafAuthority(input.innerOutcomeAuthority, code), observationReceiptAuthority: nullableLeafAuthority(input.observationReceiptAuthority, code), cleanupReceiptAuthority: nullableLeafAuthority(input.cleanupReceiptAuthority, code), childObservation: Object.freeze({ spawnAttempted: child.spawnAttempted, pid: child.pid as number | null, exitCode: child.exitCode as number | null, signal: child.signal as string | null, timedOut: child.timedOut, overflowed: child.overflowed, stdoutBytes: acceptanceCount(child.stdoutBytes, 0, 16_777_216, code), stdoutSha256: acceptanceHash(child.stdoutSha256, code), stderrBytes: acceptanceCount(child.stderrBytes, 0, 16_777_216, code), stderrSha256: acceptanceHash(child.stderrSha256, code), gracefulTerminationAttempted: child.gracefulTerminationAttempted, forcedTerminationAttempted: child.forcedTerminationAttempted }), environmentFingerprint: acceptanceHash(input.environmentFingerprint, code), childEnvironmentFingerprint: input.childEnvironmentFingerprint === null ? null : acceptanceHash(input.childEnvironmentFingerprint, code), preProductAuthority: pre, postProductAuthority: post, preAcceptanceBundleSha256: acceptanceHash(input.preAcceptanceBundleSha256, code), postAcceptanceBundleSha256: acceptanceHash(input.postAcceptanceBundleSha256, code), outerCleanup: cleanup, primaryFailure, cleanupFailure });
  const stable = JSON.stringify(pre) === JSON.stringify(post) && terminal.preAcceptanceBundleSha256 === terminal.postAcceptanceBundleSha256;
  if (terminal.status === "PASS" && (terminal.duplicateClaim || !terminal.startedAuthority || !terminal.innerOutcomeAuthority || !terminal.observationReceiptAuthority || !terminal.cleanupReceiptAuthority || child.exitCode !== 0 || child.signal !== null || child.timedOut || child.overflowed || cleanup.status !== "PASS" || !stable || primaryFailure || cleanupFailure || terminal.childEnvironmentFingerprint !== terminal.environmentFingerprint)) throw new Error(code);
  if (terminal.status === "FAIL" && (terminal.duplicateClaim || !terminal.startedAuthority || !terminal.innerOutcomeAuthority || child.exitCode !== 1 || child.signal !== null || child.timedOut || child.overflowed || cleanup.status !== "PASS" || !stable || !primaryFailure || cleanupFailure)) throw new Error(code);
  if (terminal.status === "BLOCKED" && !primaryFailure && !cleanupFailure) throw new Error(code);
  if (terminal.duplicateClaim && (terminal.status !== "BLOCKED" || child.spawnAttempted || terminal.startedAuthority !== null || terminal.innerOutcomeAuthority !== null)) throw new Error(code);
  return terminal;
}

export function parseV2Beta2ProductAcceptanceLauncherTerminalJson(raw: unknown) { return strictRecord(raw, parseV2Beta2ProductAcceptanceLauncherTerminal, "beta2_product_acceptance_launcher_terminal_invalid"); }
export function serializeV2Beta2ProductAcceptanceLauncherTerminal(value: unknown) { return `${JSON.stringify(parseV2Beta2ProductAcceptanceLauncherTerminal(value))}\n`; }
