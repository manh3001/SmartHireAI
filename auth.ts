import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { resolveCredentials } from "@/lib/auth/credentials";
import { resolveOAuthUser } from "@/lib/auth/oauth";
import { checkRateLimit } from "@/lib/security/ratelimit";
import { getClientIp } from "@/lib/security/ip";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import { checkTokenVersion } from "@/lib/auth/token-version";
import { verifyTotp } from "@/lib/auth/totp";
import { decryptSecret } from "@/lib/auth/totp-crypto";
import { hashBackupCode } from "@/lib/auth/backup-codes";
import { resolveTwoFactor } from "@/lib/auth/two-factor";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, code: {} },
      authorize: async (creds, request) => {
        const email = creds?.email as string | undefined;
        const password = creds?.password as string | undefined;
        const code = creds?.code as string | undefined;
        if (!email || !password) return null;

        const ip = getClientIp(request as Request | undefined);
        const ok = await checkRateLimit("login", `${ip}:${email}`);
        if (!ok) {
          console.warn("[auth] login bị rate-limit:", email);
          await recordAudit(
            {
              action: AUDIT_ACTIONS.loginFailure,
              userId: null,
              ip,
              metadata: { email, reason: "rate_limited" },
            },
            {
              save: (en) =>
                prisma.auditLog
                  .create({
                    data: {
                      action: en.action,
                      userId: en.userId ?? undefined,
                      targetId: en.targetId ?? undefined,
                      ip: en.ip ?? undefined,
                      metadata:
                        en.metadata != null ? (en.metadata as Prisma.InputJsonValue) : undefined,
                    },
                  })
                  .then(() => undefined),
            },
          );
          return null; // trả lỗi đồng nhất, không tiết lộ bị khoá
        }

        const authed = await resolveCredentials(email, password, {
          findByEmail: (e) =>
            prisma.user.findUnique({
              where: { email: e },
              select: { id: true, email: true, name: true, role: true, passwordHash: true },
            }),
          verify: verifyPassword,
        });

        // Enforce 2FA khi tài khoản đã bật (defense-in-depth, kể cả client bỏ pre-check).
        let loginOk = Boolean(authed);
        if (authed) {
          const tf = await prisma.user.findUnique({
            where: { id: authed.id },
            select: { totpEnabled: true, totpSecret: true },
          });
          const outcome = await resolveTwoFactor(
            { totpEnabled: Boolean(tf?.totpEnabled), code },
            {
              checkTotp: (c) => Boolean(tf?.totpSecret) && verifyTotp(decryptSecret(tf!.totpSecret!), c),
              consumeBackup: async (c) => {
                const r = await prisma.twoFactorBackupCode.updateMany({
                  where: { userId: authed.id, codeHash: hashBackupCode(c), usedAt: null },
                  data: { usedAt: new Date() },
                });
                return r.count === 1;
              },
            },
          );
          if (outcome !== "ok") loginOk = false;
        }

        await recordAudit(
          {
            action: loginOk ? AUDIT_ACTIONS.loginSuccess : AUDIT_ACTIONS.loginFailure,
            userId: authed?.id ?? null,
            ip,
            metadata: loginOk ? null : { email },
          },
          {
            save: (en) =>
              prisma.auditLog
                .create({
                  data: {
                    action: en.action,
                    userId: en.userId ?? undefined,
                    targetId: en.targetId ?? undefined,
                    ip: en.ip ?? undefined,
                    metadata: en.metadata != null ? (en.metadata as Prisma.InputJsonValue) : undefined,
                  },
                })
                .then(() => undefined),
          },
        );
        return loginOk ? authed : null;
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "google") {
        return Boolean(profile?.email) && (profile as { email_verified?: boolean }).email_verified === true; // chặn nếu Google không trả email hoặc email chưa xác minh
      }
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (
        account?.provider === "google" &&
        profile?.email &&
        (profile as { email_verified?: boolean }).email_verified === true
      ) {
        const resolved = await resolveOAuthUser(
          profile.email as string,
          (profile.name as string) || (profile.email as string),
          {
            findByEmail: (email) =>
              prisma.user.findUnique({ where: { email }, select: { id: true, role: true } }),
            createUser: (email, name) =>
              prisma.user.create({
                data: { email, name, role: "CANDIDATE", emailVerified: new Date() },
                select: { id: true, role: true },
              }),
          },
        );
        token.id = resolved.id;
        token.role = resolved.role;
      } else if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role?: "CANDIDATE" | "RECRUITER" | "ADMIN" }).role;
      }
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { tokenVersion: true },
        });
        const check = checkTokenVersion({
          tokenVersion: token.tokenVersion as number | undefined,
          dbVersion: dbUser?.tokenVersion ?? null,
        });
        if (check !== "valid") return null; // phiên bị thu hồi / user bị xóa
        token.tokenVersion = dbUser!.tokenVersion;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as "CANDIDATE" | "RECRUITER" | "ADMIN") ?? "CANDIDATE";
      }
      return session;
    },
  },
});
