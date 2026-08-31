"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { addNote } from "@/lib/applications/notes";

type Note = { id: string; content: string; createdAt: Date | string };

export default function NotesPanel({
  applicationId,
  initialNotes,
}: {
  applicationId: string;
  initialNotes: Note[];
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const trimmed = content.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const r = await addNote(applicationId, trimmed);
      if (r.ok) {
        setNotes((prev) => [
          ...prev,
          {
            id: `tmp_${Date.now()}`,
            content: trimmed,
            createdAt: new Date(),
          },
        ]);
        setContent("");
      } else {
        toast.error(r.error ?? "Lưu ghi chú thất bại");
      }
    });
  }

  return (
    <Card className="mt-3">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground">Ghi chú nội bộ</CardTitle>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            Chỉ NTD thấy
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {notes.length > 0 && (
          <div className="space-y-2">
            {notes.map((n) => (
              <div
                key={n.id}
                className="rounded-md bg-muted/40 p-3 text-sm text-foreground"
              >
                <p className="mb-1 text-xs text-muted-foreground">
                  {new Date(n.createdAt).toLocaleDateString("vi-VN")}
                </p>
                <p className="whitespace-pre-wrap">{n.content}</p>
              </div>
            ))}
          </div>
        )}
        <Textarea
          placeholder="Thêm ghi chú..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={2000}
          rows={3}
          className="resize-none"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isPending || !content.trim()}
          >
            {isPending ? "Đang lưu..." : "Lưu ghi chú"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
