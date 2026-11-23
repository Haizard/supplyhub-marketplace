import "server-only";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { z } from "zod";

import { emailField } from "@/features/identity/validation";
import { normalizeBackupCode } from "@/features/security/backup-codes";
import { recordSuccessfulSignIn, type SignInMethod } from "@/features/security/sign-in-events";
import { verifySecondFactor } from "@/features/security/service";
import { getServerEnv } from "@/lib/config/env";
import { ACTIVE_BUSINESS_COOKIE } from "@/server/business/active-business";
import { loadActiveBusiness } from "@/server/business/active-business-store";
import { getDatabase } from "@/server/db/client";

import { verifyPassword } from "./password";

const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$bPz++my3B+V51cll/U9LAQ$AAQCk0445FXvokrvdYPifa7RlE+Dm3UaaCs1AIK69SU";

const credentialsSchema = z.object({
  email: emailField,
  password: z.string().min(1).max(128),
  twoFactorCode: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().max(64).optional(),
  ),
});

const env = getServerEnv();

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.AUTH_SECRET,
  // An explicit false would override Auth.js detection of Vercel/AUTH_URL and reject every
  // production request with UntrustedHost.
  trustHost: env.NODE_ENV !== "production" || Boolean(env.AUTH_URL) || Boolean(process.env.VERCEL),
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/sign-in",
  },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        twoFactorCode: { label: "Authenticator or backup code", type: "text" },
      },
      async authorize(rawCredentials, request) {
        const parsed = credentialsSchema.safeParse(rawCredentials);

        if (!parsed.success) {
          return null;
        }

        const user = await getDatabase().user.findUnique({
          where: { email: parsed.data.email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            status: true,
            twoFactorEnabled: true,
          },
        });

        const passwordMatches = await verifyPassword(
          user?.passwordHash ?? DUMMY_PASSWORD_HASH,
          parsed.data.password,
        );

        if (!user || !user.passwordHash || !passwordMatches || user.status !== "ACTIVE") {
          return null;
        }

        let method: SignInMethod = "PASSWORD";

        if (user.twoFactorEnabled) {
          if (!parsed.data.twoFactorCode) {
            return null;
          }

          method = /^\d{6}$/.test(parsed.data.twoFactorCode)
            ? "PASSWORD_TOTP"
            : normalizeBackupCode(parsed.data.twoFactorCode).length === 10
              ? "PASSWORD_BACKUP_CODE"
              : "PASSWORD_TOTP";

          const secondFactorValid = await verifySecondFactor(user.id, parsed.data.twoFactorCode);
          if (!secondFactorValid) {
            return null;
          }
        }

        // Security history must never block a valid sign-in if the audit write fails.
        await recordSuccessfulSignIn({ userId: user.id, request, method }).catch(() => undefined);

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (!token.sub) {
        return null;
      }

      const account = await getDatabase().user.findUnique({
        where: { id: token.sub },
        select: {
          role: true,
          status: true,
          sessionVersion: true,
          vendor: { select: { id: true, status: true } },
        },
      });

      if (!account || account.status !== "ACTIVE") {
        return null;
      }

      if (!user && token.sessionVersion !== account.sessionVersion) {
        return null;
      }

      // The active business is re-resolved on every session read. Only the switch
      // cookie expresses a preference; membership status always comes from
      // PostgreSQL, so a stale token can never hold a business open.
      let preferredBusinessId: string | null = null;
      try {
        preferredBusinessId = (await cookies()).get(ACTIVE_BUSINESS_COOKIE)?.value ?? null;
      } catch {
        // Outside a request scope there is no cookie store: use the default rule.
      }

      const activeBusiness = await loadActiveBusiness(token.sub, preferredBusinessId);

      token.sessionVersion = account.sessionVersion;
      token.role = account.role;
      token.status = account.status;
      token.vendorId = account.vendor?.id ?? null;
      token.vendorStatus = account.vendor?.status ?? null;
      token.businessId = activeBusiness?.businessId ?? null;
      token.businessName = activeBusiness?.businessName ?? null;
      token.businessMemberId = activeBusiness?.memberId ?? null;
      token.businessVendorId = activeBusiness?.vendorId ?? null;
      token.businessVendorStatus = activeBusiness?.vendorStatus ?? null;
      token.businessIsOwner = activeBusiness?.isOwner ?? false;

      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.role = token.role ?? "CUSTOMER";
      session.user.status = token.status ?? "SUSPENDED";
      session.user.vendorId = token.vendorId ?? null;
      session.user.vendorStatus = token.vendorStatus ?? null;
      session.user.businessId = token.businessId ?? null;
      session.user.businessName = token.businessName ?? null;
      session.user.businessMemberId = token.businessMemberId ?? null;
      session.user.businessVendorId = token.businessVendorId ?? null;
      session.user.businessVendorStatus = token.businessVendorStatus ?? null;
      session.user.businessIsOwner = token.businessIsOwner ?? false;

      return session;
    },
  },
});
