"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { saveCv } from "@/lib/cv/actions";
import type { CvInput } from "@/lib/cv/types";
import { CV_TEMPLATES, type CvTemplate } from "@/lib/cv/templates";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CvPreview from "@/components/cv/CvPreview";

export default function CvEditor({
  cvId,
  initial,
  initialTemplate,
}: {
  cvId: string;
  initial: CvInput;
  initialTemplate: CvTemplate;
}) {
  const [cv, setCv] = useState<CvInput>(initial);
  const [template, setTemplate] = useState<CvTemplate>(initialTemplate);
  const [pending, startTransition] = useTransition();
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");

  function setProfile<K extends keyof CvInput["profile"]>(
    key: K,
    value: string,
  ) {
    setCv((c) => ({ ...c, profile: { ...c.profile, [key]: value } }));
  }

  function addRow<T>(key: keyof CvInput, empty: T) {
    setCv((c) => ({ ...c, [key]: [...(c[key] as T[]), empty] }));
  }
  function removeRow(key: keyof CvInput, idx: number) {
    setCv((c) => ({
      ...c,
      [key]: (c[key] as unknown[]).filter((_, i) => i !== idx),
    }));
  }
  function setRow<T>(key: keyof CvInput, idx: number, field: keyof T, value: string) {
    setCv((c) => ({
      ...c,
      [key]: (c[key] as T[]).map((row, i) =>
        i === idx ? { ...row, [field]: value } : row,
      ),
    }));
  }

  function onSave() {
    startTransition(async () => {
      const res = await saveCv(cvId, cv, template);
      if (res.ok) toast.success("Đã lưu CV");
      else toast.error(res.error ?? "Lưu thất bại");
    });
  }

  return (
    <main className="min-h-full bg-muted/20">
      {/* Thanh hành động dính */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5">
          <Link href="/dashboard" className="text-sm text-primary hover:underline">← Về dashboard</Link>
          <div className="flex flex-wrap gap-2">
            <Link href={`/cv/${cvId}/chat`} className={buttonVariants({ variant: "outline", size: "sm" })}>Chat tư vấn</Link>
            <Link href={`/cv/${cvId}/evaluate`} className={buttonVariants({ variant: "outline", size: "sm" })}>Đánh giá theo JD</Link>
            <a href={`/api/cv/${cvId}/pdf`} className={buttonVariants({ variant: "outline", size: "sm" })}>Xuất PDF</a>
            <Button size="sm" onClick={onSave} disabled={pending}>{pending ? "Đang lưu..." : "Lưu"}</Button>
          </div>
        </div>
      </div>

      {/* Bộ chọn mẫu CV */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 pt-3">
        <span className="text-sm text-muted-foreground">Mẫu CV:</span>
        {CV_TEMPLATES.map((t) => (
          <Button
            key={t.id}
            type="button"
            size="sm"
            variant={template === t.id ? "default" : "outline"}
            onClick={() => setTemplate(t.id)}
            title={t.description}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {/* Tab chỉ hiện trên mobile */}
      <div className="mx-auto flex max-w-6xl gap-2 px-4 pt-4 lg:hidden">
        <Button variant={mobileTab === "edit" ? "default" : "outline"} size="sm" onClick={() => setMobileTab("edit")}>Chỉnh sửa</Button>
        <Button variant={mobileTab === "preview" ? "default" : "outline"} size="sm" onClick={() => setMobileTab("preview")}>Xem trước</Button>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 p-4 lg:grid-cols-2 lg:p-6">
        {/* Cột trái: form (ẩn trên mobile khi đang xem preview) */}
        <div className={mobileTab === "preview" ? "hidden lg:block" : "block"}>
          <Input
            className="mb-4 text-lg font-semibold"
            value={cv.title}
            onChange={(e) => setCv((c) => ({ ...c, title: e.target.value }))}
            placeholder="Tên CV"
          />

          {/* Profile */}
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-foreground">Thông tin cá nhân</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <div><Label>Họ tên</Label>
                <Input value={cv.profile.fullName} onChange={(e) => setProfile("fullName", e.target.value)} /></div>
              <div><Label>Chức danh</Label>
                <Input value={cv.profile.headline} onChange={(e) => setProfile("headline", e.target.value)} /></div>
              <div><Label>Email</Label>
                <Input value={cv.profile.email} onChange={(e) => setProfile("email", e.target.value)} /></div>
              <div><Label>Điện thoại</Label>
                <Input value={cv.profile.phone} onChange={(e) => setProfile("phone", e.target.value)} /></div>
              <div><Label>Giới thiệu bản thân</Label>
                <Textarea value={cv.profile.summary} onChange={(e) => setProfile("summary", e.target.value)} /></div>
            </CardContent>
          </Card>

          {/* Experiences */}
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-foreground">Kinh nghiệm làm việc</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              {cv.experiences.map((e, i) => (
                <div key={i} className="grid gap-2 border-b pb-3 last:border-0">
                  <Input placeholder="Công ty" value={e.company}
                    onChange={(ev) => setRow<CvInput["experiences"][number]>("experiences", i, "company", ev.target.value)} />
                  <Input placeholder="Vị trí" value={e.position}
                    onChange={(ev) => setRow<CvInput["experiences"][number]>("experiences", i, "position", ev.target.value)} />
                  <div className="flex gap-2">
                    <Input placeholder="Từ (2023-01)" value={e.startDate}
                      onChange={(ev) => setRow<CvInput["experiences"][number]>("experiences", i, "startDate", ev.target.value)} />
                    <Input placeholder="Đến (2024-06)" value={e.endDate}
                      onChange={(ev) => setRow<CvInput["experiences"][number]>("experiences", i, "endDate", ev.target.value)} />
                  </div>
                  <Textarea placeholder="Mô tả công việc" value={e.description}
                    onChange={(ev) => setRow<CvInput["experiences"][number]>("experiences", i, "description", ev.target.value)} />
                  <Button variant="ghost" size="sm" className="justify-self-start"
                    onClick={() => removeRow("experiences", i)}>Xóa</Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="justify-self-start"
                onClick={() => addRow("experiences", { company: "", position: "", startDate: "", endDate: "", description: "" })}>
                + Thêm kinh nghiệm
              </Button>
            </CardContent>
          </Card>

          {/* Educations */}
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-foreground">Học vấn</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              {cv.educations.map((e, i) => (
                <div key={i} className="grid gap-2 border-b pb-3 last:border-0">
                  <Input placeholder="Trường" value={e.school}
                    onChange={(ev) => setRow<CvInput["educations"][number]>("educations", i, "school", ev.target.value)} />
                  <Input placeholder="Ngành" value={e.major}
                    onChange={(ev) => setRow<CvInput["educations"][number]>("educations", i, "major", ev.target.value)} />
                  <div className="flex gap-2">
                    <Input placeholder="Từ" value={e.startDate}
                      onChange={(ev) => setRow<CvInput["educations"][number]>("educations", i, "startDate", ev.target.value)} />
                    <Input placeholder="Đến" value={e.endDate}
                      onChange={(ev) => setRow<CvInput["educations"][number]>("educations", i, "endDate", ev.target.value)} />
                  </div>
                  <Button variant="ghost" size="sm" className="justify-self-start"
                    onClick={() => removeRow("educations", i)}>Xóa</Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="justify-self-start"
                onClick={() => addRow("educations", { school: "", major: "", startDate: "", endDate: "" })}>
                + Thêm học vấn
              </Button>
            </CardContent>
          </Card>

          {/* Skills */}
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-foreground">Kỹ năng</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              {cv.skills.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Input placeholder="Tên kỹ năng" value={s.name}
                    onChange={(ev) => setRow<CvInput["skills"][number]>("skills", i, "name", ev.target.value)} />
                  <Input placeholder="Mức độ" value={s.level}
                    onChange={(ev) => setRow<CvInput["skills"][number]>("skills", i, "level", ev.target.value)} />
                  <Button variant="ghost" size="sm" onClick={() => removeRow("skills", i)}>Xóa</Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="justify-self-start"
                onClick={() => addRow("skills", { name: "", level: "" })}>
                + Thêm kỹ năng
              </Button>
            </CardContent>
          </Card>

          {/* Projects */}
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-foreground">Dự án</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              {cv.projects.map((p, i) => (
                <div key={i} className="grid gap-2 border-b pb-3 last:border-0">
                  <Input placeholder="Tên dự án" value={p.name}
                    onChange={(ev) => setRow<CvInput["projects"][number]>("projects", i, "name", ev.target.value)} />
                  <Textarea placeholder="Mô tả" value={p.description}
                    onChange={(ev) => setRow<CvInput["projects"][number]>("projects", i, "description", ev.target.value)} />
                  <Input placeholder="Công nghệ (React, Node...)" value={p.tech}
                    onChange={(ev) => setRow<CvInput["projects"][number]>("projects", i, "tech", ev.target.value)} />
                  <Input placeholder="Link" value={p.link}
                    onChange={(ev) => setRow<CvInput["projects"][number]>("projects", i, "link", ev.target.value)} />
                  <Button variant="ghost" size="sm" className="justify-self-start"
                    onClick={() => removeRow("projects", i)}>Xóa</Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="justify-self-start"
                onClick={() => addRow("projects", { name: "", description: "", tech: "", link: "" })}>
                + Thêm dự án
              </Button>
            </CardContent>
          </Card>
        </div>{/* hết cột trái */}

        {/* Cột phải: xem trước sống */}
        <div className={mobileTab === "edit" ? "hidden lg:block" : "block"}>
          <div className="lg:sticky lg:top-20">
            <CvPreview cv={cv} template={template} />
          </div>
        </div>
      </div>
    </main>
  );
}
