"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import CompanyAvatar from "@/components/CompanyAvatar";
import type { CandidateCard } from "@/lib/candidates/search";

const EXP_OPTIONS = [
  { value: "", label: "Tất cả kinh nghiệm" },
  { value: "0", label: "Chưa có kinh nghiệm" },
  { value: "1", label: "1–2 năm" },
  { value: "3", label: "3–5 năm" },
  { value: "5", label: "5+ năm" },
];

export default function CandidateSearch({
  initialCandidates,
  initialQ,
  initialExp,
}: {
  initialCandidates: CandidateCard[];
  initialQ: string;
  initialExp: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [exp, setExp] = useState(initialExp);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (exp) params.set("exp", exp);
    const qs = params.toString();
    router.push(qs ? `/candidates?${qs}` : "/candidates");
  }

  return (
    <div className="mt-4">
      <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
        <Input
          placeholder="React, Node.js, Hà Nội..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
        <select
          value={exp}
          onChange={(e) => setExp(e.target.value)}
          className="rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {EXP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm">
          Tìm
        </Button>
      </form>

      {initialCandidates.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<Users className="h-10 w-10" />}
            title="Không tìm thấy ứng viên"
            description="Chưa có ứng viên nào chia sẻ CV công khai hoặc không khớp bộ lọc."
          />
        </div>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted-foreground">
            Hiển thị {initialCandidates.length} ứng viên
          </p>
          <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {initialCandidates.map((c) => (
              <div
                key={c.cvId}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-center gap-3">
                  <CompanyAvatar name={c.fullName || "?"} className="h-10 w-10 text-sm" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {c.fullName || "(Chưa đặt tên)"}
                    </p>
                    {c.headline && (
                      <p className="truncate text-xs text-muted-foreground">
                        {c.headline}
                      </p>
                    )}
                  </div>
                </div>
                {c.location && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <MapPin className="mr-0.5 inline h-3 w-3" />{c.location}
                  </p>
                )}
                {c.skills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.skills.map((s) => (
                      <Badge key={s} variant="skill" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
                <Link
                  href={`/cv/share/${c.shareToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-xs text-primary hover:underline"
                >
                  Xem CV →
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
