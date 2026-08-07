import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import JobCard from "@/components/JobCard";
import SaveJobButton from "../SaveJobButton";

export const dynamic = "force-dynamic";

export default async function SavedJobsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "CANDIDATE") redirect("/jobs");

  const saved = await prisma.savedJob.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      job: {
        select: {
          id: true, title: true, company: true,
          location: true, employmentType: true, experienceLevel: true, skills: true,
          salaryMin: true, salaryMax: true, salaryNegotiable: true,
        },
      },
    },
  });

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Link href="/jobs" className="text-sm text-primary hover:underline">← Về danh sách việc</Link>
        <h1 className="mb-4 mt-2 text-2xl font-bold text-foreground">Tin đã lưu</h1>
        <div className="flex flex-col gap-3">
          {saved.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">Bạn chưa lưu tin nào.</div>
          )}
          {saved.map(({ job: j }) => (
            <JobCard
              key={j.id}
              job={j}
              href={`/jobs/${j.id}`}
              saveSlot={<SaveJobButton jobId={j.id} initialSaved={true} />}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
