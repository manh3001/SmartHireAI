import { redirect } from "next/navigation";

export type Role = "CANDIDATE" | "RECRUITER" | "ADMIN";

type SessionLike = { user?: { id?: string; role?: string } | null } | null;

export function roleAccess(
  session: SessionLike,
  role: Role,
): "ok" | "login" | "forbidden" {
  if (!session?.user) return "login";
  return session.user.role === role ? "ok" : "forbidden";
}

export async function getSessionUser() {
  const { auth } = await import("@/auth");
  const session = await auth();
  return session?.user ?? null;
}

export async function requireUser() {
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
}

export async function requireRole(role: Role) {
  const { auth } = await import("@/auth");
  const session = await auth();
  const access = roleAccess(session, role);
  if (access === "login") redirect("/login");
  if (access === "forbidden") redirect("/dashboard");
  return session!;
}
