"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function PasswordChangeForm({ mustChangePassword }: { mustChangePassword: boolean }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptConsent, setAcceptConsent] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setStatus("");
    if (newPassword !== confirmPassword) {
      setError("兩次輸入的新密碼不一致。");
      return;
    }
    if (mustChangePassword && !acceptConsent) {
      setError("首次啟用帳號前必須確認服務條款與隱私政策。");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: window.location.origin },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          acceptConsent,
          termsVersion: "2026-08-16",
          privacyVersion: "2026-08-16",
        }),
      });
      const data = await response.json().catch(() => ({})) as { code?: string };
      if (!response.ok) throw new Error(data.code || "password_change_failed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setStatus("密碼已更新；舊 Session 已撤銷，請使用新密碼重新登入。");
      window.setTimeout(() => { router.replace("/login"); router.refresh(); }, 900);
    } catch {
      setError("密碼未更新。請確認目前密碼與密碼政策後再試一次。");
    } finally {
      setBusy(false);
    }
  }

  return <form className="account-management-form" onSubmit={submit} noValidate>
    <label htmlFor="current-password">目前密碼</label>
    <input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} minLength={12} maxLength={128} required />
    <label htmlFor="new-password">新密碼</label>
    <input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={12} maxLength={128} aria-describedby="new-password-help" required />
    <p id="new-password-help" className="field-help">至少 12 個字元。可使用密碼管理器並可貼上。</p>
    <label htmlFor="confirm-password">確認新密碼</label>
    <input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={12} maxLength={128} required />
    {mustChangePassword && <label className="auth-consent"><input type="checkbox" checked={acceptConsent} onChange={(event) => setAcceptConsent(event.target.checked)} required />我已閱讀並同意目前的服務條款與隱私政策。</label>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {status && <p role="status" aria-live="polite" className="form-success">{status}</p>}
    <button type="submit" disabled={busy}>{busy ? "更新中…" : mustChangePassword ? "設定新密碼並啟用帳號" : "變更密碼"}</button>
  </form>;
}
