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
import NotesPanel from "@/components/NotesPanel";
import CancelInterviewButton from "./CancelInterviewButton";
import ScheduleInterviewButton from "./ScheduleInterviewButton";
import OutcomePanel from "./OutcomePanel";

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
      notes: {
        orderBy: { createdAt: "asc" },
        select: { id: true, content: true, createdAt: true },
      },
      interview: {
        select: {
          scheduledAt: true,
          location: true,
          meetingLink: true,
          note: true,
          outcome: true,
        },
      },
    },
  });
  if (!app) notFound();

  const cv = app.cvSnapshot as unknown as CvInput;

  const iv = app.interview;
  const interviewInitial = iv
    ? (() => {
        const d = new Date(iv.scheduledAt);
        const pad = (n: number) => String(n).padStart(2, "0");
        return {
          date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
          time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
          location: iv.location,
          meetingLink: iv.meetingLink,
          note: iv.note,
        };
      })()
    : undefined;

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

        {app.interview && (
          <Card className="mt-3">
            <CardHeader>
              <CardTitle className="text-foreground">Lịch phỏng vấn</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-foreground">
              <p>
                <span className="font-medium">Thời gian: </span>
                {new Date(app.interview.scheduledAt).toLocaleString("vi-VN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
              {app.interview.location && (
                <p>
                  <span className="font-medium">Địa điểm: </span>
                  {app.interview.location}
                </p>
              )}
              {app.interview.meetingLink && (
                <p>
                  <span className="font-medium">Link: </span>
                  <a
                    href={app.interview.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {app.interview.meetingLink}
                  </a>
                </p>
              )}
              {app.interview.note && (
                <p>
                  <span className="font-medium">Ghi chú: </span>
                  {app.interview.note}
                </p>
              )}
              <OutcomePanel applicationId={app.id} initialOutcome={app.interview.outcome} />
              <div className="flex gap-2 pt-2">
                <ScheduleInterviewButton applicationId={app.id} initial={interviewInitial} />
                <CancelInterviewButton applicationId={app.id} />
              </div>
            </CardContent>
          </Card>
        )}

        {!app.interview && (
          <Card className="mt-3">
            <CardHeader><CardTitle className="text-foreground">Lịch phỏng vấn</CardTitle></CardHeader>
            <CardContent>
              <ScheduleInterviewButton applicationId={app.id} />
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

        <NotesPanel applicationId={app.id} initialNotes={app.notes} />
      </main>
    </div>
  );
}
