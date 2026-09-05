import "server-only";

import { Pool } from "pg";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { authConfiguration, isFixtureMode } from "@/lib/auth-config";
import { isSessionCreationAllowed } from "@/lib/account-provisioning";

const config = authConfiguration();
const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:3000";
const databaseUrl = process.env.DATABASE_URL || "postgresql://disabled:disabled@127.0.0.1:1/disabled";

export const auth = betterAuth({
  database: new Pool({ connectionString: databaseUrl, max: 5 }),
  secret: process.env.BETTER_AUTH_SECRET || "build-only-disabled-auth-secret-32-characters",
  baseURL,
  trustedOrigins: [baseURL],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    revokeSessionsOnPasswordReset: true,
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: isFixtureMode() ? 100 : 5 },
      "/sign-up/email": { window: 60, max: 1 },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => isSessionCreationAllowed(session.userId),
      },
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  plugins: [nextCookies()],
});

export { config as authConfig };
