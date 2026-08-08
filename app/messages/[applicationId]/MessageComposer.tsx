"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendMessage } from "@/lib/messages/actions";

export default function MessageComposer({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function onSend() {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    const r = await sendMessage(applicationId, text);
    if (r.ok) {
      setBody("");
      router.refresh();
    } else {
      toast.error(r.error);
    }
    setSending(false);
  }

  return (
    <div className="mt-4 flex gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="Nhập tin nhắn..."
        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <Button onClick={onSend} disabled={sending || !body.trim()} className="self-end">
        {sending ? "Đang gửi..." : "Gửi"}
      </Button>
    </div>
  );
}
