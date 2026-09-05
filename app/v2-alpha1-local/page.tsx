import { notFound } from "next/navigation";
import OldMikeResearchOSV2 from "@/components/v2/OldMikeResearchOSV2";

export const dynamic = "force-dynamic";

export default function V2Alpha1LocalPrototypePage() {
  if (process.env.NODE_ENV !== "development" || process.env.TEST_FIXTURE !== "1" || process.env.OLD_MIKE_V2_LOCAL_PROTOTYPE !== "1") notFound();
  return <OldMikeResearchOSV2 displayName="林教授" />;
}
