"use client";

import { FormEvent, useEffect, useState } from "react";

type AccountSummary = {
  id: string;
  name: string;
  email: string;
  status: "ACTIVE" | "PASSWORD_CHANGE_REQUIRED" | "DISABLED";
  mustChangePassword: boolean;
  temporaryPasswordExpiresAt: string | null;
  passwordVersion: number;
  isAdministrator: boolean;
};

function operationKey(kind: string) {
  return `${kind}:${crypto.randomUUID()}`;
}

export default function AdminAccountsPanel() {
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const response = await fetch("/api/admin/accounts", { cache: "no-store" });
    const data = await response.json().catch(() => ({})) as { accounts?: AccountSummary[] };
    if (!response.ok || !Array.isArray(data.accounts)) throw new Error("account_list_failed");
    setAccounts(data.accounts);
  }

  useEffect(() => { void refresh().catch(() => setError("無法載入帳號清單。")); }, []);

  async function request(path: string, method: string, body: Record<string, unknown>, kind: string) {
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json", Origin: window.location.origin, "Idempotency-Key": operationKey(kind) },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error("account_operation_failed");
  }

  async function createAccount(event: FormEvent) {
    event.preventDefault();
    setError(""); setMessage(""); setBusy(true);
    try {
      await request("/api/admin/accounts", "POST", { name, email, temporaryPassword }, "create-account");
      setName(""); setEmail(""); setTemporaryPassword("");
      setMessage("帳號、credential 與 personal workspace 已原子建立。請透過安全的外部方式交付臨時密碼。");
      await refresh();
    } catch {
      setError("帳號未建立。Email、冪等鍵或併發契約未通過。未保留部分帳號。");
    } finally { setBusy(false); }
  }

  async function mutateAccount(account: AccountSummary, action: "reset" | "toggle" | "sessions") {
    setError(""); setMessage(""); setBusy(true);
    try {
      if (action === "reset") {
        await request(`/api/admin/accounts/${encodeURIComponent(account.id)}/temporary-password`, "POST", { temporaryPassword: resetPasswords[account.id] || "" }, "reset-temporary-password");
        setResetPasswords((current) => ({ ...current, [account.id]: "" }));
        setMessage("新的臨時密碼已設定，所有既有 Session 已撤銷。系統未保存或回傳明文密碼。");
      } else if (action === "toggle") {
        await request(`/api/admin/accounts/${encodeURIComponent(account.id)}/status`, "PATCH", { enabled: account.status === "DISABLED" }, "account-status");
        setMessage(account.status === "DISABLED" ? "帳號已啟用。" : "帳號已停用且 Session 已撤銷。");
      } else {
        await request(`/api/admin/accounts/${encodeURIComponent(account.id)}/sessions`, "DELETE", {}, "revoke-sessions");
        setMessage("該帳號的 Session 已撤銷。");
      }
      await refresh();
    } catch {
      setError("操作未完成；管理員 singleton、冪等或帳號生命週期契約拒絕了要求。");
    } finally { setBusy(false); }
  }

  return <div className="admin-accounts">
    <section aria-labelledby="create-account-title">
      <h2 id="create-account-title">建立一般使用者</h2>
      <form className="account-management-form" onSubmit={createAccount} noValidate>
        <label htmlFor="provision-name">顯示名稱</label>
        <input id="provision-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required />
        <label htmlFor="provision-email">登入 Email</label>
        <input id="provision-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required />
        <label htmlFor="provision-password">初始臨時密碼</label>
        <input id="provision-password" type="password" autoComplete="new-password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} minLength={12} maxLength={128} aria-describedby="provision-password-help" required />
        <p id="provision-password-help" className="field-help">可由密碼管理器產生並貼上。只傳送至老麥的伺服器端帳號系統，不寫入 audit 或頁面。</p>
        <button type="submit" disabled={busy}>建立帳號</button>
      </form>
    </section>
    <section aria-labelledby="managed-accounts-title">
      <h2 id="managed-accounts-title">帳號生命週期</h2>
      {accounts.map((account) => <article className="managed-account" key={account.id}>
        <div><strong>{account.name}</strong><span>{account.email}</span><small>{account.isAdministrator ? "Portal Administrator" : account.status}</small></div>
        {!account.isAdministrator && <div className="managed-account-actions">
          <label htmlFor={`reset-${account.id}`}>新的臨時密碼</label>
          <input id={`reset-${account.id}`} type="password" autoComplete="new-password" value={resetPasswords[account.id] || ""} onChange={(event) => setResetPasswords((current) => ({ ...current, [account.id]: event.target.value }))} minLength={12} maxLength={128} />
          <button type="button" disabled={busy} onClick={() => void mutateAccount(account, "reset")}>重設臨時密碼</button>
          <button type="button" disabled={busy} onClick={() => void mutateAccount(account, "sessions")}>撤銷 Sessions</button>
          <button type="button" disabled={busy} onClick={() => void mutateAccount(account, "toggle")}>{account.status === "DISABLED" ? "啟用" : "停用"}</button>
        </div>}
      </article>)}
    </section>
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="form-success" role="status" aria-live="polite">{message}</p>}
  </div>;
}
