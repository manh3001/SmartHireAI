import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Users } from "lucide-react";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import ApplicantsBoard, { type ApplicantCard } from "./ApplicantsBoard";
import { EmptyState } from "@/components/ui/empty-state";
import type { ApplicationStatus } from "@/lib/applications/status";

export const dynamic = "force-dynamic";

export default async function ApplicantsPage({
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
    select: { id: true, title: true, company: true },
  });
  if (!job) notFound();

  const rows = await prisma.application.findMany({
    where: { jobId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      coverLetter: true,
      candidate: { select: { name: true } },
      evaluation: { select: { overallScore: true } },
    },
  });

  const initial: ApplicantCard[] = rows.map((r) => ({
    id: r.id,
    status: r.status as ApplicationStatus,
    candidateName: r.candidate.name,
    score: r.evaluation?.overallScore ?? null,
    coverLetter: r.coverLetter,
  }));

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 p-6">
        <Link href={`/jobs/${id}`} className="text-sm text-primary hover:underline">← Về tin tuyển dụng</Link>
        <h1 className="mt-2 text-xl font-semibold text-foreground">
          Ứng viên — {job.title || "(chưa có tiêu đề)"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Kéo thẻ ứng viên giữa các cột để đổi trạng thái. Tổng {initial.length} ứng viên.
        </p>
        <Link
          href={`/jobs/${id}/screening`}
          className="mt-2 inline-block text-sm text-primary hover:underline"
        >
          🔎 Sàng lọc AI
        </Link>
        {initial.length === 0 ? (
          <EmptyState
            icon={<Users className="h-10 w-10" />}
            title="Chưa có ứng viên nào"
            description="Ứng viên sẽ xuất hiện ở đây khi họ nộp đơn vào tin này."
          />
        ) : (
          <ApplicantsBoard jobId={id} initial={initial} />
        )}
      </main>
    </div>
  );
}
