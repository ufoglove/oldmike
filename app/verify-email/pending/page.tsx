import Link from "next/link";
import AuthShell from "@/components/AuthShell";
export default function VerifyPendingPage() { return <AuthShell eyebrow="CHECK YOUR INBOX" title="等待電子郵件驗證" description="帳號已建立待完成驗證。請檢查收件匣；驗證完成前不會建立正式 Session。"><p className="auth-notice" role="status">驗證信連結具有期限且只能使用一次。</p><p className="auth-links"><Link href="/verify-email">重新寄送驗證信</Link><Link href="/login">返回登入</Link></p></AuthShell>; }
