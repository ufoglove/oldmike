import crypto from "node:crypto";
import type { S0Intake } from "@/lib/project-contract";

function stableJson(value: S0Intake) {
  return JSON.stringify({
    workingTitle: value.workingTitle,
    domain: value.domain,
    outputTrack: value.outputTrack,
    problemContext: value.problemContext,
    targetUsers: value.targetUsers,
    expectedContribution: value.expectedContribution,
    existingData: value.existingData,
    availableData: value.availableData,
    methodIdea: value.methodIdea,
    timeline: value.timeline,
    constraints: value.constraints,
    ethicsPrivacyRisks: value.ethicsPrivacyRisks,
    unresolvedItems: value.unresolvedItems,
  });
}

export function makeProjectId(intake: S0Intake) {
  const readable = intake.workingTitle
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42) || "research-project";
  const digest = crypto.createHash("sha256").update(stableJson(intake)).digest("hex").slice(0, 10);
  return `${readable}-${digest}`;
}

export function makePreviewHash(intake: S0Intake, projectId: string) {
  return crypto.createHash("sha256").update(`${projectId}\n${stableJson(intake)}`).digest("hex");
}
