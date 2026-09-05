import Link from "next/link";
import { redirect } from "next/navigation";
import GuidedResearchCenter from "@/components/GuidedResearchCenter";
import { getPortalAccountContext } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const context = await getPortalAccountContext().catch(() => null);
  if (!context) redirect("/login");
  if (context.policy.mustChangePassword) redirect("/account/change-password");
  return <>
    <nav className="account-toolbar" aria-label="帳號導覽">
      <Link href="/account">帳號與密碼</Link>
      {context.policy.isAdministrator && <Link href="/admin/accounts">帳號管理</Link>}
    </nav>
    <GuidedResearchCenter displayName={context.session.user.name} />
  </>;
}
