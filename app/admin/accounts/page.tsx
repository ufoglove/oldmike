import { redirect } from "next/navigation";
import Link from "next/link";
import AdminAccountsPanel from "@/components/AdminAccountsPanel";
import { getPortalAccountContext } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export default async function AdminAccountsPage() {
  const context = await getPortalAccountContext().catch(() => null);
  if (!context) redirect("/login");
  if (context.policy.mustChangePassword) redirect("/account/change-password");
  if (!context.policy.isAdministrator) redirect("/");
  return <main className="management-page">
    <header><p className="eyebrow">ADMIN ONLY</p><h1>帳號管理</h1><p>管理員只管理帳號生命週期；此頁不提供研究資料讀取、角色提升或 impersonation。</p><Link href="/">返回研究工作台</Link></header>
    <AdminAccountsPanel />
  </main>;
}
