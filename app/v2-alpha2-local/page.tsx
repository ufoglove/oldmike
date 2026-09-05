import { notFound } from "next/navigation";
import { V2Alpha2ResearchStart } from "@/components/v2-alpha2/V2Alpha2ResearchStart";

export default function V2Alpha2LocalPage() {
  if (process.env.NODE_ENV !== "development" || process.env.TEST_FIXTURE !== "1" || process.env.OLD_MIKE_V2_ALPHA2_LOCAL_PROTOTYPE !== "1") notFound();
  return <V2Alpha2ResearchStart />;
}
