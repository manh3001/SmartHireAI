import Link from "next/link";
import { Sparkles, Bell } from "lucide-react";
import { auth, signOut } from "@/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { getNotificationSignal } from "@/lib/notifications/poll";
import RealtimeProvider from "@/components/RealtimeProvider";
import PushRegistrar from "@/components/PushRegistrar";
import { NavLinks, MobileNavLinks } from "@/components/NavLinks";

export default async function Navbar() {
  const session = await auth();
  const loggedIn = !!session?.user;

  const signal = loggedIn
    ? await getNotificationSignal(session!.user!.id)
    : { unreadCount: 0, latest: null };
  const unread = signal.unreadCount;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-lg font-bold text-brand-gradient"
        >
          <Sparkles className="h-5 w-5" />
          SmartHire
        </Link>
        <nav className="flex items-center gap-2">
          {loggedIn ? (
            <>
              <RealtimeProvider
                initialUnreadCount={signal.unreadCount}
                initialLatestId={signal.latest?.id ?? null}
              />
              <PushRegistrar />
              <div className="flex items-center gap-2 sm:hidden">
                <MobileNavLinks />
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                <NavLinks isAdmin={session!.user!.role === "ADMIN"} />
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {session!.user!.role === "ADMIN"
                    ? "Quản trị viên"
                    : session!.user!.role === "RECRUITER"
                      ? "Nhà tuyển dụng"
                      : "Ứng viên"}
                </span>
                <span className="text-sm text-muted-foreground">
                  {session!.user!.name}
                </span>
              </div>
              <Link href="/notifications" className="relative text-muted-foreground hover:text-foreground" aria-label="Thông báo">
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
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
              <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Đăng nhập
              </Link>
              <Link href="/register" className={buttonVariants({ size: "sm" })}>
                Đăng ký
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
