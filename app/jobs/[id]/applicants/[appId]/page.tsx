import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import CvView from "@/components/CvView";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_LABELS, type ApplicationStatus } from "@/lib/applications/status";
import type { CvInput } from "@/lib/cv/types";

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
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Link href={`/jobs/${id}/applicants`} className="text-sm text-blue-600 hover:underline">
          ← Về danh sách ứng viên
        </Link>
        <div className="mt-2 flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-blue-700">{app.candidate.name}</h1>
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            {STATUS_LABELS[app.status as ApplicationStatus]}
          </span>
        </div>
        <div className="mt-2">
          <Link href={`/messages/${app.id}`} className="text-sm text-blue-600 hover:underline">
            Nhắn tin với ứng viên
          </Link>
        </div>

        {app.evaluation && (
          <Card className="mt-3">
            <CardHeader><CardTitle className="text-blue-700">Điểm phù hợp AI</CardTitle></CardHeader>
            <CardContent className="text-sm text-slate-700">
              <p className="font-semibold">{app.evaluation.overallScore}/100</p>
              {app.evaluation.summary && <p className="mt-1">{app.evaluation.summary}</p>}
            </CardContent>
          </Card>
        )}

        {app.coverLetter && (
          <Card className="mt-3">
            <CardHeader><CardTitle className="text-blue-700">Thư giới thiệu</CardTitle></CardHeader>
            <CardContent className="whitespace-pre-wrap text-sm text-slate-700">
              {app.coverLetter}
            </CardContent>
          </Card>
        )}

        <Card className="mt-3">
          <CardHeader><CardTitle className="text-blue-700">CV đã nộp</CardTitle></CardHeader>
          <CardContent><CvView cv={cv} /></CardContent>
        </Card>

        <Card className="mt-3">
          <CardHeader><CardTitle className="text-blue-700">Lịch sử trạng thái</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1 text-xs text-slate-500">
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
