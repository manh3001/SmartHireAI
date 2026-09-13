import type { Metadata } from "next";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart3 } from "lucide-react";
import { computeSalaryInsights } from "@/lib/salary/insights";
import { formatSalary } from "@/lib/jobs/salary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lương theo ngành | SmartHire",
  description: "Khoảng lương phổ biến theo ngành nghề, tổng hợp từ tin tuyển dụng trên SmartHire.",
  alternates: { canonical: "/salaries" },
};

export default async function SalariesPage() {
  const rows = await prisma.jobDescription.findMany({
    where: { isPublic: true },
    select: { category: true, salaryMin: true, salaryMax: true },
  });
  const insights = computeSalaryInsights(rows);
  const maxMedian = Math.max(1, ...insights.map((i) => i.medianMax ?? 0));

  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl flex-1 p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-foreground">Lương theo ngành</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Khoảng lương phổ biến (trung vị) theo ngành, tổng hợp từ các tin tuyển dụng công khai.
        </p>
        {insights.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={<BarChart3 className="h-10 w-10" />}
              title="Chưa đủ dữ liệu lương"
              description="Chưa có tin tuyển dụng nào có mức lương để thống kê."
            />
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {insights.map((i) => (
              <div key={i.category} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">{i.label}</span>
                  <span className="text-sm font-medium text-foreground">
                    {formatSalary(i.medianMin, i.medianMax, false) ?? "—"}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-brand-gradient"
                    style={{ width: `${((i.medianMax ?? 0) / maxMedian) * 100}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {i.sampleSize} tin{i.sampleSize < 5 ? " · ít dữ liệu" : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
