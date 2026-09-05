import Link from "next/link";
import AuthShell from "@/components/AuthShell";

export default function VerifyEmailPage() {
  return <AuthShell eyebrow="ADMIN-PROVISIONED ACCOUNT" title="不使用 Email 驗證建立帳號" description="Email 是登入識別；系統不會偽造 Email ownership verification。">
    <nav className="auth-links" aria-label="帳號選項"><Link href="/login">返回登入</Link></nav>
  </AuthShell>;
}
