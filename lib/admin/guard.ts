import { redirect } from "next/navigation";
import { roleAccess } from "@/lib/auth/session";

type SessionLike = { user?: { role?: string } | null } | null;

export function adminAccess(session: SessionLike): "ok" | "login" | "forbidden" {
  return roleAccess(session, "ADMIN");
}

// Dùng trong app/admin/layout.tsx và mọi server action quản trị.
export async function requireAdmin() {
  const { auth } = await import("@/auth");
  const session = await auth();
  const access = adminAccess(session);
  if (access === "login") redirect("/login");
  if (access === "forbidden") redirect("/dashboard");
  return session!;
}
