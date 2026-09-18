# Trợ lý viết JD bằng AI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recruiter nhập tiêu đề + mô tả ngắn trên `/jobs/new` → AI (Gemini) soạn bản nháp JD có cấu trúc → tự điền vào các trường form để chỉnh sửa rồi đăng.

**Architecture:** Theo đúng pattern AI sẵn có: prompt thuần + Zod schema + request wrapper (`chat.completions.parse` + `zodResponseFormat`). Một helper thuần ánh xạ draft→giá trị form. Server action `draftJobDescription` (requireRole RECRUITER + rate-limit `ai`) gọi AI. Form `/jobs/new` tách thành client component để điền được các trường.

**Tech Stack:** Next.js 16 (App Router), Gemini 2.5 Flash qua OpenAI-compat SDK, Zod 4, vitest 4, TypeScript.

## Global Constraints

- Không thêm dependency mới (dùng `openai` + Gemini sẵn có; `GEMINI_API_KEY` đã có).
- AI request theo pattern `lib/ai/request-recommendations.ts` (system + user message, `zodResponseFormat`).
- Logic thuần (prompt builder, schema, map) không import prisma/openai-client — test bằng vitest.
- prisma/client import theo alias `@/...`.
- Copy tiếng Việt cho mọi text/lỗi hiển thị.
- Server action AI: `requireRole("RECRUITER")` + rate-limit scope `ai`; draft KHÔNG tạo dữ liệu nên không gate xác minh email (việc đăng tin thật `createJobDescription` vẫn giữ gate Vòng 1).
- Kết thúc mỗi task: `npx tsc --noEmit` 0 + test liên quan xanh. Cuối: tsc + lint + `npm test` + `npm run build` sạch.
- Commit message tiếng Việt, prefix `feat(ai):` / `test(ai):`.

---

### Task 1: Zod schema (`lib/ai/jd-draft-schema.ts`)

**Files:**
- Create: `lib/ai/jd-draft-schema.ts`
- Test: `lib/ai/__tests__/jd-draft-schema.test.ts`

**Interfaces:**
- Produces: `jdDraftSchema` (Zod), `type JdDraft = { description: string; skills: string[]; employmentType: EmploymentType | null; experienceLevel: ExperienceLevel | null; categorySlug: string | null }`.

- [ ] **Step 1: Viết test thất bại**

Tạo `lib/ai/__tests__/jd-draft-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { jdDraftSchema } from "../jd-draft-schema";

describe("jdDraftSchema", () => {
  it("parse object hợp lệ", () => {
    const r = jdDraftSchema.parse({
      description: "Mô tả...",
      skills: ["React", "Node"],
      employmentType: "FULL_TIME",
      experienceLevel: "JUNIOR",
      categorySlug: "it",
    });
    expect(r.skills).toEqual(["React", "Node"]);
    expect(r.employmentType).toBe("FULL_TIME");
  });
  it("chấp nhận enum null", () => {
    const r = jdDraftSchema.parse({
      description: "x",
      skills: [],
      employmentType: null,
      experienceLevel: null,
      categorySlug: null,
    });
    expect(r.employmentType).toBeNull();
    expect(r.categorySlug).toBeNull();
  });
  it("từ chối employmentType không hợp lệ", () => {
    expect(() =>
      jdDraftSchema.parse({
        description: "x", skills: [], employmentType: "WEEKEND",
        experienceLevel: null, categorySlug: null,
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `npx vitest run lib/ai/__tests__/jd-draft-schema.test.ts`
Expected: FAIL ("Cannot find module '../jd-draft-schema'").

- [ ] **Step 3: Viết implementation**

Tạo `lib/ai/jd-draft-schema.ts`:

```ts
import { z } from "zod";
import { EMPLOYMENT_TYPES, EXPERIENCE_LEVELS } from "@/lib/jobs/job-fields";

export const jdDraftSchema = z.object({
  description: z.string(),
  skills: z.array(z.string()),
  employmentType: z.enum(EMPLOYMENT_TYPES).nullable(),
  experienceLevel: z.enum(EXPERIENCE_LEVELS).nullable(),
  categorySlug: z.string().nullable(),
});

