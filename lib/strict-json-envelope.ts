export type StrictJsonEnvelopeStage = "JSON_ENVELOPE" | "JSON_PARSE" | "TOP_LEVEL_OBJECT";

export type StrictJsonObjectResult =
  | { ok: true; value: Record<string, unknown>; fenced: boolean }
  | { ok: false; stage: StrictJsonEnvelopeStage };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseStrictJsonObject(content: string, maximumBytes = 128_000): StrictJsonObjectResult {
  if (typeof content !== "string" || new TextEncoder().encode(content).byteLength > maximumBytes) return { ok: false, stage: "JSON_ENVELOPE" };
  const raw = content.trim();
  if (!raw) return { ok: false, stage: "JSON_ENVELOPE" };

  let candidate = raw;
  let fenced = false;
  if (raw.startsWith("```")) {
    const match = raw.match(/^```(?:json)?[\t ]*\r?\n([\s\S]*?)\r?\n```$/iu);
    if (!match) return { ok: false, stage: "JSON_ENVELOPE" };
    candidate = match[1].trim();
    fenced = true;
  }
  if (!candidate.startsWith("{") || !candidate.endsWith("}")) return { ok: false, stage: "JSON_ENVELOPE" };
  try {
    const value: unknown = JSON.parse(candidate);
    return isRecord(value) ? { ok: true, value, fenced } : { ok: false, stage: "TOP_LEVEL_OBJECT" };
  } catch {
    return { ok: false, stage: "JSON_PARSE" };
  }
}

export function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}
