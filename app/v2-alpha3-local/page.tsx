import { notFound } from "next/navigation";

import { V2Alpha3Workspace } from "@/components/v2-alpha3/V2Alpha3Workspace";

export default function V2Alpha3LocalPage() {
  if (process.env.NODE_ENV !== "development" || process.env.TEST_FIXTURE !== "1" || process.env.OLD_MIKE_V2_ALPHA3_LOCAL_PROTOTYPE !== "1") notFound();
  return <V2Alpha3Workspace />;
}
