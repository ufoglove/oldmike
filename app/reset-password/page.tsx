import Link from "next/link";
import AuthShell from "@/components/AuthShell";

export default function ResetPasswordPage() {
  return <AuthShell eyebrow="ACCOUNT RECOVERY" title="請聯絡 Portal 管理員" description="公開密碼重設連結已停用。管理員只能設定一次性臨時密碼，不能讀取目前密碼。">
    <nav className="auth-links" aria-label="帳號選項"><Link href="/login">返回登入</Link></nav>
  </AuthShell>;
}
