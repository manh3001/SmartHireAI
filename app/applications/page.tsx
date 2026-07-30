import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <h1 className="text-xl font-semibold text-blue-700">Ứng tuyển của tôi</h1>
        {applications.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Bạn chưa ứng tuyển tin nào.{" "}
            <Link href="/jobs" className="text-blue-600 hover:underline">Xem tin tuyển dụng</Link>
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {applications.map((a) => (
              <Card key={a.id}>
                <CardHeader className="flex-row items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-blue-700">
                      <Link href={`/jobs/${a.job.id}`} className="hover:underline">
                        {a.job.title || "(chưa có tiêu đề)"}
                      </Link>
                    </CardTitle>
                    <p className="text-sm text-slate-500">{a.job.company || "—"}</p>
                  </div>
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                    {STATUS_LABELS[a.status as ApplicationStatus]}
                  </span>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm text-slate-700">
                  {a.evaluation && (
                    <p>Điểm phù hợp: <span className="font-semibold">{a.evaluation.overallScore}/100</span></p>
                  )}
                  <div className="flex flex-wrap gap-1 text-xs text-slate-500">
                    {a.events.map((e, i) => (
                      <span key={i}>
                        {STATUS_LABELS[e.toStatus as ApplicationStatus]}
                        {i < a.events.length - 1 ? " → " : ""}
                      </span>
                    ))}
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
