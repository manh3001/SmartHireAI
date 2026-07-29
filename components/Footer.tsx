import { Sparkles } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-1 px-4 py-6 text-center text-sm text-slate-500">
        <span className="flex items-center gap-1.5 font-semibold text-blue-600">
          <Sparkles className="h-4 w-4" /> SmartHire
        </span>
        <span>Nền tảng CV thông minh · Dự án demo © 2026</span>
      </div>
    </footer>
  );
}
