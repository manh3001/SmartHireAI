import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, Plus, Briefcase } from "lucide-react";
import prisma from "@/lib/db/prisma";
import { createCv } from "@/lib/cv/actions";
import { deleteJobDescription } from "@/lib/jobs/actions";
import Navbar from "@/components/Navbar";
import ImportCvButton from "./ImportCvButton";
import RecruiterStats from "./RecruiterStats";
import RecruiterAnalytics from "@/components/dashboard/RecruiterAnalytics";
import CandidateStats from "./CandidateStats";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import CvCard from "./CvCard";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const isRecruiter = session.user.role === "RECRUITER";

  if (isRecruiter) {
    const jobs = await prisma.jobDescription.findMany({
      where: { userId: session.user.id, isPublic: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, company: true, createdAt: true },
    });
    const companyProfile = await prisma.companyProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    return (
      <div className="flex min-h-full flex-col bg-muted/20">
        <Navbar />
        <main className="mx-auto w-full max-w-3xl flex-1 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Tin tuyển dụng của bạn</h1>
              <p className="text-sm text-muted-foreground">Xin chào, {session.user.name}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/company/edit" className={buttonVariants({ variant: "outline" })}>Hồ sơ công ty</Link>
              {companyProfile && (
                <Link href={`/companies/${companyProfile.id}`} className={buttonVariants({ variant: "outline" })}>Xem trang công ty</Link>
              )}
              <Link href="/jobs/new" className={buttonVariants()}><Plus className="mr-1 h-4 w-4" /> Đăng JD</Link>
            </div>
          </div>
          <RecruiterStats userId={session.user.id} />
          <Suspense fallback={<div className="mb-6 h-48 animate-pulse rounded-xl bg-muted" />}>
            <RecruiterAnalytics userId={session.user.id} />
          </Suspense>
          <div className="flex flex-col gap-3">
            {jobs.length === 0 && (
              <EmptyState
                icon={<Briefcase className="h-10 w-10" />}
                title="Chưa có tin tuyển dụng nào"
                description={'Bấm "Đăng JD" để đăng tin tuyển dụng đầu tiên.'}
                action={
                  <Link href="/jobs/new" className={buttonVariants()}>
                    <Plus className="mr-1 h-4 w-4" /> Đăng JD
                  </Link>
                }
              />
            )}
            {jobs.map((j) => (
              <Card key={j.id} className="border-border">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Briefcase className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="font-medium text-foreground">{j.title || "(chưa có tiêu đề)"}</div>
                      <div className="text-xs text-muted-foreground">
                        {j.company || "—"} · {new Date(j.createdAt).toLocaleDateString("vi-VN")}
                      </div>
                    </div>
                  </div>
                  <form action={deleteJobDescription}>
                    <input type="hidden" name="id" value={j.id} />
                    <Button variant="ghost" size="sm" type="submit" className="text-muted-foreground hover:text-destructive">Xóa</Button>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    );
  }

  const cvs = await prisma.cV.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: { id: true, title: true, template: true, updatedAt: true, isDefault: true, shareToken: true },
  });
  const cvCount = cvs.length;
  const atLimit = cvCount >= 3;
  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">CV của bạn</h1>
            <p className="text-sm text-muted-foreground">Xin chào, {session.user.name}</p>
          </div>
          <div className="flex gap-2">
            <ImportCvButton />
            {!atLimit ? (
              <form action={createCv}>
                <Button type="submit"><Plus className="mr-1 h-4 w-4" /> Tạo CV mới</Button>
              </form>
            ) : (
              <Button disabled title="Đã đạt giới hạn 3 CV">
                <Plus className="mr-1 h-4 w-4" /> Tạo CV mới ({cvCount}/3)
              </Button>
            )}
          </div>
        </div>
        <CandidateStats userId={session.user.id} />
        <div className="flex flex-col gap-3">
          {cvs.length === 0 && (
            <EmptyState
              icon={<FileText className="h-10 w-10" />}
              title="Chưa có CV nào"
              description={'Bấm "Tạo CV mới" để tạo CV đầu tiên của bạn.'}
            />
          )}
          {cvs.map((cv) => (
            <CvCard
              key={cv.id}
              id={cv.id}
              title={cv.title}
              template={cv.template}
              updatedAt={cv.updatedAt}
              isDefault={cv.isDefault}
              shareToken={cv.shareToken}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
