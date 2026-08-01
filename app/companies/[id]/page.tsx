import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import JobMeta from "@/components/JobMeta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const company = await prisma.companyProfile.findUnique({
    where: { id },
    select: {
      userId: true, name: true, description: true, website: true, location: true, logoUrl: true,
    },
  });
  if (!company) notFound();

  const jobs = await prisma.jobDescription.findMany({
    where: { userId: company.userId, isPublic: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, company: true, rawText: true,
      location: true, employmentType: true, experienceLevel: true, skills: true,
      salaryMin: true, salaryMax: true, salaryNegotiable: true,
    },
  });

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Link href="/jobs" className="text-sm text-blue-600 hover:underline">← Về danh sách việc</Link>

        <Card className="mt-3">
          <CardHeader>
            <div className="flex items-center gap-4">
              {company.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={company.logoUrl} alt={company.name} className="h-14 w-14 rounded-lg object-cover" />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <Briefcase className="h-6 w-6" />
                </span>
              )}
              <div>
                <CardTitle className="text-blue-700">{company.name}</CardTitle>
                {company.location && <p className="text-sm text-slate-500">📍 {company.location}</p>}
                {company.website && (
                  <a href={company.website} className="text-sm text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                    {company.website}
                  </a>
                )}
              </div>
            </div>
          </CardHeader>
          {company.description && (
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{company.description}</p>
            </CardContent>
          )}
        </Card>

        <h2 className="mb-3 mt-6 text-lg font-semibold text-slate-900">Tin tuyển dụng ({jobs.length})</h2>
        <div className="flex flex-col gap-3">
          {jobs.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-slate-500">Công ty chưa đăng tin nào.</CardContent>
            </Card>
          )}
          {jobs.map((j) => (
            <Link key={j.id} href={`/jobs/${j.id}`}>
              <Card className="border-slate-200 transition-colors hover:border-blue-300 hover:bg-blue-50/40">
                <CardContent className="py-4">
                  <div className="font-medium text-slate-900">{j.title || "(chưa có tiêu đề)"}</div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{j.rawText}</p>
                  <div className="mt-2">
                    <JobMeta
                      location={j.location}
                      employmentType={j.employmentType}
                      experienceLevel={j.experienceLevel}
                      skills={j.skills}
                      salaryMin={j.salaryMin}
                      salaryMax={j.salaryMax}
                      salaryNegotiable={j.salaryNegotiable}
                    />
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
