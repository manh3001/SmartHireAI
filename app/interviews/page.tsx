import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getUpcomingInterviews, type UpcomingRow, type UpcomingDeps } from "@/lib/applications/upcoming";

export const dynamic = "force-dynamic";

export default async function InterviewsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = session.user.role;
  if (role !== "CANDIDATE" && role !== "RECRUITER") redirect("/dashboard");

  const deps: UpcomingDeps = {
    listForCandidate: async (candidateId, now) => {
      const rows = await prisma.interview.findMany({
        where: { scheduledAt: { gte: now }, application: { candidateId } },
        select: {
          scheduledAt: true, location: true, meetingLink: true,
          application: {
            select: {
              id: true,
              job: { select: { id: true, title: true, company: true } },
            },
          },
        },
      });
      return rows.map((r): UpcomingRow => ({
        applicationId: r.application.id,
        jobId: r.application.job.id,
        jobTitle: r.application.job.title || "(chưa có tiêu đề)",
        company: r.application.job.company || "—",
        counterpartName: r.application.job.company || "—",
        scheduledAt: r.scheduledAt,
        location: r.location,
        meetingLink: r.meetingLink,
      }));
    },
    listForRecruiter: async (recruiterId, now) => {
      const rows = await prisma.interview.findMany({
        where: { scheduledAt: { gte: now }, application: { job: { userId: recruiterId } } },
        select: {
          scheduledAt: true, location: true, meetingLink: true,
          application: {
            select: {
              id: true,
              candidate: { select: { name: true } },
              job: { select: { id: true, title: true, company: true } },
            },
          },
        },
      });
      return rows.map((r): UpcomingRow => ({
        applicationId: r.application.id,
        jobId: r.application.job.id,
        jobTitle: r.application.job.title || "(chưa có tiêu đề)",
        company: r.application.job.company || "—",
        counterpartName: r.application.candidate.name,
        scheduledAt: r.scheduledAt,
        location: r.location,
        meetingLink: r.meetingLink,
      }));
    },
  };

  const items = await getUpcomingInterviews(session.user.id, role, new Date(), deps);
  const isRecruiter = role === "RECRUITER";

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <h1 className="text-xl font-semibold text-foreground">Lịch phỏng vấn sắp tới</h1>
        {items.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="h-10 w-10" />}
            title="Chưa có lịch phỏng vấn"
            description="Các buổi phỏng vấn sắp tới sẽ hiển thị ở đây."
          />
        ) : (
          <div className="mt-4 grid gap-3">
            {items.map((it) => (
              <Card key={it.applicationId}>
                <CardHeader>
                  <CardTitle className="text-foreground">
                    {it.jobTitle} · {it.company}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {isRecruiter ? `Ứng viên: ${it.counterpartName}` : it.company}
                  </p>
                </CardHeader>
                <CardContent className="grid gap-1 text-sm text-foreground">
                  <p className="font-medium">
                    {it.scheduledAt.toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                  {it.location && <p className="text-muted-foreground">Địa điểm: {it.location}</p>}
                  {it.meetingLink && (
                    <a href={it.meetingLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      Link tham gia
                    </a>
                  )}
                  <div className="mt-1 flex gap-3">
                    {isRecruiter ? (
                      <Link href={`/jobs/${it.jobId}/applicants/${it.applicationId}`} className="text-sm text-primary hover:underline">
                        Xem ứng viên →
                      </Link>
                    ) : (
                      <>
                        <a href={`/api/applications/${it.applicationId}/interview.ics`} className="text-sm text-primary hover:underline">
                          + Thêm vào lịch
                        </a>
                        <Link href={`/messages/${it.applicationId}`} className="text-sm text-primary hover:underline">
                          Nhắn tin
                        </Link>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
