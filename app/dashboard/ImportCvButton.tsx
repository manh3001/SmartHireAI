"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ImportCvButton() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/cv/import", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) {
        toast.success("Đã đọc CV, hãy kiểm tra lại");
        router.push(`/cv/${data.cvId}`);
      } else {
        toast.error(data.error ?? "Nhập PDF thất bại");
      }
    } catch {
      toast.error("Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={onFile}
      />
      <Button
        variant="outline"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mr-1 h-4 w-4" />
        {loading ? "Đang đọc PDF..." : "Nhập CV từ PDF"}
      </Button>
    </>
  );
}
