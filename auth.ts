import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import prisma from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { resolveCredentials } from "@/lib/auth/credentials";
import { resolveOAuthUser } from "@/lib/auth/oauth";
import { checkRateLimit } from "@/lib/security/ratelimit";
import { getClientIp } from "@/lib/security/ip";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds, request) => {
        const email = creds?.email as string | undefined;
        const password = creds?.password as string | undefined;
        if (!email || !password) return null;

        const ip = getClientIp(request as Request | undefined);
        const ok = await checkRateLimit("login", `${ip}:${email}`);
        if (!ok) {
          console.warn("[auth] login bị rate-limit:", email);
          return null; // trả lỗi đồng nhất, không tiết lộ bị khoá
        }

        return resolveCredentials(email, password, {
          findByEmail: (e) =>
            prisma.user.findUnique({
              where: { email: e },
              select: { id: true, email: true, name: true, role: true, passwordHash: true },
            }),
          verify: verifyPassword,
        });
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
                data: { email, name, role: "CANDIDATE" },
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
