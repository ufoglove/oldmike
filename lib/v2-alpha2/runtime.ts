import "server-only";

import { randomUUID } from "node:crypto";

import { requireAuthenticatedUser } from "../request-auth.ts";
import { createV2Alpha2OldMikeProvider, createV2Alpha2SyntheticProvider } from "./provider.ts";
import { createV2Alpha2Repository, type V2Alpha2Principal } from "./repository.ts";
import { runV2Alpha2WorkerOnce } from "./worker.ts";

export function v2Alpha2RoutesEnabled() {
  return process.env.OLD_MIKE_V2_ALPHA2_SERVER_ENABLED === "1";
}

export async function resolveV2Alpha2Principal(request: Request): Promise<{ ok: true; principal: V2Alpha2Principal } | { ok: false; status: number; code: string }> {
  const workspaceId = request.headers.get("x-old-mike-v2-workspace")?.trim() ?? "";
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,159}$/u.test(workspaceId)) return { ok: false, status: 400, code: "workspace_authority_invalid" };
  if (process.env.NODE_ENV !== "production" && process.env.TEST_FIXTURE === "1" && process.env.OLD_MIKE_V2_ALPHA2_SYNTHETIC_PRINCIPAL === "1") {
    if (workspaceId !== "fixture-workspace-v2") return { ok: false, status: 404, code: "workspace_not_found" };
    return { ok: true, principal: { workspaceId, userId: "fixture-user-v2" } };
  }
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return { ok: false, status: 401, code: "authentication_required" };
  return { ok: true, principal: { workspaceId, userId: auth.session.user.id } };
}

const delay = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function syntheticDelayMilliseconds() {
  const requested = Number(process.env.OLD_MIKE_V2_ALPHA2_SYNTHETIC_DELAY_MS ?? "120");
  return Number.isInteger(requested) && requested >= 100 && requested <= 2_000 ? requested : 120;
}

export function kickV2Alpha2SyntheticWorker(principal: V2Alpha2Principal, maximumJobs: 1 | 2) {
  if (process.env.NODE_ENV === "production" || process.env.TEST_FIXTURE !== "1" || process.env.OLD_MIKE_V2_ALPHA2_SYNTHETIC_PROVIDER !== "1") return;
  const repository = createV2Alpha2Repository(principal);
  const provider = createV2Alpha2SyntheticProvider();
  const owner = `fixture-worker-${randomUUID()}`;
  queueMicrotask(async () => {
    for (let index = 0; index < maximumJobs; index += 1) {
      await delay(syntheticDelayMilliseconds());
      const result = await runV2Alpha2WorkerOnce(repository, provider, { workerOwner: owner, workerToken: randomUUID() }).catch(() => null);
      if (!result || result.outcome === "IDLE" || result.outcome === "RECONCILE_REQUIRED" || result.outcome === "TERMINAL_REJECTED") break;
    }
  });
}

export async function runV2Alpha2PrivateWorkerOnce(principal: V2Alpha2Principal) {
  if (process.env.OLD_MIKE_V2_ALPHA2_WORKER_ENABLED !== "1") return { outcome: "DISABLED" as const };
  const repository = createV2Alpha2Repository(principal);
  return runV2Alpha2WorkerOnce(repository, createV2Alpha2OldMikeProvider(), { workerOwner: `private-worker-${randomUUID()}`, workerToken: randomUUID() });
}
