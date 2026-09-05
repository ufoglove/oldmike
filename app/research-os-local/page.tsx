import { notFound } from "next/navigation";

import { V2Beta1ResearchOS } from "@/components/v2-beta1/V2Beta1ResearchOS";
import { v2Beta1PrototypeEnabled } from "@/lib/v2-beta1/page-authority";

export default function ResearchOSLocalPage() {
  if (!v2Beta1PrototypeEnabled()) notFound();
  return <V2Beta1ResearchOS />;
}
