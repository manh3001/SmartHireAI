import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-1.5 text-lg font-bold text-brand-gradient">
            <Sparkles className="h-5 w-5 text-primary" />
            SmartHire
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Nền tảng CV thông minh, kết nối ứng viên và nhà tuyển dụng bằng AI.
          </p>
        </div>
        <div>
          <div className="mb-2 text-sm font-semibold text-foreground">Ứng viên</div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li><Link href="/jobs" className="hover:text-foreground">Việc làm</Link></li>
            <li><Link href="/dashboard" className="hover:text-foreground">Bảng điều khiển</Link></li>
          </ul>
        </div>
        <div>
          <div className="mb-2 text-sm font-semibold text-foreground">Nhà tuyển dụng</div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li><Link href="/jobs/new" className="hover:text-foreground">Đăng tin</Link></li>
          </ul>
        </div>
        <div>
          <div className="mb-2 text-sm font-semibold text-foreground">Tài khoản</div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li><Link href="/login" className="hover:text-foreground">Đăng nhập</Link></li>
            <li><Link href="/register" className="hover:text-foreground">Đăng ký</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} SmartHire. Dự án portfolio.
      </div>
    </footer>
  );
}
