import Link from "next/link";
import prisma from "@/lib/db/prisma";

const PAGE_SIZE = 50;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const action = sp.action?.trim() || undefined;
  const where = action ? { action } : {};

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, action: true, userId: true, targetId: true, ip: true, createdAt: true,
        user: { select: { email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-foreground">Nhật ký bảo mật ({total})</h1>
      <form className="mb-4 flex gap-2 text-sm">
        <input
          name="action"
          defaultValue={action ?? ""}
          placeholder="Lọc theo action (vd: login.failure)"
          className="rounded-md border border-border bg-background px-3 py-1.5"
        />
        <button className="rounded-md border border-border px-3 py-1.5 font-medium">Lọc</button>
      </form>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3">Thời gian</th>
              <th className="p-3">Action</th>
              <th className="p-3">Người dùng</th>
              <th className="p-3">Đối tượng</th>
              <th className="p-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="p-3 text-muted-foreground">{new Date(l.createdAt).toLocaleString("vi-VN")}</td>
                <td className="p-3 font-medium text-foreground">{l.action}</td>
                <td className="p-3 text-muted-foreground">{l.user?.email ?? l.userId ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{l.targetId ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{l.ip ?? "—"}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Chưa có nhật ký.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Trang {page}/{totalPages}</span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link href={`/admin/audit?page=${page - 1}${action ? `&action=${action}` : ""}`} className="rounded-md border border-border px-3 py-1.5">Trước</Link>
          )}
          {page < totalPages && (
            <Link href={`/admin/audit?page=${page + 1}${action ? `&action=${action}` : ""}`} className="rounded-md border border-border px-3 py-1.5">Sau</Link>
          )}
        </div>
      </div>
    </div>
  );
}