export type JdDraft = z.infer<typeof jdDraftSchema>;
```

- [ ] **Step 4: Chạy test — phải PASS**

Run: `npx vitest run lib/ai/__tests__/jd-draft-schema.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/jd-draft-schema.ts lib/ai/__tests__/jd-draft-schema.test.ts
git commit -m "feat(ai): Zod schema bản nháp JD"
```

---

### Task 2: Prompt (`lib/ai/jd-draft-prompt.ts`)

**Files:**
- Create: `lib/ai/jd-draft-prompt.ts`
- Test: `lib/ai/__tests__/jd-draft-prompt.test.ts`

**Interfaces:**
- Produces: `JD_DRAFT_SYSTEM_PROMPT: string`, `buildJdDraftPrompt(input: { title: string; brief: string }): string`.

- [ ] **Step 1: Viết test thất bại**

Tạo `lib/ai/__tests__/jd-draft-prompt.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildJdDraftPrompt, JD_DRAFT_SYSTEM_PROMPT } from "../jd-draft-prompt";

describe("buildJdDraftPrompt", () => {
  const p = buildJdDraftPrompt({ title: "Frontend Developer", brief: "React, 2 năm KN, Hà Nội" });
  it("chứa tiêu đề và brief", () => {
    expect(p).toContain("Frontend Developer");
    expect(p).toContain("React, 2 năm KN, Hà Nội");
  });
  it("liệt kê các giá trị hợp lệ cho AI chọn", () => {
    expect(p).toContain("FULL_TIME");
    expect(p).toContain("INTERN");
    expect(p).toContain("it"); // category slug
  });
  it("system prompt yêu cầu tiếng Việt", () => {
    expect(JD_DRAFT_SYSTEM_PROMPT.toLowerCase()).toContain("tiếng việt");
  });
});
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `npx vitest run lib/ai/__tests__/jd-draft-prompt.test.ts`
Expected: FAIL ("Cannot find module '../jd-draft-prompt'").

- [ ] **Step 3: Viết implementation**

Tạo `lib/ai/jd-draft-prompt.ts`:

```ts
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LEVELS,
  EXPERIENCE_LEVEL_LABELS,
} from "@/lib/jobs/job-fields";
import { JOB_CATEGORIES } from "@/lib/jobs/job-categories";

export const JD_DRAFT_SYSTEM_PROMPT = `Bạn là chuyên gia tuyển dụng. \
Nhiệm vụ: từ tiêu đề vị trí và vài gạch đầu dòng của nhà tuyển dụng, soạn một mô tả công việc (JD) tiếng Việt \
chuyên nghiệp, rõ ràng, có các mục: Mô tả chung, Trách nhiệm chính, Yêu cầu, Quyền lợi. \
Chọn "employmentType", "experienceLevel", "categorySlug" từ danh sách hợp lệ được cung cấp; nếu không chắc thì để null. \
"skills" là danh sách ngắn gọn các kỹ năng chính. \
Trả lời hoàn toàn bằng tiếng Việt, đúng cấu trúc JSON được yêu cầu.`;

export function buildJdDraftPrompt(input: { title: string; brief: string }): string {
  const emp = EMPLOYMENT_TYPES.map((t) => `${t} (${EMPLOYMENT_TYPE_LABELS[t]})`).join(", ");
  const exp = EXPERIENCE_LEVELS.map((l) => `${l} (${EXPERIENCE_LEVEL_LABELS[l]})`).join(", ");
  const cats = JOB_CATEGORIES.map((c) => `${c.slug} (${c.label})`).join(", ");
  return [
    `Tiêu đề vị trí: ${input.title}`,
    `Mô tả ngắn / gạch đầu dòng từ nhà tuyển dụng:`,
    input.brief,
    ``,
    `employmentType hợp lệ: ${emp}`,
    `experienceLevel hợp lệ: ${exp}`,
    `categorySlug hợp lệ: ${cats}`,
    `Hãy soạn nội dung đầy đủ cho "description" và chọn skills/employmentType/experienceLevel/categorySlug phù hợp.`,
  ].join("\n");
}
```

- [ ] **Step 4: Chạy test — phải PASS**

Run: `npx vitest run lib/ai/__tests__/jd-draft-prompt.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/jd-draft-prompt.ts lib/ai/__tests__/jd-draft-prompt.test.ts
git commit -m "feat(ai): prompt soạn JD (kèm danh sách giá trị hợp lệ)"
```

---

### Task 3: Ánh xạ draft → form (`lib/jobs/jd-draft-map.ts`)

**Files:**
- Create: `lib/jobs/jd-draft-map.ts`
- Test: `lib/jobs/__tests__/jd-draft-map.test.ts`

**Interfaces:**
- Consumes: `JdDraft` (Task 1); `normalizeCategory` (`@/lib/jobs/job-categories`); `EMPLOYMENT_TYPES`/`EXPERIENCE_LEVELS`.
- Produces: `type JdFormValues = { rawText: string; skills: string; category: string | null; employmentType: string | null; experienceLevel: string | null }`; `mapDraftToForm(draft: JdDraft): JdFormValues`.

