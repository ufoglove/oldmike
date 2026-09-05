"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DISPLAY_NAME_MAX_LENGTH } from "@/lib/display-name-contract";

export default function ProfileDisplayNameForm({ initialDisplayName }: { initialDisplayName: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => setDisplayName(initialDisplayName), [initialDisplayName]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; displayName?: string; code?: string };
      if (!response.ok || !data.ok || typeof data.displayName !== "string") {
        if (data.code === "INVALID_DISPLAY_NAME") throw new Error("顯示名稱須為 1 至 80 個字元，且前後不可含空白。");
        throw new Error("目前無法更新顯示名稱，請稍後再試。");
      }
      setDisplayName(data.displayName);
      setStatus("顯示名稱已更新，工作台會使用新名稱。");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "目前無法更新顯示名稱，請稍後再試。");
    } finally {
      setPending(false);
    }
  }

  return <form className="profile-display-name" onSubmit={submit} noValidate>
    <div className="profile-display-name-heading">
      <div>
        <h2>顯示名稱</h2>
        <p id="display-name-help">這個名稱會顯示在你的工作台與帳號頁；不會改變登入 Email、角色或 Workspace 權限。</p>
      </div>
      <output aria-live="polite" aria-atomic="true">{displayName.length}/{DISPLAY_NAME_MAX_LENGTH}</output>
    </div>
    <label htmlFor="display-name">自訂顯示名稱</label>
    <input
      id="display-name"
      name="displayName"
      type="text"
      autoComplete="name"
      enterKeyHint="done"
      value={displayName}
      minLength={1}
      maxLength={DISPLAY_NAME_MAX_LENGTH}
      required
      aria-required="true"
      aria-invalid={Boolean(error)}
      aria-describedby={`display-name-help${error ? " display-name-error" : ""}`}
      onChange={(event) => setDisplayName(event.target.value)}
    />
    {error && <p id="display-name-error" className="profile-message error" role="alert">{error}</p>}
    <p className="profile-message success" role="status" aria-live="polite">{status}</p>
    <button type="submit" disabled={pending || displayName === initialDisplayName}>{pending ? "儲存中…" : "儲存顯示名稱"}</button>
  </form>;
}
