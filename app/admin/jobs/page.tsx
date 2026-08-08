import prisma from "@/lib/db/prisma";
import { deleteJobAsAdmin, setJobPublicAsAdmin } from "@/lib/admin/actions";
import ConfirmSubmit from "../ConfirmSubmit";

export default async function AdminJobsPage() {
  const jobs = await prisma.jobDescription.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, company: true, isPublic: true, createdAt: true,
      user: { select: { email: true } },
    },
  });

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-foreground">Tin tuyển dụng ({jobs.length})</h1>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3">Tiêu đề</th>
              <th className="p-3">Công ty</th>
              <th className="p-3">Chủ sở hữu</th>
              <th className="p-3">Trạng thái</th>
              <th className="p-3">Ngày tạo</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-t border-border">
                <td className="p-3 text-foreground">{j.title || "(chưa có tiêu đề)"}</td>
                <td className="p-3 text-muted-foreground">{j.company || "—"}</td>
                <td className="p-3 text-muted-foreground">{j.user.email}</td>
                <td className="p-3">
                  {j.isPublic
                    ? <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">Công khai</span>
                    : <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Ẩn</span>}
                </td>
                <td className="p-3 text-muted-foreground">{new Date(j.createdAt).toLocaleDateString("vi-VN")}</td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <form action={setJobPublicAsAdmin}>
                      <input type="hidden" name="id" value={j.id} />
                      <input type="hidden" name="isPublic" value={j.isPublic ? "0" : "1"} />
                      <button type="submit" className="text-xs font-medium text-primary hover:underline">
                        {j.isPublic ? "Gỡ công khai" : "Công khai"}
                      </button>
                    </form>
                    <form action={deleteJobAsAdmin}>
                      <input type="hidden" name="id" value={j.id} />
                      <ConfirmSubmit
                        message={`Xoá tin "${j.title || "(chưa có tiêu đề)"}"?`}
                        className="text-xs font-medium text-destructive hover:underline"
                      >
                        Xoá
                      </ConfirmSubmit>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
