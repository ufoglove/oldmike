import { notFound } from "next/navigation";

import { V2Alpha4JournalWorkspace } from "@/components/v2-alpha4/V2Alpha4JournalWorkspace";
import { V2_ALPHA4_BUILTIN_DOMAIN_OPTIONS } from "@/lib/v2-alpha4/page-authority";
import { V2_ALPHA4_TARGETS } from "@/lib/v2-alpha4/catalog";
import { createTargetSelection } from "@/lib/v2-alpha4/contracts";

export default function V2Alpha4LocalPage() {
  if (process.env.NODE_ENV !== "development" || process.env.TEST_FIXTURE !== "1" || process.env.OLD_MIKE_V2_ALPHA4_LOCAL_PROTOTYPE !== "1") notFound();
  return <V2Alpha4JournalWorkspace domains={V2_ALPHA4_BUILTIN_DOMAIN_OPTIONS} targets={V2_ALPHA4_TARGETS.map((target) => ({
    ...target,
    selection: target.enabled ? createTargetSelection(target.id) : null,
  }))} />;
}