- [ ] **Step 1: Viết test thất bại**

Tạo `lib/jobs/__tests__/jd-draft-map.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapDraftToForm } from "../jd-draft-map";

describe("mapDraftToForm", () => {
  it("map cơ bản: skills join, rawText = description", () => {
    const r = mapDraftToForm({
      description: "Nội dung JD",
      skills: ["React", "Node"],
      employmentType: "FULL_TIME",
      experienceLevel: "JUNIOR",
      categorySlug: "it",
    });
    expect(r.rawText).toBe("Nội dung JD");
    expect(r.skills).toBe("React, Node");
    expect(r.category).toBe("it");
    expect(r.employmentType).toBe("FULL_TIME");
    expect(r.experienceLevel).toBe("JUNIOR");
  });
  it("categorySlug không hợp lệ -> null", () => {
    const r = mapDraftToForm({
      description: "x", skills: [], employmentType: null,
      experienceLevel: null, categorySlug: "khong-ton-tai",
    });
    expect(r.category).toBeNull();
    expect(r.skills).toBe("");
  });
});
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `npx vitest run lib/jobs/__tests__/jd-draft-map.test.ts`
Expected: FAIL ("Cannot find module '../jd-draft-map'").

- [ ] **Step 3: Viết implementation**

Tạo `lib/jobs/jd-draft-map.ts`:

```ts
import type { JdDraft } from "@/lib/ai/jd-draft-schema";
import { EMPLOYMENT_TYPES, EXPERIENCE_LEVELS } from "@/lib/jobs/job-fields";
import { normalizeCategory } from "@/lib/jobs/job-categories";

export type JdFormValues = {
  rawText: string;
  skills: string;
  category: string | null;
  employmentType: string | null;
  experienceLevel: string | null;
};

export function mapDraftToForm(draft: JdDraft): JdFormValues {
  const emp =
    draft.employmentType && (EMPLOYMENT_TYPES as readonly string[]).includes(draft.employmentType)
      ? draft.employmentType
      : null;
  const exp =
    draft.experienceLevel && (EXPERIENCE_LEVELS as readonly string[]).includes(draft.experienceLevel)
      ? draft.experienceLevel
      : null;
  return {
    rawText: draft.description,
    skills: draft.skills.join(", "),
    category: normalizeCategory(draft.categorySlug),
    employmentType: emp,
    experienceLevel: exp,
  };
}
```

- [ ] **Step 4: Chạy test — phải PASS**

Run: `npx vitest run lib/jobs/__tests__/jd-draft-map.test.ts`
Expected: PASS (2 test).

- [ ] **Step 5: Commit**

```bash
git add lib/jobs/jd-draft-map.ts lib/jobs/__tests__/jd-draft-map.test.ts
git commit -m "feat(ai): ánh xạ bản nháp JD sang giá trị form"
```

---

### Task 4: Request wrapper + server action

**Files:**
- Create: `lib/ai/request-jd-draft.ts`
- Create: `lib/jobs/ai-actions.ts`

**Interfaces:**
- Consumes: `getAiClient`/`AI_MODEL` (`@/lib/ai/client`), `JD_DRAFT_SYSTEM_PROMPT`/`buildJdDraftPrompt` (Task 2), `jdDraftSchema`/`JdDraft` (Task 1), `mapDraftToForm`/`JdFormValues` (Task 3), `requireRole` (`@/lib/auth/session`), `checkRateLimit` (`@/lib/security/ratelimit`).
- Produces: `requestJdDraft(prompt: string): Promise<JdDraft>`; `draftJobDescription(input: { title: string; brief: string }): Promise<{ ok: true; draft: JdFormValues } | { ok: false; error: string }>`.

- [ ] **Step 1: Viết request wrapper**

Tạo `lib/ai/request-jd-draft.ts` (mirror `lib/ai/request-recommendations.ts`):

```ts
import { zodResponseFormat } from "openai/helpers/zod";
import { getAiClient, AI_MODEL } from "./client";
import { JD_DRAFT_SYSTEM_PROMPT } from "./jd-draft-prompt";
import { jdDraftSchema, type JdDraft } from "./jd-draft-schema";

