export type SessionLike = { user?: { role?: string } | null } | null;

export type RouteRule = { prefix: string; role?: "ADMIN" | "RECRUITER" };

// Thứ tự quan trọng: rule cụ thể hơn (vd /company/edit) phải đứng TRƯỚC rule chung (/company).
export const ROUTE_RULES: RouteRule[] = [
  { prefix: "/admin", role: "ADMIN" },
  { prefix: "/jobs/new", role: "RECRUITER" },
  { prefix: "/company/edit", role: "RECRUITER" },
  { prefix: "/dashboard" },
  { prefix: "/cv" },
  { prefix: "/applications" },
  { prefix: "/messages" },
  { prefix: "/notifications" },
  { prefix: "/company" },
];

export function matchRule(pathname: string): RouteRule | null {
  return (
    ROUTE_RULES.find(
      (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"),
    ) ?? null
  );
}

export function routeDecision(
  pathname: string,
  session: SessionLike,
): "allow" | "login" | "forbidden" {
  const rule = matchRule(pathname);
  if (!rule) return "allow";
  if (!session?.user) return "login";
  if (rule.role && session.user.role !== rule.role) return "forbidden";
  return "allow";
}
