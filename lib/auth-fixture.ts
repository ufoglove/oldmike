/** Test-only state machine. Production authentication is Better Auth. */
export type FixtureAuthState = {
  users: Map<string, { email: string; verified: boolean }>;
  verificationTokens: Map<string, { email: string; expiresAt: number; used: boolean }>;
  sessions: Map<string, string>;
};

export function createFixtureAuth(): FixtureAuthState {
  return { users: new Map(), verificationTokens: new Map(), sessions: new Map() };
}

export function fixtureCanLogin(state: FixtureAuthState, email: string) {
  return state.users.get(email)?.verified === true;
}

export function fixtureVerifyEmail(state: FixtureAuthState, token: string, now = Date.now()) {
  const record = state.verificationTokens.get(token);
  if (!record || record.used || record.expiresAt <= now) return false;
  record.used = true;
  const user = state.users.get(record.email);
  if (!user) return false;
  user.verified = true;
  return true;
}

export function fixtureResetPassword(state: FixtureAuthState, email: string) {
  for (const [session, sessionEmail] of state.sessions) if (sessionEmail === email) state.sessions.delete(session);
}

export function antiEnumerationResponse() {
  return { ok: true, message: "若帳號存在，系統會寄出後續指示。" } as const;
}