export async function requestJdDraft(prompt: string): Promise<JdDraft> {
  const client = getAiClient();
  const completion = await client.chat.completions.parse({
    model: AI_MODEL,
    messages: [
      { role: "system", content: JD_DRAFT_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: zodResponseFormat(jdDraftSchema, "jd_draft"),
  });
  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    throw new Error("Model không trả về kết quả hợp lệ");
  }
  return parsed;
}
```

- [ ] **Step 2: Viết server action**

Tạo `lib/jobs/ai-actions.ts`:

```ts
"use server";

import { requireRole } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/security/ratelimit";
import { buildJdDraftPrompt } from "@/lib/ai/jd-draft-prompt";
import { requestJdDraft } from "@/lib/ai/request-jd-draft";
import { mapDraftToForm, type JdFormValues } from "./jd-draft-map";

export async function draftJobDescription(
  input: { title: string; brief: string },
): Promise<{ ok: true; draft: JdFormValues } | { ok: false; error: string }> {
  const session = await requireRole("RECRUITER");
  const title = (input.title ?? "").trim();
  const brief = (input.brief ?? "").trim();
  if (!title) return { ok: false, error: "Vui lòng nhập tiêu đề vị trí trước" };
  if (!brief) return { ok: false, error: "Vui lòng nhập mô tả ngắn để AI soạn" };

  if (!(await checkRateLimit("ai", session.user!.id as string)))
    return { ok: false, error: "Bạn thao tác quá nhanh, thử lại sau một phút" };

  try {
    const result = await requestJdDraft(buildJdDraftPrompt({ title, brief }));
    return { ok: true, draft: mapDraftToForm(result) };
  } catch {
    return { ok: false, error: "AI soạn thất bại, vui lòng thử lại" };
  }
}
```

- [ ] **Step 3: Kiểm tra type + test + build**

Run: `npx tsc --noEmit && npm test`
Expected: 0 lỗi type; toàn bộ test xanh (các module thuần đã test ở Task 1-3).

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/ai/request-jd-draft.ts lib/jobs/ai-actions.ts
git commit -m "feat(ai): request wrapper + server action soạn JD (rate-limit + role)"
```

---

### Task 5: Tách `/jobs/new` thành client form + khối AI

**Files:**
- Create: `app/jobs/new/NewJobForm.tsx`
- Modify: `app/jobs/new/page.tsx`

**Interfaces:**
- Consumes: `createJobDescription` (`@/lib/jobs/actions`), `draftJobDescription` (Task 4), job field/category constants.

- [ ] **Step 1: Tạo client form component**

Tạo `app/jobs/new/NewJobForm.tsx`:

```tsx
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
    if (rawText.trim() && !confirm("Nội dung mô tả hiện có sẽ bị thay bằng bản AI soạn. Tiếp tục?"))
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
```

> Kiểm `components/ui/textarea` export `Textarea` (page hiện dùng). Nếu `confirm` bị chặn bởi lint (no-restricted-globals) thì dùng `window.confirm`.

- [ ] **Step 2: Rút form khỏi page, render client component**

Thay `app/jobs/new/page.tsx`:

```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import NewJobForm from "./NewJobForm";

export default async function NewJobPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "RECRUITER") redirect("/dashboard");

  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <Link href="/dashboard" className="text-sm text-primary hover:underline">← Về dashboard</Link>
        <Card className="mt-3">
          <CardHeader><CardTitle className="text-primary">Đăng tin tuyển dụng</CardTitle></CardHeader>
          <CardContent>
            <NewJobForm />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Kiểm tra type + build**

Run: `npx tsc --noEmit && npm run build`
Expected: 0 lỗi type; build PASS; `/jobs/new` vẫn build (giờ có client component con).

- [ ] **Step 4: Commit**

```bash
git add app/jobs/new/NewJobForm.tsx app/jobs/new/page.tsx
git commit -m "feat(ai): form /jobs/new client + khối soạn JD bằng AI"
```

---

### Task 6: Kiểm tra tổng thể cuối

- [ ] **Step 1: Kiểm tra tổng thể**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: tsc 0; lint 0 error (2 warning tồn đọng ở `schema.test.ts` + `cv/actions.ts` chấp nhận); test xanh; build PASS.

- [ ] **Step 2: (chỉ commit nếu có sửa nhỏ phát sinh)**

```bash
git add -A && git commit -m "chore(ai): dọn cuối trợ lý JD"
```

---

## Việc người dùng phải tự làm sau khi merge
Không thêm env/DB (dùng `GEMINI_API_KEY` sẵn có). Kiểm tay: đăng nhập recruiter → `/jobs/new` →
nhập tiêu đề + brief → "Soạn bằng AI" → các trường được điền → chỉnh sửa → đăng tin.

## Để dành vòng sau
Gợi ý mức lương theo thị trường; cải thiện JD của tin đã đăng (nút trên trang sửa tin); đa ngôn ngữ; gợi ý tiêu đề.
