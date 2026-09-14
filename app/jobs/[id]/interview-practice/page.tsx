import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import MockInterview from "@/components/interview-practice/MockInterview";

export const dynamic = "force-dynamic";

export default async function InterviewPracticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("CANDIDATE");
  const { id } = await params;
  const job = await prisma.jobDescription.findFirst({
    where: { id, isPublic: true },
    select: { id: true, title: true, company: true },
  });
  if (!job) notFound();

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
        <Link href={`/jobs/${job.id}`} className="text-sm text-primary hover:underline">← Về tin tuyển dụng</Link>
        <h1 className="mt-3 text-2xl font-bold text-foreground">Phỏng vấn thử</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {job.title || "Tin tuyển dụng"}{job.company ? ` · ${job.company}` : ""}
        </p>
        <div className="mt-6">
          <MockInterview jobId={job.id} />
        </div>
      </main>
    </div>
  );
}
