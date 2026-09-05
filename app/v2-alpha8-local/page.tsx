import { notFound } from "next/navigation";

import { V2Alpha8PartialDraftWorkspace } from "@/components/v2-alpha8/V2Alpha8PartialDraftWorkspace";
import { V2_ALPHA3_BUILTIN_DOMAINS } from "@/lib/v2-alpha3/contracts";
import { alpha8PrototypeEnabled, V2_ALPHA8_GOAL_OPTIONS } from "@/lib/v2-alpha8/page-authority";

export default function V2Alpha8LocalPage() {
  if (!alpha8PrototypeEnabled()) notFound();
  const domains = V2_ALPHA3_BUILTIN_DOMAINS.map(({ id, label }) => ({ id, label }));
  return <V2Alpha8PartialDraftWorkspace domains={domains} goals={V2_ALPHA8_GOAL_OPTIONS} />;
}
