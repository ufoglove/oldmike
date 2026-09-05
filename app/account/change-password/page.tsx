import { redirect } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import PasswordChangeForm from "@/components/PasswordChangeForm";
import { getPortalAccountContext } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const context = await getPortalAccountContext().catch(() => null);
  if (!context) redirect("/login");
  return <AuthShell
    eyebrow={context.policy.mustChangePassword ? "FIRST LOGIN" : "ACCOUNT SECURITY"}
    title={context.policy.mustChangePassword ? "首次登入必須變更密碼" : "變更密碼"}
    description="更新時必須提供目前密碼；成功後撤銷既有 Session。表單支援密碼管理器與貼上。"
  >
    <PasswordChangeForm mustChangePassword={context.policy.mustChangePassword} />
  </AuthShell>;
}
