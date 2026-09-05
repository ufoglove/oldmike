import Link from "next/link";
import AuthShell from "@/components/AuthShell";

export default function ForgotPasswordPage() {
  return <AuthShell
    eyebrow="ACCOUNT RECOVERY"
    title="請聯絡 Portal 管理員"
    description="系統不使用 Email 密碼重設連結。管理員只能設定一次性的臨時密碼，無法讀取您目前的密碼。"
  >
    <p className="auth-notice" role="status">為避免洩漏帳號是否存在，公開端不會顯示個別帳號狀態。</p>
    <nav className="auth-links" aria-label="帳號選項"><Link href="/login">返回登入</Link></nav>
  </AuthShell>;
}
