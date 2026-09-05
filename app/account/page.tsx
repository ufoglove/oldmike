import Link from "next/link";
import { redirect } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import ProfileDisplayNameForm from "@/components/ProfileDisplayNameForm";
import { getPortalAccountContext } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const context = await getPortalAccountContext().catch(() => null);
  if (!context) redirect("/login");
  if (context.policy.mustChangePassword) redirect("/account/change-password");
  return <AuthShell eyebrow="ACCOUNT" title="帳號與安全" description="只顯示目前登入帳號的最小必要狀態。">
    <div className="account-summary">
      <p><strong>Email</strong><span>{context.session.user.email}</span></p>
      <p><strong>帳號狀態</strong><span>{context.policy.status}</span></p>
      <p><strong>Email ownership</strong><span>{context.session.user.emailVerified ? "已驗證" : "未聲稱已驗證"}</span></p>
    </div>
    <ProfileDisplayNameForm initialDisplayName={context.session.user.name} />
    <nav className="auth-links" aria-label="帳號操作">
      <Link href="/account/change-password">變更密碼</Link>
      {context.policy.isAdministrator && <Link href="/admin/accounts">帳號管理</Link>}
      <Link href="/">返回工作台</Link>
    </nav>
  </AuthShell>;
}
