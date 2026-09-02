"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Star, Share2, MoreVertical, Check, Copy } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { renameCv, setDefaultCv, deleteCv, enableShare, disableShare } from "@/lib/cv/actions";

type CvCardProps = {
  id: string;
  title: string;
  template: string;
  updatedAt: Date;
  isDefault: boolean;
  shareToken: string | null;
};

export default function CvCard({ id, title, template, updatedAt, isDefault, shareToken }: CvCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(title);
  const [token, setToken] = useState<string | null>(shareToken);
  const [copied, setCopied] = useState(false);

  const shareUrl = token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/cv/share/${token}`
    : null;

  function copyShareUrl() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleRename() {
    if (!editing) { setEditing(true); return; }
    startTransition(async () => {
      const r = await renameCv(id, nameValue);
      if (r.ok) { setEditing(false); toast.success("Đã đổi tên CV"); router.refresh(); }
      else toast.error(r.error);
    });
  }

  function handleSetDefault() {
    startTransition(async () => {
      const r = await setDefaultCv(id);
      if (!r.ok) toast.error(r.error);
      else { toast.success("Đã đặt làm CV mặc định"); router.refresh(); }
    });
  }

  function handleToggleShare() {
    startTransition(async () => {
      if (token) {
        const r = await disableShare(id);
        if (r.ok) { setToken(null); toast.success("Đã tắt chia sẻ"); }
        else toast.error(r.error);
      } else {
        const r = await enableShare(id);
        if (r.ok && r.token) { setToken(r.token); toast.success("Đã bật chia sẻ"); }
        else toast.error(r.error);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("id", id);
      const r = await deleteCv(fd);
      if (r.ok) {
        toast.success("Đã xóa CV");
        router.refresh();
      } else {
        toast.error(r.error ?? "Xóa thất bại");
      }
    });
  }

  return (
    <Card className="border-border transition-colors hover:border-primary/40">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/cv/${id}`} className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              {editing ? (
                <input
                  autoFocus
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleRename(); } if (e.key === "Escape") setEditing(false); }}
                  onClick={(e) => e.preventDefault()}
                  className="block w-full rounded border border-input bg-background px-2 py-0.5 text-sm font-medium text-foreground"
                />
              ) : (
                <span className="block truncate font-medium text-foreground hover:text-primary">
                  {nameValue}
                </span>
              )}
              <span className="block text-xs text-muted-foreground">
                {template} · Sửa {new Date(updatedAt).toLocaleDateString("vi-VN")}
              </span>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-1">
            {isDefault && (
              <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <Star className="h-3 w-3" /> Mặc định
              </span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}
                disabled={pending}
                aria-label="Tùy chọn CV"
              >
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleRename}>
                  {editing ? "Lưu tên" : "Đổi tên"}
                </DropdownMenuItem>
                {!isDefault && (
                  <DropdownMenuItem onClick={handleSetDefault}>
                    Đặt làm mặc định
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleToggleShare}>
                  {token ? "Tắt chia sẻ" : "Bật chia sẻ"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  Xóa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Share URL row */}
        {token && shareUrl && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
            <Share2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{shareUrl}</span>
            <button
              onClick={copyShareUrl}
              aria-label={copied ? "Đã sao chép" : "Sao chép link"}
              className="shrink-0 text-primary hover:text-primary/80"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
