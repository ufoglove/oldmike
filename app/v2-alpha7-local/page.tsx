import { notFound } from "next/navigation";

import { V2Alpha7ReviewStudio } from "@/components/v2-alpha7/V2Alpha7ReviewStudio";
import { alpha7PrototypeEnabled } from "@/lib/v2-alpha7/page-authority";

export default function V2Alpha7LocalPage() {
  if (!alpha7PrototypeEnabled()) notFound();
  return <V2Alpha7ReviewStudio />;
}
