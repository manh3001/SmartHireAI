import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import ScreeningClient from "./ScreeningClient";
import type { ScreeningResultItem } from "@/lib/applications/screening";

export const dynamic = "force-dynamic";

export default async function ScreeningPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "RECRUITER") redirect(`/jobs/${id}`);

  const job = await prisma.jobDescription.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      title: true,
      screening: { select: { summary: true, result: true } },
    },
  });
  if (!job) notFound();

  const screening = job.screening
    ? {
        summary: job.screening.summary,
        result: job.screening.result as unknown as ScreeningResultItem[],
      }
    : null;

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Link href={`/jobs/${id}/applicants`} className="text-sm text-blue-600 hover:underline">
          ← Về danh sách ứng viên
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-blue-700">
          Sàng lọc AI — {job.title || "(chưa có tiêu đề)"}
        </h1>
        <p className="text-sm text-slate-500">
          AI xếp hạng và so sánh các ứng viên (không tính đơn đã rút), tối đa 20 ứng viên điểm cao nhất.
        </p>
        <ScreeningClient jobId={job.id} screening={screening} />
      </main>
    </div>
  );
}
