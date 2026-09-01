"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import GoogleSignInButton from "@/components/GoogleSignInButton";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        name: form.get("name"),
        password: form.get("password"),
        role: form.get("role"),
      }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/login");
    } else {
      const data = await res.json();
      setError(data.error ?? "Đăng ký thất bại");
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-b from-primary/5 to-background p-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-1.5 text-xl font-bold text-brand-gradient">
          <Sparkles className="h-6 w-6" /> SmartHire
        </Link>
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <h1 className="mb-6 text-center text-2xl font-bold text-foreground">Đăng ký</h1>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Input name="name" placeholder="Họ tên" required />
            <Input name="email" type="email" placeholder="Email" required />
            <Input name="password" type="password" placeholder="Mật khẩu (>= 8 ký tự)" required />
            <select
              name="role"
              defaultValue="CANDIDATE"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="CANDIDATE">Tôi là Ứng viên</option>
              <option value="RECRUITER">Tôi là Nhà tuyển dụng</option>
            </select>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading} className="mt-1">
              {loading ? "Đang xử lý..." : "Đăng ký"}
            </Button>
          </form>
          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">hoặc</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <GoogleSignInButton label="Đăng ký với Google" />
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Đăng ký bằng Google sẽ tạo tài khoản Ứng viên.
          </p>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Đã có tài khoản?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">Đăng nhập</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
