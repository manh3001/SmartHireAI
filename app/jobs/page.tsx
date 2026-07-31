import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import SaveJobButton from "./SaveJobButton";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { q } = await searchParams;
  const term = (q ?? "").trim();

  const jobs = await prisma.jobDescription.findMany({
    where: {
      isPublic: true,
      ...(term
        ? {
            OR: [
              { title: { contains: term, mode: "insensitive" } },
              { company: { contains: term, mode: "insensitive" } },
              { rawText: { contains: term, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, company: true, rawText: true, createdAt: true },
  });

  const isCandidate = session.user.role === "CANDIDATE";
  const savedIds = isCandidate
    ? new Set(
        (
          await prisma.savedJob.findMany({
            where: { userId: session.user.id },
            select: { jobId: true },
          })
        ).map((s) => s.jobId),
      )
    : new Set<string>();

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <h1 className="mb-4 text-2xl font-bold text-slate-900">Tin tuyển dụng</h1>
        <form method="get" className="mb-4 flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={term}
            placeholder="Tìm theo tiêu đề, công ty, nội dung..."
            className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Tìm
          </button>
        </form>
        {isCandidate && (
          <div className="mb-4">
            <Link href="/jobs/saved" className="text-sm text-blue-600 hover:underline">
              🔖 Tin đã lưu
            </Link>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {jobs.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-slate-500">
                {term ? `Không tìm thấy tin nào khớp "${term}".` : "Chưa có tin tuyển dụng nào."}
              </CardContent>
            </Card>
          )}
          {jobs.map((j) => (
            <div key={j.id} className="relative">
              <Link href={`/jobs/${j.id}`}>
                <Card className="border-slate-200 transition-colors hover:border-blue-300 hover:bg-blue-50/40">
                  <CardContent className="flex items-start gap-3 py-4 pr-10">
                    <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                      <Briefcase className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="font-medium text-slate-900">{j.title || "(chưa có tiêu đề)"}</div>
                      <div className="text-xs text-slate-400">{j.company || "—"}</div>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{j.rawText}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              {isCandidate && (
                <div className="absolute right-2 top-2">
                  <SaveJobButton jobId={j.id} initialSaved={savedIds.has(j.id)} />
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
