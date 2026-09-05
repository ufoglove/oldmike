import { canonicalDomains, outputTrackIds, projectStageKeys } from "./research-config.ts";

export const PROJECT_LIST_SYSTEM_CONTRACT = [
  "Return exactly one JSON object and no prose or Markdown.",
  "This is a project-list response, not a single-project response.",
  "The only top-level keys allowed are status and projects. status must be exactly success.",
  "When no active projects exist, return exactly {\"status\":\"success\",\"projects\":[]}.",
  "Never return a single-project envelope, project_id/path at the top level, blocked/error status, Markdown fences, explanation text, or additional top-level keys.",
  "When projects exist, each object must contain exactly these fields: project_id, path, working_title, domain, output_track, current_stage, next_gate, recommended_action, evidence_status, risk_status, human_gate_status, known, unknown, assumptions, risks, human_confirmations, artifact_paths.",
  "Every path must be the exact relative form projects/active/<safe-project-id>; never emit a leading slash, a trailing slash, a filesystem prefix, an archive path, a backslash or any traversal segment.",
  "Every artifact_paths array must contain exactly projects/active/<safe-project-id>/PROJECT.md and projects/active/<safe-project-id>/STATE.yaml, with no other files.",
  `The canonical domains are exactly ${canonicalDomains.join(" | ")}.`,
  `Use output tracks ${outputTrackIds.join("|")} and stages ${projectStageKeys.join("|")}.`,
  "Emit the known status enum values in their exact uppercase form and read projects/active only. Do not write files.",
  "The Portal compatibility boundary recognizes only the observed legacy values unverified, high and pending, and conservatively maps them to UNVERIFIED, BLOCKED and REQUIRED with a visible warning; do not invent other mappings.",
].join(" ");
