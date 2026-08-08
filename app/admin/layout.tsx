import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import Navbar from "@/components/Navbar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 p-6">
        <nav className="mb-6 flex gap-4 border-b border-border pb-3 text-sm font-medium">
          <Link href="/admin" className="text-muted-foreground hover:text-foreground">Tổng quan</Link>
          <Link href="/admin/users" className="text-muted-foreground hover:text-foreground">Người dùng</Link>
          <Link href="/admin/jobs" className="text-muted-foreground hover:text-foreground">Tin tuyển dụng</Link>
        </nav>
        {children}
      </main>
    </div>
  );
}
