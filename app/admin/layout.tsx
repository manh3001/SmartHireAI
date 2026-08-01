import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import Navbar from "@/components/Navbar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 p-6">
        <nav className="mb-6 flex gap-4 border-b border-slate-200 pb-3 text-sm font-medium">
          <Link href="/admin" className="text-slate-600 hover:text-blue-600">Tổng quan</Link>
          <Link href="/admin/users" className="text-slate-600 hover:text-blue-600">Người dùng</Link>
          <Link href="/admin/jobs" className="text-slate-600 hover:text-blue-600">Tin tuyển dụng</Link>
        </nav>
        {children}
      </main>
    </div>
  );
}
