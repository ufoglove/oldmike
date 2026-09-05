import { createBuiltinDomainSelection, createCustomDomainSelection, V2_ALPHA3_BUILTIN_DOMAINS } from "../v2-alpha3/contracts.ts";
import { alpha5Hash } from "./official-source-bundle.ts";

export const V2_ALPHA5_DOMAIN_OPTIONS = Object.freeze([
  ...V2_ALPHA3_BUILTIN_DOMAINS.map((domain) => ({ id: domain.id, label: domain.label, selection: createBuiltinDomainSelection(domain.id) })),
  {
    id: "custom-local-fixture",
    label: "我的自訂領域（本機示範）",
    selection: createCustomDomainSelection({ profileId: "profile-alpha5-local-fixture", version: 1, name: "我的自訂領域（本機示範）", contentHash: alpha5Hash({ name: "我的自訂領域（本機示範）", version: 1 }) }),
  },
]);
