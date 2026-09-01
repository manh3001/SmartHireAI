import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import prisma from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { resolveCredentials } from "@/lib/auth/credentials";
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
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
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
