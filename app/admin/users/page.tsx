import prisma from "@/lib/db/prisma";
import { deleteUserAsAdmin } from "@/lib/admin/actions";
import ConfirmSubmit from "../ConfirmSubmit";

const ROLE_LABELS: Record<string, string> = {
  CANDIDATE: "Ứng viên",
  RECRUITER: "Nhà tuyển dụng",
  ADMIN: "Admin",
};

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, email: true, name: true, role: true, createdAt: true,
      _count: { select: { cvs: true, jobDescriptions: true, applications: true } },
    },
  });

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-foreground">Người dùng ({users.length})</h1>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3">Email</th>
              <th className="p-3">Tên</th>
              <th className="p-3">Vai</th>
              <th className="p-3">CV/JD/Đơn</th>
              <th className="p-3">Ngày tạo</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="p-3 text-foreground">{u.email}</td>
                <td className="p-3 text-foreground">{u.name}</td>
                <td className="p-3 text-muted-foreground">{ROLE_LABELS[u.role] ?? u.role}</td>
                <td className="p-3 text-muted-foreground">{u._count.cvs}/{u._count.jobDescriptions}/{u._count.applications}</td>
                <td className="p-3 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString("vi-VN")}</td>
                <td className="p-3 text-right">
                  {u.role !== "ADMIN" && (
                    <form action={deleteUserAsAdmin}>
                      <input type="hidden" name="id" value={u.id} />
                      <ConfirmSubmit
                        message={`Xoá user ${u.email}? Toàn bộ dữ liệu liên quan sẽ bị xoá.`}
                        className="text-xs font-medium text-destructive hover:underline"
                      >
                        Xoá
                      </ConfirmSubmit>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
