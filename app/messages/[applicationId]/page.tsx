import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import { STATUS_LABELS, type ApplicationStatus } from "@/lib/applications/status";
import { isThreadParticipant } from "@/lib/messages/access";
import MessageComposer from "./MessageComposer";

export const dynamic = "force-dynamic";

export default async function MessagesPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      candidateId: true,
      status: true,
      candidate: { select: { name: true } },
      job: { select: { id: true, userId: true, title: true, user: { select: { name: true } } } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, body: true, senderId: true, createdAt: true, sender: { select: { name: true } } },
      },
    },
  });
  if (!app) notFound();
  if (!isThreadParticipant(userId, { candidateId: app.candidateId, recruiterId: app.job.userId })) {
    notFound();
  }

  const iAmCandidate = userId === app.candidateId;
  const otherName = iAmCandidate ? app.job.user.name : app.candidate.name;
  const backHref = iAmCandidate ? "/applications" : `/jobs/${app.job.id}/applicants/${applicationId}`;

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <Link href={backHref} className="text-sm text-blue-600 hover:underline">← Quay lại</Link>
        <div className="mt-2 flex items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-blue-700">{otherName}</h1>
            <p className="text-sm text-slate-500">{app.job.title || "(chưa có tiêu đề)"}</p>
          </div>
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            {STATUS_LABELS[app.status as ApplicationStatus]}
          </span>
        </div>

        <div className="mt-4 grid gap-2">
          {app.messages.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">Chưa có tin nhắn nào. Hãy bắt đầu cuộc trò chuyện.</p>
          )}
          {app.messages.map((m) => {
            const mine = m.senderId === userId;
            return (
              <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className={`mt-1 text-[10px] ${mine ? "text-blue-100" : "text-slate-400"}`}>
                    {m.sender.name} · {new Date(m.createdAt).toLocaleString("vi-VN")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <MessageComposer applicationId={applicationId} />
      </main>
    </div>
  );
}
