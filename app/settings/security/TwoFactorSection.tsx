"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  beginTotpEnrollment,
  confirmTotpEnrollment,
  disableTwoFactor,
  regenerateBackupCodes,
} from "@/lib/auth/twofactor-actions";

export default function TwoFactorSection({
  enabled,
  remainingBackup,
}: {
  enabled: boolean;
  remainingBackup: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [disableCode, setDisableCode] = useState("");

  function begin() {
    startTransition(async () => {
      const r = await beginTotpEnrollment();
      if (r.ok) { setQr(r.qrDataUrl); setSecret(r.secret); }
      else toast.error(r.error);
    });
  }
  function confirm() {
    startTransition(async () => {
      const r = await confirmTotpEnrollment(code);
      if (r.ok) { setBackupCodes(r.backupCodes); setQr(null); setCode(""); toast.success("Đã bật 2FA"); }
      else toast.error(r.error);
    });
  }
  function disable() {
    startTransition(async () => {
      const r = await disableTwoFactor(disableCode);
      if (r.ok) { setDisabling(false); setDisableCode(""); toast.success("Đã tắt 2FA"); location.reload(); }
      else toast.error(r.error ?? "Không thể tắt 2FA");
    });
  }
  function regen() {
    startTransition(async () => {
      const r = await regenerateBackupCodes(disableCode || code);
      if (r.ok) { setBackupCodes(r.backupCodes); toast.success("Đã tạo lại mã dự phòng"); }
      else toast.error(r.error);
    });
  }

  if (backupCodes) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-2 text-sm font-medium text-foreground">Mã dự phòng (lưu lại ngay — chỉ hiện một lần):</p>
        <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
          {backupCodes.map((c) => <li key={c} className="rounded bg-muted px-2 py-1">{c}</li>)}
        </ul>
        <Button className="mt-4" size="sm" onClick={() => location.reload()}>Xong</Button>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        {!qr ? (
          <Button size="sm" onClick={begin} disabled={isPending}>Bật 2FA</Button>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Quét QR bằng app xác thực (hoặc nhập khoá thủ công):</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR 2FA" width={180} height={180} className="rounded bg-white p-2" />
            <code className="break-all rounded bg-muted px-2 py-1 text-xs">{secret}</code>
            <Input placeholder="Nhập mã 6 số để xác nhận" value={code} onChange={(e) => setCode(e.target.value)} />
            <Button size="sm" onClick={confirm} disabled={isPending}>Xác nhận & bật</Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-1 text-sm font-medium text-emerald-600">Đang bật</p>
      <p className="mb-4 text-sm text-muted-foreground">Còn {remainingBackup} mã dự phòng.</p>
      <div className="flex flex-col gap-3">
        <Input placeholder="Nhập mã (TOTP hoặc dự phòng)" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={regen} disabled={isPending}>Tạo lại mã dự phòng</Button>
          <Button variant="destructive" size="sm" onClick={disable} disabled={isPending}>Tắt 2FA</Button>
        </div>
      </div>
    </div>
  );
}

