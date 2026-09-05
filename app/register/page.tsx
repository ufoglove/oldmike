import Link from "next/link";
import AuthShell from "@/components/AuthShell";

export default function RegisterPage() {
  return <AuthShell
    eyebrow="REGISTRATION CLOSED"
    title="公開註冊已永久關閉"
    description="帳號僅能由唯一 Portal Administrator 建立；不使用邀請或 Email 驗證建立帳號。"
  >
    <p className="auth-notice" role="status">如需帳號或臨時密碼，請透過核准的外部管道聯絡管理員。</p>
    <nav className="auth-links" aria-label="帳號選項"><Link href="/login">返回登入</Link></nav>
  </AuthShell>;
}
