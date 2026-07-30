import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ApplyForm from "./ApplyForm";

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "CANDIDATE") redirect(`/jobs/${id}`);

  const job = await prisma.jobDescription.findFirst({
    where: { id, isPublic: true },
    select: { id: true, title: true, company: true },
  });
  if (!job) notFound();

  const existing = await prisma.application.findFirst({
    where: { jobId: id, candidateId: session.user.id },
    select: { id: true },
  });
  if (existing) redirect("/applications");

  const cvs = await prisma.cV.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true },
  });

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <Link href={`/jobs/${id}`} className="text-sm text-blue-600 hover:underline">← Về tin tuyển dụng</Link>
        <Card className="mt-3">
          <CardHeader>
            <CardTitle className="text-blue-700">{job.title || "(chưa có tiêu đề)"}</CardTitle>
            <p className="text-sm text-slate-500">{job.company || "—"}</p>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">Chọn CV, xem điểm phù hợp và nộp đơn.</p>
          </CardContent>
        </Card>
        <ApplyForm jobId={job.id} cvs={cvs} />
      </main>
    </div>
  );
}
