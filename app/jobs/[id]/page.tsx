import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import EvaluateFromJob from "./EvaluateFromJob";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const job = await prisma.jobDescription.findFirst({
    where: { id, isPublic: true },
    select: { id: true, title: true, company: true, rawText: true, userId: true },
  });
  if (!job) notFound();

  const isCandidate = session.user.role === "CANDIDATE";
  const isOwnerRecruiter =
    session.user.role === "RECRUITER" && job.userId === session.user.id;
  const cvs = isCandidate
    ? await prisma.cV.findMany({
        where: { userId: session.user.id },
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true },
      })
    : [];
  const applied = isCandidate
    ? await prisma.application.findFirst({
        where: { jobId: job.id, candidateId: session.user.id },
        select: { id: true },
      })
    : null;

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <Link href="/jobs" className="text-sm text-blue-600 hover:underline">← Về danh sách</Link>
        <Card className="mt-3">
          <CardHeader>
            <CardTitle className="text-blue-700">{job.title || "(chưa có tiêu đề)"}</CardTitle>
            <p className="text-sm text-slate-500">{job.company || "—"}</p>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{job.rawText}</p>
          </CardContent>
        </Card>

        {isCandidate && (
          <div className="mt-4">
            {applied ? (
              <Link href="/applications" className={buttonVariants({ variant: "outline" })}>
                Bạn đã ứng tuyển — xem đơn của tôi
              </Link>
            ) : (
              <Link href={`/jobs/${job.id}/apply`} className={buttonVariants()}>
                Ứng tuyển ngay
              </Link>
            )}
          </div>
        )}

        {isOwnerRecruiter && (
          <div className="mt-4">
            <Link href={`/jobs/${job.id}/applicants`} className={buttonVariants()}>
              Xem ứng viên đã nộp
            </Link>
          </div>
        )}

        {isCandidate && (
          <EvaluateFromJob
            jobId={job.id}
            jdText={job.rawText}
            jdTitle={job.title}
            jdCompany={job.company}
            cvs={cvs}
          />
        )}
      </main>
    </div>
  );
}
