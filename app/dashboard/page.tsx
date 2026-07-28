import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import { createCv, deleteCv } from "@/lib/cv/actions";
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
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Xin chào, {session.user.name}</h1>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button variant="outline" size="sm">Đăng xuất</Button>
        </form>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">CV của bạn</h2>
        <form action={createCv}>
          <Button type="submit">+ Tạo CV mới</Button>
        </form>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {cvs.length === 0 && (
          <p className="text-gray-500">Chưa có CV nào. Bấm “Tạo CV mới” để bắt đầu.</p>
        )}
        {cvs.map((cv) => (
          <Card key={cv.id}>
            <CardContent className="flex items-center justify-between py-4">
              <Link href={`/cv/${cv.id}`} className="font-medium hover:underline">
                {cv.title}
              </Link>
              <form action={deleteCv}>
                <input type="hidden" name="id" value={cv.id} />
                <Button variant="ghost" size="sm" type="submit">Xóa</Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
