import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  STATUS_LABELS,
  canWithdraw,
  type ApplicationStatus,
} from "@/lib/applications/status";
import WithdrawButton from "./WithdrawButton";

export const dynamic = "force-dynamic";

export default async function MyApplicationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "CANDIDATE") redirect("/dashboard");

  const applications = await prisma.application.findMany({
    where: { candidateId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      job: { select: { id: true, title: true, company: true } },
      evaluation: { select: { overallScore: true } },
      events: {
        orderBy: { createdAt: "asc" },
        select: { toStatus: true, createdAt: true },
      },
    },
  });

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <h1 className="text-xl font-semibold text-foreground">Ứng tuyển của tôi</h1>
        {applications.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Bạn chưa ứng tuyển tin nào.{" "}
            <Link href="/jobs" className="text-primary hover:underline">Xem tin tuyển dụng</Link>
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {applications.map((a) => (
              <Card key={a.id}>
                <CardHeader className="flex-row items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-foreground">
                      <Link href={`/jobs/${a.job.id}`} className="hover:underline">
                        {a.job.title || "(chưa có tiêu đề)"}
                      </Link>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{a.job.company || "—"}</p>
                  </div>
                  <Badge>{STATUS_LABELS[a.status as ApplicationStatus]}</Badge>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm text-foreground">
                  {a.evaluation && (
                    <p>Điểm phù hợp: <span className="font-semibold">{a.evaluation.overallScore}/100</span></p>
                  )}
                  <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                    {a.events.map((e, i) => (
                      <span key={i}>
                        {STATUS_LABELS[e.toStatus as ApplicationStatus]}
                        {i < a.events.length - 1 ? " → " : ""}
                      </span>
                    ))}
                  </div>
                  <div>
                    <Link href={`/messages/${a.id}`} className="text-sm text-primary hover:underline">
                      Nhắn tin
                    </Link>
                  </div>
                  {canWithdraw(a.status as ApplicationStatus) && (
                    <div><WithdrawButton applicationId={a.id} /></div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
