import { notFound } from "next/navigation";

import { V2Beta2ResearchOS } from "@/components/v2-beta2/V2Beta2ResearchOS";
import { authenticateV2Beta2Page, resolveResearchTenant } from "@/lib/v2-beta2/auth";
import { parseV2Beta2ProjectId } from "@/lib/v2-beta2/contracts";
import { getV2Beta2DisposablePool } from "@/lib/v2-beta2/repository";

export const dynamic = "force-dynamic";

export default async function V2Beta2ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const authentication = await authenticateV2Beta2Page();
  if (!authentication.ok) notFound();
  let projectId: string;
  try {
    projectId = parseV2Beta2ProjectId((await params).projectId);
  } catch {
    notFound();
  }
  const tenant = await resolveResearchTenant(getV2Beta2DisposablePool(), authentication.userId, projectId);
  if (!tenant) notFound();
  return <V2Beta2ResearchOS projectId={tenant.projectId} projectTitle={tenant.projectTitle} />;
}
