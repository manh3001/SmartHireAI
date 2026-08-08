import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import CompanyAvatar from "@/components/CompanyAvatar";
import JobCard from "@/components/JobCard";
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
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Link href="/jobs" className="text-sm text-primary hover:underline">← Về danh sách việc</Link>

        <Card className="mt-3">
          <CardHeader>
            <div className="flex items-center gap-4">
              {company.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={company.logoUrl} alt={company.name} className="h-14 w-14 rounded-lg object-cover" />
              ) : (
                <CompanyAvatar name={company.name} className="h-14 w-14 text-lg" />
              )}
              <div>
                <CardTitle className="text-foreground">{company.name}</CardTitle>
                {company.location && <p className="text-sm text-muted-foreground">📍 {company.location}</p>}
                {company.website && (
                  <a href={company.website} className="text-sm text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                    {company.website}
                  </a>
                )}
              </div>
            </div>
          </CardHeader>
          {company.description && (
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-foreground">{company.description}</p>
            </CardContent>
          )}
        </Card>

        <h2 className="mb-3 mt-6 text-lg font-semibold text-foreground">Tin tuyển dụng ({jobs.length})</h2>
        <div className="flex flex-col gap-3">
          {jobs.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">Công ty chưa đăng tin nào.</CardContent>
            </Card>
          )}
          {jobs.map((j) => (
            <JobCard key={j.id} job={j} href={`/jobs/${j.id}`} />
          ))}
        </div>
      </main>
    </div>
  );
}
