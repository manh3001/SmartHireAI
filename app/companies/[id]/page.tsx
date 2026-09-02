import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import CompanyAvatar from "@/components/CompanyAvatar";
import JobCard from "@/components/JobCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { summarizeReviews, canReview } from "@/lib/company/reviews";
import { StarDisplay } from "@/components/companies/StarRating";
import ReviewForm from "@/components/companies/ReviewForm";

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

  const reviews = await prisma.companyReview.findMany({
    where: { companyId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, rating: true, comment: true, createdAt: true }, // ẩn danh: không select user
  });
  const summary = summarizeReviews(reviews.map((r) => r.rating));

  const isOwner = company.userId === session.user.id;
  const isCandidate = session.user.role === "CANDIDATE";
  const appliedCount = isCandidate
    ? await prisma.application.count({
        where: { candidateId: session.user.id, job: { userId: company.userId } },
      })
    : 0;
  const eligible = isCandidate && canReview({ hasApplied: appliedCount > 0, isOwner });
  const myReview = eligible
    ? await prisma.companyReview.findUnique({
        where: { userId_companyId: { userId: session.user.id, companyId: id } },
        select: { rating: true, comment: true },
      })
    : null;

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Link href="/jobs" className="text-sm text-primary hover:underline">← Về danh sách việc</Link>

        <Card className="mt-3">
          <CardHeader>
            <div className="flex items-center gap-4">
              {company.logoUrl ? (
                <Image
                  src={company.logoUrl}
                  alt={company.name}
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-lg object-cover"
                />
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
        <section className="mt-8">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-lg font-semibold text-foreground">Đánh giá</h2>
            {summary.count > 0 && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <StarDisplay value={summary.average} />
                <span className="font-medium text-foreground">{summary.average.toFixed(1)}</span>
                <span>({summary.count} đánh giá)</span>
              </span>
            )}
          </div>

          {eligible && (
            <div className="mb-4">
              <ReviewForm
                companyId={id}
                initial={myReview ? { rating: myReview.rating, comment: myReview.comment } : undefined}
              />
            </div>
          )}

          <div className="flex flex-col gap-3">
            {reviews.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground">
                  Chưa có đánh giá nào.
                </CardContent>
              </Card>
            ) : (
              reviews.map((r) => (
                <Card key={r.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <StarDisplay value={r.rating} />
                      <span>· Ứng viên ·</span>
                      <span>{new Date(r.createdAt).toLocaleDateString("vi-VN")}</span>
                    </div>
                    {r.comment && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{r.comment}</p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
