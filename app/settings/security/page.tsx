import { requireUser } from "@/lib/auth/session";
import Navbar from "@/components/Navbar";
import prisma from "@/lib/db/prisma";
import { EmptyState } from "@/components/ui/empty-state";
import RevokeSessionsButton from "./RevokeSessionsButton";
import TwoFactorSection from "./TwoFactorSection";

export default async function SecuritySettingsPage() {
  const session = await requireUser();
  const userId = session.user!.id as string;

  const logins = await prisma.auditLog.findMany({
    where: { userId, action: "login.success" },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, ip: true, createdAt: true },
  });

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpEnabled: true, _count: { select: { backupCodes: { where: { usedAt: null } } } } },
  });

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-xl flex-1 p-6">
        <h1 className="mb-6 text-2xl font-bold text-foreground">Bảo mật</h1>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Đăng nhập gần đây</h2>
          {logins.length === 0 ? (
            <EmptyState title="Chưa có dữ liệu" description="Chưa ghi nhận lần đăng nhập nào." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3">Thời gian</th>
                    <th className="p-3">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logins.map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="p-3 text-foreground">
                        {new Date(l.createdAt).toLocaleString("vi-VN")}
                      </td>
                      <td className="p-3 text-muted-foreground">{l.ip ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Xác thực 2 lớp (2FA)</h2>
          <TwoFactorSection
            enabled={Boolean(me?.totpEnabled)}
            remainingBackup={me?._count.backupCodes ?? 0}
          />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">Phiên đăng nhập</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Nếu nghi ngờ tài khoản bị truy cập trái phép, hãy đăng xuất khỏi tất cả thiết bị.
          </p>
          <RevokeSessionsButton />
        </section>
      </main>
    </div>
  );
}
