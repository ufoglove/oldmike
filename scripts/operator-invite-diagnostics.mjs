const ERROR_CODE_CATEGORIES = new Map([
  ["28P01", "DATABASE_AUTHENTICATION"],
  ["28000", "DATABASE_AUTHORIZATION"],
  ["3D000", "DATABASE_NOT_FOUND"],
  ["42P01", "DATABASE_SCHEMA_MISSING"],
  ["42501", "DATABASE_PERMISSION"],
  ["23503", "DATABASE_CONSTRAINT"],
  ["23505", "DATABASE_CONSTRAINT"],
  ["23514", "DATABASE_CONSTRAINT"],
  ["ECONNREFUSED", "DATABASE_CONNECTION"],
  ["ETIMEDOUT", "DATABASE_CONNECTION"],
  ["ENOTFOUND", "DATABASE_CONNECTION"],
  ["EAI_AGAIN", "DATABASE_CONNECTION"],
]);

const ERROR_CODE_PATTERN = /\b(28P01|28000|3D000|42P01|42501|23503|23505|23514|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN)\b/i;

export function errorCodeOf(error) {
  return typeof error?.code === "string" && error.code.length > 0
    ? error.code.toUpperCase()
    : "UNKNOWN";
}

export function categoryFromErrorCode(code) {
  return ERROR_CODE_CATEGORIES.get(String(code ?? "").toUpperCase()) ?? "UNKNOWN";
}

export function classifyError(error) {
  const code = errorCodeOf(error);
  return {
    code,
    category: categoryFromErrorCode(code),
  };
}

export function classifyCapturedOutput(output) {
  const match = String(output ?? "").match(ERROR_CODE_PATTERN);
  const code = match?.[1]?.toUpperCase() ?? "UNKNOWN";
  return {
    code,
    category: categoryFromErrorCode(code),
  };
}

export function parseSafeCount(row, field) {
  if (!row || typeof row !== "object" ||
      !Object.prototype.hasOwnProperty.call(row, field) || row[field] === null) {
    return { ok: false, category: "RESULT_SHAPE", value: null };
  }

  const raw = row[field];
  if ((typeof raw !== "string" && typeof raw !== "number") ||
      (typeof raw === "string" && raw.trim().length === 0)) {
    return { ok: false, category: "COUNT_PARSE", value: null };
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) {
    return { ok: false, category: "COUNT_PARSE", value: null };
  }

  return { ok: true, category: null, value };
}

export function evaluatePhase0InventoryResult(row, {
  expectedTableCount = 13,
  expectedTargetFingerprint = null,
} = {}) {
  const countFields = [
    "postgres_major",
    "public_tables",
    "non_system_tables",
    "schemas_with_tables",
    "expected_tables_present",
    "project_count",
    "project_artifact_count",
    "active_unused_invite_count",
    "unvalidated_constraints",
    "invalid_indexes",
  ];
  const counts = {};

  for (const field of countFields) {
    const parsed = parseSafeCount(row, field);
    if (!parsed.ok) {
      return {
        allowed: false,
        resultCategory: parsed.category,
        failedField: field,
        counts,
      };
    }
    counts[field] = parsed.value;
  }

  const booleanFields = [
    "database_match",
    "user_match",
    "read_only",
    "public_schema",
    "public_usage",
  ];
  if (booleanFields.some((field) => typeof row?.[field] !== "boolean")) {
    return {
      allowed: false,
      resultCategory: "RESULT_SHAPE",
      failedField: booleanFields.find((field) => typeof row?.[field] !== "boolean"),
      counts,
    };
  }

  if (expectedTargetFingerprint !== null &&
      (typeof row?.target_fingerprint !== "string" ||
       row.target_fingerprint !== expectedTargetFingerprint)) {
    return {
      allowed: false,
      resultCategory: "RESULT_SHAPE",
      failedField: "target_fingerprint",
      counts,
    };
  }

  const checks = {
    database: row.database_match === true,
    user: row.user_match === true,
    readOnly: row.read_only === true,
    postgresMajor: counts.postgres_major === 18,
    publicSchema: row.public_schema === true,
    publicUsage: row.public_usage === true,
    publicTables: counts.public_tables === expectedTableCount,
    nonSystemTables: counts.non_system_tables === expectedTableCount,
    schemasWithTables: counts.schemas_with_tables === 1,
    expectedTablesPresent: counts.expected_tables_present === expectedTableCount,
    projects: counts.project_count === 0,
    projectArtifacts: counts.project_artifact_count === 0,
    activeUnusedInvites: counts.active_unused_invite_count === 0,
    constraints: counts.unvalidated_constraints === 0,
    indexes: counts.invalid_indexes === 0,
  };

  return {
    allowed: Object.values(checks).every(Boolean),
    resultCategory: Object.values(checks).every(Boolean) ? null : "RESULT_SHAPE",
    failedField: Object.entries(checks).find(([, passed]) => !passed)?.[0] ?? null,
    counts,
    checks,
  };
}

export function evaluateSchemaResult(row, expectedTableNames) {
  const tableNamesShape = Array.isArray(row?.table_names);
  if (!tableNamesShape) {
    return {
      readOnly: row?.read_only === true,
      schema: false,
      tableNamesShape: false,
      publicTables: row?.public_tables,
      inviteCount: row?.invite_count,
      resultCategory: "RESULT_SHAPE",
    };
  }

  const publicTables = parseSafeCount(row, "public_tables");
  const inviteCount = parseSafeCount(row, "invite_count");
  if (!publicTables.ok || !inviteCount.ok) {
    return {
      readOnly: row?.read_only === true,
      schema: false,
      tableNamesShape: true,
      publicTables: null,
      inviteCount: null,
      resultCategory: publicTables.category ?? inviteCount.category,
    };
  }

  const expected = new Set(expectedTableNames);
  const names = new Set(row.table_names);
  const schema = publicTables.value === expected.size &&
    names.size === expected.size &&
    [...expected].every((name) => names.has(name));

  return {
    readOnly: row?.read_only === true,
    schema,
    tableNamesShape: true,
    publicTables: publicTables.value,
    inviteCount: inviteCount.value,
    resultCategory: schema ? null : "UNKNOWN",
  };
}
