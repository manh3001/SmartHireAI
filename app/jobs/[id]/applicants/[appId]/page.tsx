import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import CvView from "@/components/CvView";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_LABELS, type ApplicationStatus } from "@/lib/applications/status";
import type { CvInput } from "@/lib/cv/types";
import CompanyAvatar from "@/components/CompanyAvatar";
import ScoreBadge from "@/components/ScoreBadge";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ApplicantDetailPage({
  params,
}: {
  params: Promise<{ id: string; appId: string }>;
}) {
  const { id, appId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "RECRUITER") redirect(`/jobs/${id}`);

  const app = await prisma.application.findFirst({
    where: { id: appId, jobId: id, job: { userId: session.user.id } },
    select: {
      id: true,
      status: true,
      coverLetter: true,
      cvSnapshot: true,
      candidate: { select: { name: true } },
      evaluation: { select: { overallScore: true, summary: true } },
      events: {
        orderBy: { createdAt: "asc" },
        select: { toStatus: true, createdAt: true },
      },
    },
  });
  if (!app) notFound();

  const cv = app.cvSnapshot as unknown as CvInput;

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Link href={`/jobs/${id}/applicants`} className="text-sm text-primary hover:underline">
          ← Về danh sách ứng viên
        </Link>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CompanyAvatar name={app.candidate.name} className="h-9 w-9 text-xs" />
            <h1 className="text-xl font-semibold text-foreground">{app.candidate.name}</h1>
          </div>
          <Badge>{STATUS_LABELS[app.status as ApplicationStatus]}</Badge>
        </div>
        <div className="mt-2">
          <Link href={`/messages/${app.id}`} className="text-sm text-primary hover:underline">
            Nhắn tin với ứng viên
          </Link>
        </div>

        {app.evaluation && (
          <Card className="mt-3">
            <CardHeader><CardTitle className="text-foreground">Điểm phù hợp AI</CardTitle></CardHeader>
            <CardContent className="text-sm text-foreground">
              <ScoreBadge score={app.evaluation.overallScore} />
              {app.evaluation.summary && <p className="mt-1">{app.evaluation.summary}</p>}
            </CardContent>
          </Card>
        )}

        {app.coverLetter && (
          <Card className="mt-3">
            <CardHeader><CardTitle className="text-foreground">Thư giới thiệu</CardTitle></CardHeader>
            <CardContent className="whitespace-pre-wrap text-sm text-foreground">
              {app.coverLetter}
            </CardContent>
          </Card>
        )}

        <Card className="mt-3">
          <CardHeader><CardTitle className="text-foreground">CV đã nộp</CardTitle></CardHeader>
          <CardContent><CvView cv={cv} /></CardContent>
        </Card>

        <Card className="mt-3">
          <CardHeader><CardTitle className="text-foreground">Lịch sử trạng thái</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1 text-xs text-muted-foreground">
            {app.events.map((e, i) => (
              <span key={i}>
                {STATUS_LABELS[e.toStatus as ApplicationStatus]}
                {i < app.events.length - 1 ? " → " : ""}
              </span>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
