import Link from "next/link";
import * as Icons from "lucide-react";
import { auth } from "@/auth";
export const dynamic = "force-dynamic";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import HomeSearch from "@/components/home/HomeSearch";
import JobCard from "@/components/JobCard";
import { buttonVariants } from "@/components/ui/button";
import { JOB_CATEGORIES } from "@/lib/jobs/job-categories";

const steps = [
  { n: "1", title: "Tạo hoặc nhập CV", desc: "Điền form hoặc tải PDF cũ để AI đọc giúp." },
  { n: "2", title: "AI đánh giá theo JD", desc: "Dán mô tả công việc, nhận điểm và phân tích chi tiết." },
  { n: "3", title: "Cải thiện & ứng tuyển", desc: "Hỏi chatbot, sửa CV và ứng tuyển tin phù hợp." },
];

export default async function Home() {
  const session = await auth();
  const loggedIn = !!session?.user;

  const [latestJobs, jobCount, companyGroups, cvCount] = await Promise.all([
    prisma.jobDescription.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true, title: true, company: true, location: true, rawText: true,
        employmentType: true, experienceLevel: true, skills: true,
        salaryMin: true, salaryMax: true, salaryNegotiable: true,
      },
    }),
    prisma.jobDescription.count({ where: { isPublic: true } }),
    prisma.jobDescription.findMany({ where: { isPublic: true }, distinct: ["company"], select: { company: true } }),
    prisma.cV.count(),
  ]);
  const companyCount = companyGroups.filter((c) => c.company.trim()).length;

  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-b from-primary/5 to-background">
          <div className="mx-auto max-w-3xl px-4 py-20 text-center">
            <p className="mb-3 text-sm font-medium text-primary">Miễn phí · AI · Tiếng Việt</p>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Tìm việc thông minh cùng <span className="text-brand-gradient">SmartHire</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Tạo CV, để AI đánh giá độ phù hợp với công việc và kết nối nhà tuyển dụng — tất cả trong một nơi.
            </p>
            <HomeSearch />
            {!loggedIn && (
              <div className="mt-4">
                <Link href="/register" className={buttonVariants({ variant: "ghost" })}>Tạo tài khoản miễn phí →</Link>
              </div>
            )}
          </div>
        </section>

        {/* Ngành nghề */}
        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="mb-6 text-center text-2xl font-bold text-foreground">Khám phá theo ngành nghề</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {JOB_CATEGORIES.map((c) => {
              const Icon = (Icons[c.icon as keyof typeof Icons] ?? Icons.Briefcase) as Icons.LucideIcon;
              return (
                <Link
                  key={c.slug}
                  href={`/jobs?category=${c.slug}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
                >
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-medium text-foreground">{c.label}</span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Việc mới */}
        {latestJobs.length > 0 && (
          <section className="bg-muted/30">
            <div className="mx-auto max-w-6xl px-4 py-14">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-foreground">Việc làm mới nhất</h2>
                <Link href="/jobs" className="text-sm font-medium text-primary hover:underline">Xem tất cả →</Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {latestJobs.map((j) => (
                  <JobCard key={j.id} job={j} href={loggedIn ? `/jobs/${j.id}` : "/login"} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Số liệu */}
        <section className="mx-auto max-w-6xl px-4 py-14">
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { n: jobCount, label: "Tin tuyển dụng" },
              { n: companyCount, label: "Công ty" },
              { n: cvCount, label: "CV đã tạo" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-border bg-card p-6">
                <div className="text-3xl font-bold text-brand-gradient">{s.n}</div>
                <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 3 bước */}
        <section className="bg-muted/30">
          <div className="mx-auto max-w-5xl px-4 py-14">
            <h2 className="mb-8 text-center text-2xl font-bold text-foreground">Cách hoạt động</h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {steps.map((s) => (
                <div key={s.n} className="text-center">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-gradient text-lg font-bold text-white">
                    {s.n}
                  </div>
                  <h3 className="font-semibold text-foreground">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
