import Link from "next/link";
import { FileText, Building2, Sparkles, Bell } from "lucide-react";

const tools = [
  { href: "/cv", icon: FileText, title: "Tạo CV", desc: "Dựng CV chuẩn, AI đọc PDF cũ giúp bạn." },
  { href: "/companies", icon: Building2, title: "Đánh giá công ty", desc: "Xem nhận xét & rating trước khi ứng tuyển." },
  { href: "/jobs/recommendations", icon: Sparkles, title: "Việc gợi ý cho tôi", desc: "AI gợi ý tin phù hợp với hồ sơ." },
  { href: "/jobs/alerts", icon: Bell, title: "Thông báo việc làm", desc: "Nhận email khi có tin khớp tiêu chí." },
];

export default function FeatureTools() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <h2 className="mb-6 text-center text-2xl font-bold text-foreground">Công cụ nổi bật</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tools.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
          >
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <t.icon className="h-5 w-5" />
            </span>
            <div className="font-semibold text-foreground">{t.title}</div>
            <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
