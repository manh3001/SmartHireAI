"use client";

import { use } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { confirmPasswordReset } from "@/lib/auth/reset-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = use(searchParams);
  const [state, action, pending] = useActionState(confirmPasswordReset, null);

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-bold text-foreground">Đặt lại mật khẩu</h1>
        {state?.ok ? (
          <p className="text-center text-sm text-muted-foreground">{state.message}</p>
        ) : (
          <form action={action} className="flex flex-col gap-3">
            <input type="hidden" name="token" value={token ?? ""} />
            <Input name="password" type="password" placeholder="Mật khẩu mới" required />
            {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
            <Button type="submit" disabled={pending}>
              {pending ? "Đang lưu..." : "Đặt lại mật khẩu"}
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
