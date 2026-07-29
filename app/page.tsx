import Link from "next/link";
import { FileText, Download, Upload, Sparkles, MessageCircle, Briefcase } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  { icon: FileText, title: "Tạo CV chuyên nghiệp", desc: "Điền theo mẫu có cấu trúc, lưu nhiều phiên bản, chỉnh sửa dễ dàng." },
  { icon: Download, title: "Xuất PDF tiếng Việt", desc: "Tải CV ra PDF đẹp, hiển thị đúng tiếng Việt, sẵn sàng gửi đi." },
  { icon: Upload, title: "Nhập CV từ PDF", desc: "Tải CV PDF cũ lên, AI tự đọc và điền vào form giúp bạn." },
  { icon: Sparkles, title: "AI đánh giá theo JD", desc: "Chấm điểm độ phù hợp, chỉ ra điểm mạnh/yếu và kỹ năng còn thiếu." },
  { icon: MessageCircle, title: "Chatbot tư vấn", desc: "Trò chuyện với AI hiểu ngữ cảnh CV để được tư vấn nghề nghiệp." },
  { icon: Briefcase, title: "Kết nối nhà tuyển dụng", desc: "Nhà tuyển dụng đăng tin, ứng viên đánh giá CV với công việc thật." },
];

const steps = [
  { n: "1", title: "Tạo hoặc nhập CV", desc: "Điền form hoặc tải PDF cũ để AI đọc giúp." },
  { n: "2", title: "AI đánh giá theo JD", desc: "Dán mô tả công việc, nhận điểm và phân tích chi tiết." },
  { n: "3", title: "Cải thiện & ứng tuyển", desc: "Hỏi chatbot, sửa CV và ứng tuyển tin phù hợp." },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <main className="flex-1">
        <section className="bg-gradient-to-b from-blue-50 to-white">
          <div className="mx-auto max-w-3xl px-4 py-24 text-center">
            <p className="mb-3 text-sm font-medium text-blue-600">Miễn phí · AI · Tiếng Việt</p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Nền tảng CV thông minh <span className="text-blue-600">SmartHire</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
              Tạo CV, để AI đánh giá độ phù hợp với công việc, tư vấn cải thiện và kết nối nhà tuyển dụng — tất cả trong một nơi.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Link href="/register"><Button size="lg">Bắt đầu miễn phí</Button></Link>
              <Link href="/login"><Button size="lg" variant="outline">Đăng nhập</Button></Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="mb-8 text-center text-2xl font-bold text-slate-900">Tính năng nổi bật</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

        <section className="bg-slate-50">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <h2 className="mb-8 text-center text-2xl font-bold text-slate-900">Cách hoạt động</h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {steps.map((s) => (
                <div key={s.n} className="text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
                    {s.n}
                  </div>
                  <h3 className="font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{s.desc}</p>
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
