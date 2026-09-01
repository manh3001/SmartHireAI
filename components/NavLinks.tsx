"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Bảng điều khiển" },
  { href: "/jobs", label: "Việc làm" },
  { href: "/companies", label: "Công ty" },
];

export function NavLinks({
  isAdmin,
  isRecruiter,
  isCandidate,
}: {
  isAdmin?: boolean;
  isRecruiter?: boolean;
  isCandidate?: boolean;
}) {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "text-sm font-medium transition-colors",
            isActive(href)
              ? "border-b-2 border-primary pb-0.5 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </Link>
      ))}
      {isRecruiter && (
        <Link
          href="/candidates"
          className={cn(
            "text-sm font-medium transition-colors",
            isActive("/candidates")
              ? "border-b-2 border-primary pb-0.5 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Ứng viên
        </Link>
      )}
      {(isCandidate || isRecruiter) && (
        <Link
          href="/interviews"
          className={cn(
            "text-sm font-medium transition-colors",
            isActive("/interviews")
              ? "border-b-2 border-primary pb-0.5 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Lịch phỏng vấn
        </Link>
      )}
      {isCandidate && (
        <Link
          href="/settings/profile"
          className={cn(
            "text-sm font-medium transition-colors",
            isActive("/settings/profile")
              ? "border-b-2 border-primary pb-0.5 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Hồ sơ
        </Link>
      )}
      {isAdmin && (
        <Link
          href="/admin"
          className={cn(
            "text-sm font-medium transition-colors",
            isActive("/admin")
              ? "border-b-2 border-primary pb-0.5 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Quản trị
        </Link>
      )}
    </>
  );
}

export function MobileNavLinks({
  isRecruiter,
  isCandidate,
}: {
  isRecruiter?: boolean;
  isCandidate?: boolean;
}) {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      {[
        { href: "/jobs", label: "Việc làm" },
        { href: "/companies", label: "Công ty" },
      ].map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "text-sm font-medium transition-colors",
            isActive(href)
              ? "border-b-2 border-primary pb-0.5 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </Link>
      ))}
      {isRecruiter && (
        <Link
          href="/candidates"
          className={cn(
            "text-sm font-medium transition-colors",
            isActive("/candidates")
              ? "border-b-2 border-primary pb-0.5 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Ứng viên
        </Link>
      )}
      {(isCandidate || isRecruiter) && (
        <Link
          href="/interviews"
          className={cn(
            "text-sm font-medium transition-colors",
            isActive("/interviews")
              ? "border-b-2 border-primary pb-0.5 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Lịch phỏng vấn
        </Link>
      )}
      {isCandidate && (
        <Link
          href="/settings/profile"
          className={cn(
            "text-sm font-medium transition-colors",
            isActive("/settings/profile")
              ? "border-b-2 border-primary pb-0.5 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Hồ sơ
        </Link>
      )}
    </>
  );
}
