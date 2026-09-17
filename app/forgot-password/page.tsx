"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/auth/reset-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-bold text-foreground">Quên mật khẩu</h1>
        {state?.message ? (
          <p className="text-center text-sm text-muted-foreground">{state.message}</p>
        ) : (
          <form action={action} className="flex flex-col gap-3">
            <Input name="email" type="email" placeholder="Email" required />
            <Button type="submit" disabled={pending}>
              {pending ? "Đang gửi..." : "Gửi liên kết đặt lại"}
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">Về đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
