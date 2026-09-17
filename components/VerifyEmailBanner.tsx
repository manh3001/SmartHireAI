"use client";

import { useState } from "react";
import { resendVerification } from "@/lib/auth/verify-actions";

export default function VerifyEmailBanner() {
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  async function onResend() {
    setSending(true);
    const r = await resendVerification();
    setSending(false);
    setMsg(r.ok ? "Đã gửi lại email xác minh (nếu email được cấu hình)." : r.error ?? "Có lỗi xảy ra");
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200">
      <span>Email của bạn chưa được xác minh. Một số thao tác (ứng tuyển, đăng tin) sẽ bị hạn chế.</span>
      <button
        onClick={onResend}
        disabled={sending}
        className="font-medium underline underline-offset-2 disabled:opacity-60"
      >
        {sending ? "Đang gửi..." : "Gửi lại email xác minh"}
      </button>
      {msg && <span className="text-amber-700 dark:text-amber-300">{msg}</span>}
    </div>
  );
}
