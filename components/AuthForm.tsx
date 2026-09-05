"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RegistrationMode } from "@/lib/auth-config";
import { V2_BETA2_ACCEPTANCE_CONTROLS } from "@/lib/v2-beta2/product-acceptance";

type Mode = "login" | "register" | "forgot" | "reset" | "resend";

function messageOf(data: unknown, fallback: string) {
  return data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : fallback;
}

export default function AuthForm({
  mode,
  token = "",
  registrationMode = "closed",
}: {
  mode: Mode;
  token?: string;
  registrationMode?: RegistrationMode;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [consent, setConsent] = useState(false);
  const [inviteToken, setInviteToken] = useState(token);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode !== "register" || token || typeof window === "undefined") return;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const invitation = fragment.get("invite")?.trim() || "";
    if (invitation) setInviteToken(invitation);
    if (window.location.hash) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, [mode, token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (mode === "register" && password !== confirm) { setError("兩次輸入的密碼不一致。"); return; }
    if (mode === "register" && !consent) { setError("請先同意服務條款與隱私政策。"); return; }
    if (mode === "register" && registrationMode === "invite_only" && !inviteToken) { setError("請輸入有效的邀請碼。"); return; }
    setLoading(true);
    try {
      let endpoint = "/api/auth/sign-in/email";
      let body: Record<string, unknown> = { email, password, callbackURL: "/" };
      if (mode === "register") {
        endpoint = "/api/account/register";
        body = { name, email, password, confirmPassword: confirm, consent, inviteToken, termsVersion: "2026-08-16", privacyVersion: "2026-08-16" };
      }
      if (mode === "forgot") { endpoint = "/api/account/forgot-password"; body = { email }; }
      if (mode === "resend") { endpoint = "/api/account/resend-verification"; body = { email }; }
      if (mode === "reset") { endpoint = "/api/auth/reset-password"; body = { token, newPassword: password }; }
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: window.location.origin },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(messageOf(data, "目前無法完成此操作，請稍後再試。"));
      if (mode === "login") { router.replace("/"); router.refresh(); return; }
      setMessage(mode === "forgot" || mode === "resend"
        ? "若帳號存在，系統會寄出後續指示。"
        : mode === "reset"
          ? "密碼已更新，請使用新密碼登入。"
          : "註冊已送出，請先完成電子郵件驗證。");
      if (mode === "reset") window.setTimeout(() => router.replace("/login"), 800);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "目前無法完成此操作，請稍後再試。");
    } finally {
      setLoading(false);
    }
  }

  const title = mode === "login" ? "登入研究工作台" : mode === "register" ? "建立研究者帳號" : mode === "reset" ? "設定新密碼" : mode === "resend" ? "重新寄送驗證信" : "忘記密碼";
  return <form className="login-form auth-form" onSubmit={submit} noValidate>
    {mode === "register" && <>
      <label htmlFor="display-name">顯示名稱</label>
      <input id="display-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={80} required />
    </>}
    {mode !== "reset" && <>
      <label htmlFor="auth-email">Email</label>
      <input id="auth-email" data-acceptance-id={mode === "login" ? V2_BETA2_ACCEPTANCE_CONTROLS.loginEmail : undefined} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={254} required />
    </>}
    {mode === "register" && registrationMode === "invite_only" && <>
      <label htmlFor="registration-invite">邀請碼</label>
      <input id="registration-invite" value={inviteToken} onChange={(event) => setInviteToken(event.target.value.trim())} autoComplete="off" spellCheck={false} inputMode="text" maxLength={128} aria-describedby="registration-invite-help" required />
      <p id="registration-invite-help" className="field-help">邀請碼只限指定 Email 使用，且成功註冊後立即失效。可以直接貼上管理者提供的邀請碼。</p>
    </>}
    {(mode === "login" || mode === "register" || mode === "reset") && <>
      <label htmlFor="auth-password">{mode === "reset" ? "新密碼" : "密碼"}</label>
      <input id="auth-password" data-acceptance-id={mode === "login" ? V2_BETA2_ACCEPTANCE_CONTROLS.loginPassword : undefined} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "reset" || mode === "register" ? "new-password" : "current-password"} minLength={8} maxLength={128} required />
    </>}
    {mode === "register" && <>
      <label htmlFor="auth-confirm">確認密碼</label>
      <input id="auth-confirm" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required />
      <label className="auth-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required />我同意服務條款與隱私政策</label>
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="form-success" role="status" aria-live="polite">{message}</p>}
    <button type="submit" data-acceptance-id={mode === "login" ? V2_BETA2_ACCEPTANCE_CONTROLS.loginSubmit : undefined} disabled={loading}>{loading ? "處理中…" : title}<span aria-hidden="true">→</span></button>
    <nav className="auth-links" aria-label="帳號選項">
      {mode === "login" && <>{registrationMode !== "closed" && <Link href="/register">{registrationMode === "invite_only" ? "使用邀請碼註冊" : "建立帳號"}</Link>}<Link href="/forgot-password">忘記密碼</Link></>}
      {mode === "register" && <Link href="/login">已有帳號？登入</Link>}
      {mode === "forgot" && <><Link href="/login">返回登入</Link><Link href="/verify-email">重新寄送驗證信</Link></>}
      {(mode === "resend" || mode === "reset") && <Link href="/login">返回登入</Link>}
    </nav>
  </form>;
}
