import "server-only";

import { V2Beta2RepositoryError } from "./repository.ts";
import { resolveV2Beta2ProviderRuntime } from "./environment.ts";
import { DeterministicFakeV2Beta2Provider } from "./fake-provider.ts";
import type { V2Beta2ProviderPort } from "./provider-port.ts";

export function createV2Beta2RuntimeProvider(environment: Record<string, string | undefined> = process.env): V2Beta2ProviderPort {
  const decision = resolveV2Beta2ProviderRuntime(environment);
  if (decision.mode === "LOCAL_DETERMINISTIC_FIXTURE") return new DeterministicFakeV2Beta2Provider();
  throw new V2Beta2RepositoryError(decision.reasonCode, 503);
}
