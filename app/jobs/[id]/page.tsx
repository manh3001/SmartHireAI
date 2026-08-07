import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import { buttonVariants } from "@/components/ui/button";
import EvaluateFromJob from "./EvaluateFromJob";
import { composeJdText } from "@/lib/jobs/job-fields";
import JobDetail from "@/components/jobs/JobDetail";

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
    select: {
      id: true, title: true, company: true, rawText: true, userId: true,
      location: true, employmentType: true, experienceLevel: true, skills: true,
      salaryMin: true, salaryMax: true, salaryNegotiable: true,
    },
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

  const companyProfile = await prisma.companyProfile.findUnique({
    where: { userId: job.userId },
    select: { id: true },
  });

  const actionSlot = (
    <div className="flex flex-wrap gap-3">
      {isCandidate && (
        applied ? (
          <Link href="/applications" className={buttonVariants({ variant: "outline" })}>
            Bạn đã ứng tuyển — xem đơn của tôi
          </Link>
        ) : (
          <Link href={`/jobs/${job.id}/apply`} className={buttonVariants()}>
            Ứng tuyển ngay
          </Link>
        )
      )}
      {isOwnerRecruiter && (
        <Link href={`/jobs/${job.id}/applicants`} className={buttonVariants()}>
          Xem ứng viên đã nộp
        </Link>
      )}
      {companyProfile && (
        <Link href={`/companies/${companyProfile.id}`} className="self-center text-sm text-primary hover:underline">
          Xem trang công ty →
        </Link>
      )}
    </div>
  );

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
        <Link href="/jobs" className="text-sm text-primary hover:underline">← Về danh sách</Link>
        <div className="mt-3">
          <JobDetail job={job} action={actionSlot} />
        </div>

        {isCandidate && (
          <EvaluateFromJob
            jobId={job.id}
            jdText={composeJdText(job)}
            jdTitle={job.title}
            jdCompany={job.company}
            cvs={cvs}
          />
        )}
      </main>
    </div>
  );
}
