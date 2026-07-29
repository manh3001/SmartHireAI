import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";

export default async function JobsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const jobs = await prisma.jobDescription.findMany({
    where: { isPublic: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, company: true, rawText: true, createdAt: true },
  });

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <h1 className="mb-4 text-2xl font-bold text-slate-900">Tin tuyển dụng</h1>
        <div className="flex flex-col gap-3">
          {jobs.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-slate-500">Chưa có tin tuyển dụng nào.</CardContent>
            </Card>
          )}
          {jobs.map((j) => (
            <Link key={j.id} href={`/jobs/${j.id}`}>
              <Card className="border-slate-200 transition-colors hover:border-blue-300 hover:bg-blue-50/40">
                <CardContent className="flex items-start gap-3 py-4">
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
          ))}
        </div>
      </main>
    </div>
  );
}
