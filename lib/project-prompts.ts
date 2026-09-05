import type { OpenClawMessage } from "@/lib/openclaw";
import type { S0Intake } from "@/lib/project-contract";
import { PROJECT_LIST_SYSTEM_CONTRACT } from "./project-list-contract.ts";
import { projectStageKeys } from "./research-config.ts";

const machineContract = `Return exactly one JSON object and no prose or Markdown. The object must use this envelope: {"status":"success|blocked|error","project_id":"safe-id","path":"projects/active/<safe-id>","working_title":"string","domain":"one canonical domain","output_track":"NSTC|MOE|SCI|SSCI","current_stage":"${projectStageKeys.join("|")}","next_gate":"string","recommended_action":"exactly one action","evidence_status":"UNVERIFIED|SUPPORTED|VERIFIED|BLOCKED","risk_status":"UNVERIFIED|SUPPORTED|VERIFIED|BLOCKED","human_gate_status":"REQUIRED|CLEAR|UNVERIFIED","known":["string"],"unknown":["string"],"assumptions":["string"],"risks":["string"],"human_confirmations":["string"],"artifact_paths":["projects/active/<safe-id>/PROJECT.md","projects/active/<safe-id>/STATE.yaml"]}. For blocked/error, include error_code and error_message. Never claim a file exists unless you read or created it in the OpenClaw workspace.`;

const boundary = `You are a disabled legacy project-init helper for Old Mike Research OS. Portal session and tenant authorization plus PostgreSQL are the only formal project and research authorities. Agent workspace files are ephemeral compute/cache only and never a tenant boundary. Return blocked unless a tenant-scoped Portal database transaction has already created and bound the formal project. Never use browser storage, overwrite formal records, modify MEMORY.md, or expose secrets. Separate user-provided facts, unknowns, assumptions, risks and human confirmations. Do not promise funding, acceptance or ethical approval.`;
const projectListBoundary = `You are a disabled legacy observational project-file reader. Portal session and tenant authorization plus PostgreSQL are the only formal project-list authority. Agent workspace files are ephemeral compute/cache only and must never be returned as formal projects or authorization evidence. Do not write, initialize, update or archive any project; never use browser storage, modify MEMORY.md or expose secrets.`;

export function projectListMessages(): OpenClawMessage[] {
  return [
    { role: "system", content: `${projectListBoundary}\n${PROJECT_LIST_SYSTEM_CONTRACT}` },
    { role: "user", content: JSON.stringify({ operation: "list", instruction: "Read projects/active only. Return exactly the project-list contract. Do not write files." }) },
  ];
}

export function projectGetMessages(projectId: string): OpenClawMessage[] {
  return [
    { role: "system", content: `${boundary}\n${machineContract}` },
    { role: "user", content: JSON.stringify({ operation: "get", project_id: projectId, path: `projects/active/${projectId}`, instruction: "Read only the requested active project files and return a JSON summary. Do not write files." }) },
  ];
}

export function projectCreateMessages(projectId: string, intake: S0Intake): OpenClawMessage[] {
  return [
    { role: "system", content: `${boundary}\n${machineContract}\nFor create, first check whether projects/active/${projectId} or projects/archive/${projectId} already exists. If either exists, return blocked with project_exists and do not modify anything. If neither exists, create from the existing base-project template, write the S0 Intake into the appropriate project artifacts, set STATE.yaml to S0_INTAKE, and then re-read PROJECT.md and STATE.yaml before returning success. The expected project_id and path are fixed; do not choose another.` },
    { role: "user", content: JSON.stringify({ operation: "create", project_id: projectId, path: `projects/active/${projectId}`, human_confirmed: true, intake }) },
  ];
}
