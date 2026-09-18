"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createJobDescription } from "@/lib/jobs/actions";
import { draftJobDescription } from "@/lib/jobs/ai-actions";
import { formatSalary, vndToMillions } from "@/lib/jobs/salary";
import { suggestSalary } from "@/lib/jobs/salary-suggest-actions";
import type { SalarySuggestion } from "@/lib/salary/suggestion";
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

const BASIS_LABEL: Record<SalarySuggestion["basis"], string> = {
  category_level: "theo ngành & cấp bậc",
  category: "theo ngành",
  level: "theo cấp bậc",
  overall: "toàn thị trường",
};

export default function NewJobForm() {
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [rawText, setRawText] = useState("");
  const [skills, setSkills] = useState("");
  const [category, setCategory] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [isPending, startTransition] = useTransition();
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [sug, setSug] = useState<{ suggestion: SalarySuggestion; note: string } | null>(null);
  const [sugPending, startSug] = useTransition();

  function handleSuggestSalary() {
    startSug(async () => {
      const r = await suggestSalary({ title, category, experienceLevel, skills });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setSug({ suggestion: r.suggestion, note: r.note });
    });
  }

  function applySuggestion() {
    if (!sug) return;
    if (sug.suggestion.medianMin != null) setSalaryMin(String(vndToMillions(sug.suggestion.medianMin)));
    if (sug.suggestion.medianMax != null) setSalaryMax(String(vndToMillions(sug.suggestion.medianMax)));
  }

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
          value={category} onChange={(e) => { setCategory(e.target.value); setSug(null); }}>
          <option value="">— Chọn —</option>
          {JOB_CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>{c.label}</option>
          ))}
        </select></div>
      <div><Label>Cấp bậc</Label>
        <select name="experienceLevel" className={selectClass}
          value={experienceLevel} onChange={(e) => { setExperienceLevel(e.target.value); setSug(null); }}>
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
          <Input name="salaryMin" type="number" min="0" step="0.5" placeholder="Từ" className="w-28"
            value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} />
          <span className="text-muted-foreground">–</span>
          <Input name="salaryMax" type="number" min="0" step="0.5" placeholder="Đến" className="w-28"
            value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} />
          <label className="ml-2 flex items-center gap-1 text-sm text-muted-foreground">
            <input type="checkbox" name="salaryNegotiable" value="1" /> Thỏa thuận
          </label>
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-2"
          onClick={handleSuggestSalary} disabled={sugPending || !category || !experienceLevel}>
          {sugPending ? "Đang tính..." : "Gợi ý lương (AI)"}
        </Button>
        {!category || !experienceLevel ? (
          <p className="mt-1 text-xs text-muted-foreground">Chọn ngành và cấp bậc để được gợi ý.</p>
        ) : null}
        {sug ? (
          <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            <p className="font-medium text-foreground">
              {formatSalary(sug.suggestion.medianMin, sug.suggestion.medianMax, false) ?? "Chưa xác định"}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {BASIS_LABEL[sug.suggestion.basis]} · {sug.suggestion.sampleSize} tin
                {sug.suggestion.sampleSize < 3 ? " · ít dữ liệu" : ""}
              </span>
            </p>
            {sug.note ? <p className="mt-1 text-muted-foreground">{sug.note}</p> : null}
            <Button type="button" size="sm" className="mt-2" onClick={applySuggestion}>Áp dụng</Button>
          </div>
        ) : null}
      </div>

      <div><Label>Mô tả công việc (JD)</Label>
        <Textarea name="rawText" rows={10} placeholder="Dán nội dung mô tả công việc..." required
          value={rawText} onChange={(e) => setRawText(e.target.value)} /></div>
      <Button type="submit" className="justify-self-start">Đăng tin</Button>
    </form>
  );
}
