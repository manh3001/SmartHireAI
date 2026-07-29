import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import prisma from "@/lib/db/prisma";
import { createCv, deleteCv } from "@/lib/cv/actions";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cvs = await prisma.cV.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
  });

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">CV của bạn</h1>
            <p className="text-sm text-slate-500">Xin chào, {session.user.name}</p>
          </div>
          <form action={createCv}>
            <Button type="submit">
              <Plus className="mr-1 h-4 w-4" /> Tạo CV mới
            </Button>
          </form>
        </div>

        <div className="flex flex-col gap-3">
          {cvs.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-slate-500">
                Chưa có CV nào. Bấm “Tạo CV mới” để bắt đầu.
              </CardContent>
            </Card>
          )}
          {cvs.map((cv) => (
            <Card key={cv.id} className="border-slate-200 transition-colors hover:border-blue-300 hover:bg-blue-50/40">
              <CardContent className="flex items-center justify-between py-4">
                <Link href={`/cv/${cv.id}`} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block font-medium text-slate-900 hover:text-blue-600">{cv.title}</span>
                    <span className="block text-xs text-slate-400">
                      Cập nhật {new Date(cv.updatedAt).toLocaleDateString("vi-VN")}
                    </span>
                  </span>
                </Link>
                <form action={deleteCv}>
                  <input type="hidden" name="id" value={cv.id} />
                  <Button variant="ghost" size="sm" type="submit" className="text-slate-500 hover:text-red-600">
                    Xóa
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
