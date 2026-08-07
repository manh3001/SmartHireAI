"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ChatMsg = { id: string; role: "user" | "assistant"; content: string };

export default function ChatClient({
  cvId,
  cvTitle,
  initial,
}: {
  cvId: string;
  cvTitle: string;
  initial: ChatMsg[];
}) {
  const [messages, setMessages] = useState<ChatMsg[]>(initial);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setLoading(true);

    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: "user", content: text };
    const botMsg: ChatMsg = { id: `a-${Date.now()}`, role: "assistant", content: "" };
    setMessages((m) => [...m, userMsg, botMsg]);
    scrollToBottom();

    try {
      const res = await fetch(`/api/cv/${cvId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok || !res.body) {
        const errText = await res.text();
        toast.error(errText || "Gửi thất bại");
        setMessages((m) => m.filter((x) => x.id !== botMsg.id));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) =>
          m.map((x) => (x.id === botMsg.id ? { ...x, content: x.content + chunk } : x)),
        );
        scrollToBottom();
      }
    } catch {
      toast.error("Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-1px)] max-w-3xl flex-col bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between">
        <Link href={`/cv/${cvId}`} className="text-sm text-primary hover:underline">← Về CV</Link>
        <h1 className="text-lg font-semibold text-foreground">Tư vấn: {cvTitle}</h1>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-border bg-card p-4">
        {messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            Hãy hỏi bất cứ điều gì về CV hoặc định hướng nghề nghiệp của bạn.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[80%] whitespace-pre-wrap rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground"
                  : "max-w-[80%] whitespace-pre-wrap rounded-2xl border border-border bg-background px-4 py-2 text-sm text-foreground"
              }
            >
              {m.content || (m.role === "assistant" && loading ? "..." : "")}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={onSend} className="mt-3 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nhập câu hỏi..."
          disabled={loading}
        />
        <Button type="submit" disabled={loading || !input.trim()}>
          {loading ? "..." : "Gửi"}
        </Button>
      </form>
    </main>
  );
}
