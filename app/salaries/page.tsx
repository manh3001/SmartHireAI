import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart3 } from "lucide-react";
import { getCachedSalaryData } from "@/lib/salary/insights-data";
import SalaryTable from "@/components/salary/SalaryTable";
import type { SalaryBarRow } from "@/lib/salary/insights";

export const metadata: Metadata = {
  title: "Thống kê lương theo ngành, cấp bậc & kỹ năng | SmartHire",
  description: "Khoảng lương phổ biến theo ngành nghề, cấp bậc và kỹ năng, tổng hợp từ tin tuyển dụng trên SmartHire.",
  alternates: { canonical: "/salaries" },
};

export default async function SalariesPage() {
  const { byCategory, byLevel, bySkill } = await getCachedSalaryData();
  const categoryRows: SalaryBarRow[] = byCategory.map((c) => ({
    label: c.label,
    sampleSize: c.sampleSize,
    medianMin: c.medianMin,
    medianMax: c.medianMax,
  }));
  const empty = byCategory.length === 0 && byLevel.length === 0 && bySkill.length === 0;

  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl flex-1 p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-foreground">Thống kê lương</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Khoảng lương phổ biến (trung vị) theo ngành, cấp bậc và kỹ năng, tổng hợp từ các tin tuyển dụng công khai.
        </p>
        {empty ? (
          <div className="mt-8">
            <EmptyState
              icon={<BarChart3 className="h-10 w-10" />}
              title="Chưa đủ dữ liệu lương"
              description="Chưa có tin tuyển dụng nào có mức lương để thống kê."
            />
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-8">
            {categoryRows.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-foreground">Theo ngành</h2>
                <SalaryTable rows={categoryRows} />
              </section>
            )}
            {byLevel.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-foreground">Theo cấp bậc</h2>
                <SalaryTable rows={byLevel} />
              </section>
            )}
            {bySkill.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-foreground">Top kỹ năng lương cao</h2>
                <SalaryTable rows={bySkill} />
              </section>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
