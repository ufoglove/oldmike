import "server-only";

import { V2_ALPHA3_BUILTIN_DOMAINS, createBuiltinDomainSelection } from "../v2-alpha3/contracts.ts";

export const V2_ALPHA4_BUILTIN_DOMAIN_OPTIONS = V2_ALPHA3_BUILTIN_DOMAINS.map((domain) => {
  const selection = createBuiltinDomainSelection(domain.id);
  if (selection.kind !== "BUILTIN") throw new Error("alpha4_builtin_domain_authority_invalid");
  return { ...selection, label: domain.label };
});
