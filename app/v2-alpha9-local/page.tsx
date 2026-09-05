import { notFound } from "next/navigation";

import { V2Alpha9FinalizationWorkspace } from "@/components/v2-alpha9/V2Alpha9FinalizationWorkspace";
import { alpha9PrototypeEnabled } from "@/lib/v2-alpha9/page-authority";

export default function V2Alpha9LocalPage() {
  if (!alpha9PrototypeEnabled()) notFound();
  return <V2Alpha9FinalizationWorkspace />;
}
