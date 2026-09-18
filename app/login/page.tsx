"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { verifyPasswordStep } from "@/lib/auth/twofactor-actions";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  async function onSubmitCredentials(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const status = await verifyPasswordStep(email, password);
    if (status === "invalid") {
      setLoading(false);
      setError("Email hoặc mật khẩu không đúng");
      return;
    }
    if (status === "needs2fa") {
      setLoading(false);
      setStep("code");
      return;
    }
    // status === "ok" -> đăng nhập luôn
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) setError("Email hoặc mật khẩu không đúng");
    else router.push("/dashboard");
  }

  async function onSubmitCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email, password, code, redirect: false });
    setLoading(false);
    if (res?.error) setError("Mã xác thực không đúng");
    else router.push("/dashboard");
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-b from-primary/5 to-background p-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-1.5 text-xl font-bold text-brand-gradient">
          <Sparkles className="h-6 w-6" /> SmartHire
        </Link>
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <h1 className="mb-6 text-center text-2xl font-bold text-foreground">Đăng nhập</h1>

          {step === "credentials" ? (
            <>
              <form onSubmit={onSubmitCredentials} className="flex flex-col gap-3">
                <Input name="email" type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                <Input name="password" type="password" placeholder="Mật khẩu" required value={password} onChange={(e) => setPassword(e.target.value)} />
                <Link href="/forgot-password" className="self-end text-xs text-muted-foreground hover:text-primary">
                  Quên mật khẩu?
                </Link>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button type="submit" disabled={loading} className="mt-1">
                  {loading ? "Đang xử lý..." : "Đăng nhập"}
                </Button>
              </form>
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">hoặc</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <GoogleSignInButton />
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Chưa có tài khoản?{" "}
                <Link href="/register" className="font-medium text-primary hover:underline">Đăng ký</Link>
              </p>
            </>
          ) : (
            <form onSubmit={onSubmitCode} className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Nhập mã 6 số từ ứng dụng xác thực, hoặc một mã dự phòng.
              </p>
              <Input
                name="code"
                inputMode="text"
                autoComplete="one-time-code"
                placeholder="Mã xác thực"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={loading} className="mt-1">
                {loading ? "Đang xác thực..." : "Xác nhận"}
              </Button>
              <button
                type="button"
                onClick={() => { setStep("credentials"); setCode(""); setError(""); }}
                className="text-xs text-muted-foreground hover:text-primary"
              >
                ← Quay lại
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
