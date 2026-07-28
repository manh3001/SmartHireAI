"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { saveCv } from "@/lib/cv/actions";
import type { CvInput } from "@/lib/cv/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CvEditor({
  cvId,
  initial,
}: {
  cvId: string;
  initial: CvInput;
}) {
  const [cv, setCv] = useState<CvInput>(initial);
  const [pending, startTransition] = useTransition();

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
      const res = await saveCv(cvId, cv);
      if (res.ok) toast.success("Đã lưu CV");
      else toast.error(res.error ?? "Lưu thất bại");
    });
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm underline">← Về dashboard</Link>
        <div className="flex gap-2">
          <a href={`/cv/${cvId}/evaluate`}>
            <Button variant="outline">Đánh giá theo JD</Button>
          </a>
          <a href={`/api/cv/${cvId}/pdf`}>
            <Button variant="outline">Xuất PDF</Button>
          </a>
          <Button onClick={onSave} disabled={pending}>
            {pending ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </div>

      <Input
        className="mb-4 text-lg font-semibold"
        value={cv.title}
        onChange={(e) => setCv((c) => ({ ...c, title: e.target.value }))}
        placeholder="Tên CV"
      />

      {/* Profile */}
      <Card className="mb-4">
        <CardHeader><CardTitle>Thông tin cá nhân</CardTitle></CardHeader>
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
        <CardHeader><CardTitle>Kinh nghiệm làm việc</CardTitle></CardHeader>
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
        <CardHeader><CardTitle>Học vấn</CardTitle></CardHeader>
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
        <CardHeader><CardTitle>Kỹ năng</CardTitle></CardHeader>
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
        <CardHeader><CardTitle>Dự án</CardTitle></CardHeader>
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
    </main>
  );
}
