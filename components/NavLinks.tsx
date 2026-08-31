"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Bảng điều khiển" },
  { href: "/jobs", label: "Việc làm" },
  { href: "/companies", label: "Công ty" },
];

export function NavLinks({ isAdmin }: { isAdmin?: boolean }) {
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

export function MobileNavLinks() {
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
    </>
  );
}
