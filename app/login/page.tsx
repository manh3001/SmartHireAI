"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Email hoặc mật khẩu không đúng");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-1.5 text-xl font-bold text-blue-600">
          <Sparkles className="h-6 w-6" /> SmartHire
        </Link>
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="mb-6 text-center text-2xl font-bold text-slate-900">Đăng nhập</h1>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Input name="email" type="email" placeholder="Email" required />
            <Input name="password" type="password" placeholder="Mật khẩu" required />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading} className="mt-1">
              {loading ? "Đang xử lý..." : "Đăng nhập"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-600">
            Chưa có tài khoản?{" "}
            <Link href="/register" className="font-medium text-blue-600 hover:underline">Đăng ký</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
