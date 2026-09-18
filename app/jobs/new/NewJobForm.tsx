"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createJobDescription } from "@/lib/jobs/actions";
import { draftJobDescription } from "@/lib/jobs/ai-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LEVELS,
  EXPERIENCE_LEVEL_LABELS,
} from "@/lib/jobs/job-fields";
import { JOB_CATEGORIES } from "@/lib/jobs/job-categories";

const selectClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export default function NewJobForm() {
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [rawText, setRawText] = useState("");
  const [skills, setSkills] = useState("");
  const [category, setCategory] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleDraft() {
    if (rawText.trim() && !window.confirm("Nội dung mô tả hiện có sẽ bị thay bằng bản AI soạn. Tiếp tục?"))
      return;
    startTransition(async () => {
      const r = await draftJobDescription({ title, brief });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setRawText(r.draft.rawText);
      setSkills(r.draft.skills);
      setCategory(r.draft.category ?? "");
      setEmploymentType(r.draft.employmentType ?? "");
      setExperienceLevel(r.draft.experienceLevel ?? "");
      toast.success("Đã soạn bản nháp, hãy kiểm tra và chỉnh sửa");
    });
  }

  return (
    <form action={createJobDescription} className="grid gap-3">
      <div><Label>Tiêu đề vị trí</Label>
        <Input name="title" placeholder="VD: Frontend Developer" required
          value={title} onChange={(e) => setTitle(e.target.value)} /></div>

      <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
        <Label>Soạn nhanh bằng AI</Label>
        <p className="mb-2 text-xs text-muted-foreground">
          Nhập vài gạch đầu dòng (kỹ năng, kinh nghiệm, đãi ngộ...), AI sẽ soạn mô tả đầy đủ.
        </p>
        <Textarea rows={3} placeholder="VD: React + TypeScript, 2 năm KN, làm việc Hà Nội, lương thỏa thuận"
          value={brief} onChange={(e) => setBrief(e.target.value)} />
        <Button type="button" variant="outline" size="sm" className="mt-2"
          onClick={handleDraft} disabled={isPending}>
          {isPending ? "Đang soạn..." : "Soạn bằng AI"}
        </Button>
      </div>

      <div><Label>Công ty</Label>
        <Input name="company" placeholder="VD: ACME" /></div>
      <div><Label>Địa điểm</Label>
        <Input name="location" placeholder="VD: Hà Nội, Remote" /></div>
      <div><Label>Loại hình làm việc</Label>
        <select name="employmentType" className={selectClass}
          value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
          <option value="">— Chọn —</option>
          {EMPLOYMENT_TYPES.map((t) => (
            <option key={t} value={t}>{EMPLOYMENT_TYPE_LABELS[t]}</option>
          ))}
        </select></div>
      <div><Label>Ngành nghề</Label>
        <select name="category" className={selectClass}
          value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">— Chọn —</option>
          {JOB_CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>{c.label}</option>
          ))}
        </select></div>
      <div><Label>Cấp bậc</Label>
        <select name="experienceLevel" className={selectClass}
          value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)}>
          <option value="">— Chọn —</option>
          {EXPERIENCE_LEVELS.map((l) => (
            <option key={l} value={l}>{EXPERIENCE_LEVEL_LABELS[l]}</option>
          ))}
        </select></div>
      <div><Label>Kỹ năng yêu cầu</Label>
        <Input name="skills" placeholder="VD: React, Node, SQL (cách nhau bởi phẩy)"
          value={skills} onChange={(e) => setSkills(e.target.value)} /></div>

      <div>
        <label className="mb-1 block text-sm font-medium text-foreground">Mức lương (triệu VND / tháng)</label>
        <div className="flex items-center gap-2">
          <Input name="salaryMin" type="number" min="0" step="0.5" placeholder="Từ" className="w-28" />
          <span className="text-muted-foreground">–</span>
          <Input name="salaryMax" type="number" min="0" step="0.5" placeholder="Đến" className="w-28" />
          <label className="ml-2 flex items-center gap-1 text-sm text-muted-foreground">
            <input type="checkbox" name="salaryNegotiable" value="1" /> Thỏa thuận
          </label>
        </div>
      </div>

      <div><Label>Mô tả công việc (JD)</Label>
        <Textarea name="rawText" rows={10} placeholder="Dán nội dung mô tả công việc..." required
          value={rawText} onChange={(e) => setRawText(e.target.value)} /></div>
      <Button type="submit" className="justify-self-start">Đăng tin</Button>
    </form>
  );
}
