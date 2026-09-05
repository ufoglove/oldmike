import { notFound } from "next/navigation";

import { V2Alpha5ProposalWorkspace } from "@/components/v2-alpha5/V2Alpha5ProposalWorkspace";
import { V2_ALPHA5_TARGETS } from "@/lib/v2-alpha5/contracts";
import { V2_ALPHA5_DOMAIN_OPTIONS } from "@/lib/v2-alpha5/page-authority";

export default function V2Alpha5LocalPage() {
  if (process.env.NODE_ENV !== "development" || process.env.TEST_FIXTURE !== "1" || process.env.OLD_MIKE_V2_ALPHA5_LOCAL_PROTOTYPE !== "1") notFound();
  return <V2Alpha5ProposalWorkspace domains={V2_ALPHA5_DOMAIN_OPTIONS} targets={V2_ALPHA5_TARGETS} />;
}
