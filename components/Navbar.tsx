import Link from "next/link";
import { Sparkles } from "lucide-react";
import { auth, signOut } from "@/auth";
import { Button, buttonVariants } from "@/components/ui/button";

export default async function Navbar() {
  const session = await auth();
  const loggedIn = !!session?.user;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-lg font-bold text-blue-600"
        >
          <Sparkles className="h-5 w-5" />
          SmartHire
        </Link>
        <nav className="flex items-center gap-2">
          {loggedIn ? (
            <>
              <Link href="/dashboard" className="hidden text-sm font-medium text-slate-600 hover:text-blue-600 sm:inline">
                Bảng điều khiển
              </Link>
              <Link href="/jobs" className="hidden text-sm font-medium text-slate-600 hover:text-blue-600 sm:inline">
                Việc làm
              </Link>
              <span className="hidden rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 sm:inline">
                {session!.user!.role === "RECRUITER" ? "Nhà tuyển dụng" : "Ứng viên"}
              </span>
              <span className="hidden text-sm text-slate-600 sm:inline">
                {session!.user!.name}
              </span>
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
