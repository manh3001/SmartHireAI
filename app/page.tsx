import Link from "next/link";
import { FileText, Sparkles, Download } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: FileText,
    title: "Tạo CV chuyên nghiệp",
    desc: "Điền thông tin theo mẫu có cấu trúc, chỉnh sửa dễ dàng, lưu nhiều phiên bản.",
  },
  {
    icon: Sparkles,
    title: "AI đánh giá theo JD",
    desc: "Dán mô tả công việc, AI chấm điểm độ phù hợp, chỉ ra điểm mạnh/yếu và kỹ năng còn thiếu.",
  },
  {
    icon: Download,
    title: "Xuất PDF đẹp",
    desc: "Tải CV ra PDF hỗ trợ tiếng Việt, sẵn sàng gửi nhà tuyển dụng.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-b from-blue-50 to-white">
          <div className="mx-auto max-w-3xl px-4 py-24 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Nền tảng CV thông minh <span className="text-blue-600">SmartHire</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
              Tạo CV, để AI đánh giá độ phù hợp với công việc, và cải thiện hồ sơ của bạn — tất cả trong một nơi.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Link href="/register"><Button size="lg">Bắt đầu miễn phí</Button></Link>
              <Link href="/login"><Button size="lg" variant="outline">Đăng nhập</Button></Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-5xl px-4 py-16">
          <div className="grid gap-6 sm:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title} className="border-slate-200">
                <CardContent className="pt-6">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
