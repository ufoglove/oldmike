import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseProjectList, parseProjectEnvelope } from "../lib/project-contract.ts";
import { canonicalizeProjectListContent, canonicalizeProjectEnvelopeContent } from "../lib/project-list-canonicalizer.ts";
import { PROJECT_LIST_SYSTEM_CONTRACT } from "../lib/project-list-contract.ts";
import { projectListMessages } from "../lib/project-prompts.ts";

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");
const empty = JSON.parse(await read("contracts/project-list.empty.json")); const multiple = JSON.parse(await read("contracts/project-list.multiple.json")); const live = JSON.parse(await read("contracts/project-list.live-absolute-path.json"));
for (const [payload, count] of [[empty, 0], [multiple, 2]]) { const canonical = canonicalizeProjectListContent(JSON.stringify(payload)); assert(canonical.ok); const parsed = parseProjectList(canonical.content); assert(Array.isArray(parsed) && parsed.length === count); }
const rawLegacy = JSON.stringify(live); const strictRaw = parseProjectList(rawLegacy); assert(Array.isArray(strictRaw) === false); const canonical = canonicalizeProjectListContent(rawLegacy); assert(canonical.ok && canonical.compatibilityWarnings.length === 1); const parsed = parseProjectList(canonical.content); assert(Array.isArray(parsed) && parsed[0].riskStatus === "BLOCKED" && parsed[0].humanGateStatus === "REQUIRED" && parsed[0].evidenceStatus === "UNVERIFIED");
const rawSingle = JSON.stringify({ ...live.projects[0], status: "success" }); assert("status" in parseProjectEnvelope(rawSingle, "vr-63bc7bcef3")); const single = canonicalizeProjectEnvelopeContent(rawSingle, "vr-63bc7bcef3"); assert(single.ok && single.compatibilityWarnings.length === 1); assert(!("status" in parseProjectEnvelope(single.content, "vr-63bc7bcef3"))); assert(!canonicalizeProjectEnvelopeContent(rawSingle, "other-project").ok);
const prompt = projectListMessages().find((message) => message.role === "system")?.content || ""; assert(prompt.includes(PROJECT_LIST_SYSTEM_CONTRACT)); assert(prompt.includes("projects/active/<safe-project-id>")); assert(!prompt.includes("machineContract"));
const listRoute = await read("app/api/projects/route.ts"); const itemRoute = await read("app/api/projects/[projectId]/route.ts"); const page = await read("app/page.tsx"); const guided = await read("components/GuidedResearchCenter.tsx");
for (const route of [listRoute, itemRoute]) { assert(route.includes("requireAuthenticatedUser")); assert(route.includes("resolveTenantUser")); assert(!route.includes("callOpenClaw")); }
assert(page.includes("GuidedResearchCenter")); assert(guided.includes("CompatibilityWarning")); assert(guided.includes("setCompatibilityWarnings"));
console.log("project-list contracts: PASS (empty/multiple/legacy fixture parser, strict raw rejection, conservative canonicalization, tenant-gated routes, prompt contract)");
