import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import RecommendClient from "./RecommendClient";

export const dynamic = "force-dynamic";

export default async function RecommendationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "CANDIDATE") redirect("/jobs");

  const cvs = await prisma.cV.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true },
  });

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Link href="/jobs" className="text-sm text-blue-600 hover:underline">← Về danh sách việc</Link>
        <h1 className="mb-1 mt-2 text-2xl font-bold text-slate-900">Gợi ý việc cho tôi</h1>
        <p className="text-sm text-slate-500">
          AI so khớp CV bạn chọn với các tin công khai bạn chưa ứng tuyển (tối đa 20 tin mới nhất) và xếp hạng theo mức phù hợp.
        </p>
        <RecommendClient cvs={cvs} />
      </main>
    </div>
  );
}
