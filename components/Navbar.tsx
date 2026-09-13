import Link from "next/link";
import { Sparkles, Bell } from "lucide-react";
import { auth, signOut } from "@/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { getNotificationSignal } from "@/lib/notifications/poll";
import RealtimeProvider from "@/components/RealtimeProvider";
import PushRegistrar from "@/components/PushRegistrar";
import { NavLinks, MobileNavLinks } from "@/components/NavLinks";
import ThemeToggle from "@/components/ThemeToggle";

export default async function Navbar() {
  const session = await auth();
  const loggedIn = !!session?.user;

  const signal = loggedIn
    ? await getNotificationSignal(session!.user!.id)
    : { unreadCount: 0, latest: null };
  const unread = signal.unreadCount;

  const role = session?.user?.role;
  const roleLabel =
    role === "ADMIN"
      ? "Quản trị viên"
      : role === "RECRUITER"
        ? "Nhà tuyển dụng"
        : "Ứng viên";
  const name = session?.user?.name ?? "";
  const initial = name.trim().charAt(0).toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        {/* Vùng trái: thương hiệu + điều hướng */}
        <div className="flex min-w-0 items-center gap-6">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-1.5 text-lg font-bold text-brand-gradient"
          >
            <Sparkles className="h-5 w-5" />
            SmartHire
          </Link>
          <Link
            href="/blog"
            className="hidden shrink-0 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Cẩm nang
          </Link>
          {loggedIn && (
            <nav className="hidden items-center gap-5 sm:flex">
              <NavLinks
                isAdmin={role === "ADMIN"}
                isRecruiter={role === "RECRUITER"}
                isCandidate={role === "CANDIDATE"}
              />
            </nav>
          )}
        </div>

        {/* Vùng phải: tiện ích + tài khoản */}
        <div className="flex shrink-0 items-center gap-3">
          {loggedIn ? (
            <>
              <RealtimeProvider
                initialUnreadCount={signal.unreadCount}
                initialLatestId={signal.latest?.id ?? null}
              />
              <PushRegistrar />

              <nav className="flex items-center gap-4 sm:hidden">
                <MobileNavLinks
                  isRecruiter={role === "RECRUITER"}
                  isCandidate={role === "CANDIDATE"}
                />
              </nav>

              {/* Nhóm tiện ích: theme + thông báo */}
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <Link
                  href="/notifications"
                  className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Thông báo"
                >
                  <Bell className="h-5 w-5" />
                  {unread > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Link>
              </div>

              <div className="hidden h-6 w-px bg-border sm:block" />

              {/* Khối tài khoản: avatar + tên + vai trò */}
              <div className="hidden items-center gap-2 sm:flex">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {initial}
                </span>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-sm font-medium text-foreground">
                    {name}
                  </span>
                  <span className="text-xs text-muted-foreground">{roleLabel}</span>
                </span>
              </div>

              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <Button type="submit" variant="outline" size="sm">Đăng xuất</Button>
              </form>
            </>
          ) : (
            <>
              <ThemeToggle />
              <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Đăng nhập
              </Link>
              <Link href="/register" className={buttonVariants({ size: "sm" })}>
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
