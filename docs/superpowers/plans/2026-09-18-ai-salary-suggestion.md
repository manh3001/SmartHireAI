# AI gợi ý mức lương — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khi recruiter đăng tin `/jobs/new`, gợi ý khoảng lương lấy từ dữ liệu tin thật (median theo ngành × cấp bậc, có fallback) + 1-2 câu nhận định do AI viết; recruiter "Áp dụng" để điền 2 ô lương.

**Architecture:** Con số 100% từ dữ liệu nền tảng — `computeSalarySuggestion` (thuần) tính median theo độ đặc thù giảm dần (ngành×cấp → ngành → cấp → toàn bộ). AI (Gemini + Zod) chỉ viết nhận định, KHÔNG bịa số. Server action `suggestSalary` (requireRole RECRUITER + rate-limit `ai`) ghép dữ liệu + AI. UI mở rộng `NewJobForm`.

**Tech Stack:** Next.js 16 (App Router), Prisma 6, Gemini qua OpenAI-compat + Zod, vitest 4, TypeScript.

## Global Constraints

- Con số lương KHÔNG do LLM sinh — chỉ từ `computeSalarySuggestion` trên dữ liệu tin thật.
- DB lưu lương theo **VND**; form/hiển thị theo **triệu** (dùng `formatSalary`/`vndToMillions`).
- Không thêm dependency (Gemini + dữ liệu sẵn có). AI theo pattern `request-recommendations`.
- Logic thuần (suggestion, prompt, schema, vndToMillions) test bằng vitest; không import prisma trong file thuần.
- Server action AI: `requireRole("RECRUITER")` + rate-limit scope `ai`.
- Copy tiếng Việt. Không phá contract `createJobDescription` (giữ nguyên các `name` trong form).
- Kết thúc mỗi task: `npx tsc --noEmit` 0 + test liên quan xanh. Cuối: tsc + lint + `npm test` + `npm run build` sạch.
- Commit tiếng Việt, prefix `feat(ai):` / `test(ai):`.

---

### Task 1: Toán lương thuần — `computeSalarySuggestion` + `vndToMillions`

**Files:**
- Create: `lib/salary/suggestion.ts`
- Test: `lib/salary/__tests__/suggestion.test.ts`
- Modify: `lib/jobs/salary.ts` (thêm `vndToMillions`, refactor `toMillions` dùng nó)
- Test: `lib/jobs/__tests__/salary.test.ts` (thêm case `vndToMillions`)

**Interfaces:**
- Consumes: `median` (`@/lib/salary/insights`), `normalizeCategory` (`@/lib/jobs/job-categories`), `EXPERIENCE_LEVELS` (`@/lib/jobs/job-fields`).
- Produces:
  - `type SalaryBasis = "category_level" | "category" | "level" | "overall"`
  - `type SalarySuggestion = { medianMin: number | null; medianMax: number | null; sampleSize: number; basis: SalaryBasis }`
  - `MIN_SUGGESTION_SAMPLE = 3`
  - `computeSalarySuggestion(rows: SuggestionRow[], input: { category: string | null; experienceLevel: string | null }): SalarySuggestion | null`
  - `type SuggestionRow = { category: string | null; experienceLevel: string | null; salaryMin: number | null; salaryMax: number | null }`
  - `vndToMillions(vnd: number): number` (trong `lib/jobs/salary.ts`)

- [ ] **Step 1: Viết test thất bại (suggestion)**

Tạo `lib/salary/__tests__/suggestion.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeSalarySuggestion } from "../suggestion";

const M = 1_000_000;
function row(category: string | null, level: string | null, min: number | null, max: number | null) {
  return { category, experienceLevel: level, salaryMin: min == null ? null : min * M, salaryMax: max == null ? null : max * M };
}

describe("computeSalarySuggestion", () => {
  it("dùng category_level khi đủ mẫu (>=3)", () => {
    const rows = [
      row("it", "JUNIOR", 10, 20), row("it", "JUNIOR", 12, 24), row("it", "JUNIOR", 14, 28),
      row("finance", "SENIOR", 30, 40),
    ];
    const s = computeSalarySuggestion(rows, { category: "it", experienceLevel: "JUNIOR" })!;
    expect(s.basis).toBe("category_level");
    expect(s.sampleSize).toBe(3);
    expect(s.medianMin).toBe(12 * M);
    expect(s.medianMax).toBe(24 * M);
  });

  it("fallback sang category khi category_level thiếu mẫu", () => {
    const rows = [
      row("it", "JUNIOR", 10, 20),
      row("it", "SENIOR", 30, 50), row("it", "MID", 20, 30),
    ];
    const s = computeSalarySuggestion(rows, { category: "it", experienceLevel: "JUNIOR" })!;
    expect(s.basis).toBe("category");
    expect(s.sampleSize).toBe(3);
  });

  it("fallback sang level khi ngành thiếu nhưng cấp đủ", () => {
    const rows = [
      row("finance", "JUNIOR", 8, 12), row("design", "JUNIOR", 9, 13), row("hr", "JUNIOR", 10, 14),
      row("it", "SENIOR", 40, 60),
    ];
    const s = computeSalarySuggestion(rows, { category: "it", experienceLevel: "JUNIOR" })!;
    expect(s.basis).toBe("level");
  });

  it("fallback overall khi cả ngành lẫn cấp đều thiếu", () => {
    const rows = [row("finance", "SENIOR", 30, 40), row("design", "MID", 15, 25), row("hr", "LEAD", 40, 55)];
    const s = computeSalarySuggestion(rows, { category: "it", experienceLevel: "JUNIOR" })!;
    expect(s.basis).toBe("overall");
  });

  it("null khi không có tin nào có lương", () => {
    const rows = [row("it", "JUNIOR", null, null)];
    expect(computeSalarySuggestion(rows, { category: "it", experienceLevel: "JUNIOR" })).toBeNull();
  });

  it("ít dữ liệu (<3) vẫn trả overall với sampleSize nhỏ", () => {
    const rows = [row("it", "JUNIOR", 10, 20)];
    const s = computeSalarySuggestion(rows, { category: "marketing-sales", experienceLevel: "SENIOR" })!;
    expect(s.basis).toBe("overall");
    expect(s.sampleSize).toBe(1);
  });
});
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `npx vitest run lib/salary/__tests__/suggestion.test.ts`
Expected: FAIL ("Cannot find module '../suggestion'").

- [ ] **Step 3: Viết `lib/salary/suggestion.ts`**

```ts
import { median } from "./insights";
import { normalizeCategory } from "@/lib/jobs/job-categories";
import { EXPERIENCE_LEVELS } from "@/lib/jobs/job-fields";

export const MIN_SUGGESTION_SAMPLE = 3;

export type SalaryBasis = "category_level" | "category" | "level" | "overall";
export type SalarySuggestion = {
  medianMin: number | null;
  medianMax: number | null;
  sampleSize: number;
  basis: SalaryBasis;
};
export type SuggestionRow = {
  category: string | null;
  experienceLevel: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
};

function hasSalary(r: SuggestionRow): boolean {
  return r.salaryMin != null || r.salaryMax != null;
}

function summarize(rows: SuggestionRow[]): { medianMin: number | null; medianMax: number | null; sampleSize: number } {
  const mins = rows.map((r) => r.salaryMin).filter((v): v is number => v != null);
  const maxs = rows.map((r) => r.salaryMax).filter((v): v is number => v != null);
  return { medianMin: median(mins), medianMax: median(maxs), sampleSize: rows.length };
}

export function computeSalarySuggestion(
  rows: SuggestionRow[],
  input: { category: string | null; experienceLevel: string | null },
): SalarySuggestion | null {
  const withSalary = rows.filter(hasSalary);
  if (withSalary.length === 0) return null;

  const cat = normalizeCategory(input.category);
  const level =
    input.experienceLevel && (EXPERIENCE_LEVELS as readonly string[]).includes(input.experienceLevel)
      ? input.experienceLevel
      : null;

  const candidates: { basis: SalaryBasis; rows: SuggestionRow[] }[] = [];
  if (cat && level)
    candidates.push({
      basis: "category_level",
      rows: withSalary.filter((r) => normalizeCategory(r.category) === cat && r.experienceLevel === level),
    });
  if (cat)
    candidates.push({ basis: "category", rows: withSalary.filter((r) => normalizeCategory(r.category) === cat) });
  if (level)
    candidates.push({ basis: "level", rows: withSalary.filter((r) => r.experienceLevel === level) });
  candidates.push({ basis: "overall", rows: withSalary });

  for (const c of candidates) {
    if (c.rows.length >= MIN_SUGGESTION_SAMPLE) {
      return { ...summarize(c.rows), basis: c.basis };
    }
  }
  // Không mức nào đạt ngưỡng nhưng vẫn có dữ liệu -> dùng overall (cỡ mẫu nhỏ).
  return { ...summarize(withSalary), basis: "overall" };
}
```

- [ ] **Step 4: Chạy test — phải PASS**

Run: `npx vitest run lib/salary/__tests__/suggestion.test.ts`
Expected: PASS (6 test).

- [ ] **Step 5: Thêm `vndToMillions` vào `lib/jobs/salary.ts`**

Trong `lib/jobs/salary.ts`, thêm export và refactor `toMillions` dùng nó:

```ts
export function vndToMillions(vnd: number): number {
  return Math.round((vnd / MILLION) * 10) / 10;
}
```

Sửa hàm `toMillions` hiện có thành:

```ts
function toMillions(vnd: number): string {
  const m = vndToMillions(vnd);
  return Number.isInteger(m) ? String(m) : m.toFixed(1);
}
```

- [ ] **Step 6: Thêm test `vndToMillions`**

Trong `lib/jobs/__tests__/salary.test.ts`, thêm:

```ts
import { vndToMillions } from "../salary";

describe("vndToMillions", () => {
  it("đổi VND sang triệu, làm tròn 1 chữ số", () => {
    expect(vndToMillions(15_000_000)).toBe(15);
    expect(vndToMillions(15_500_000)).toBe(15.5);
    expect(vndToMillions(0)).toBe(0);
  });
});
```

> Nếu file test đã có `import` từ `../salary`, gộp `vndToMillions` vào import hiện có thay vì thêm dòng import mới.

- [ ] **Step 7: Chạy test + type**

Run: `npx vitest run lib/jobs/__tests__/salary.test.ts lib/salary/__tests__/suggestion.test.ts && npx tsc --noEmit`
Expected: PASS; 0 lỗi type (formatSalary vẫn hành xử như cũ).

- [ ] **Step 8: Commit**

```bash
git add lib/salary/suggestion.ts lib/salary/__tests__/suggestion.test.ts lib/jobs/salary.ts lib/jobs/__tests__/salary.test.ts
git commit -m "feat(ai): computeSalarySuggestion (median theo ngành×cấp + fallback) + vndToMillions"
```

---

### Task 2: AI note — schema + prompt

**Files:**
- Create: `lib/ai/salary-note-schema.ts`
- Test: `lib/ai/__tests__/salary-note-schema.test.ts`
- Create: `lib/ai/salary-note-prompt.ts`
- Test: `lib/ai/__tests__/salary-note-prompt.test.ts`

**Interfaces:**
- Produces:
  - `salaryNoteSchema` (Zod `{ note: string }`), `type SalaryNote`.
  - `SALARY_NOTE_SYSTEM_PROMPT: string`
  - `buildSalaryNotePrompt(input: { title: string; categoryLabel: string; levelLabel: string; skills: string; medianMin: number | null; medianMax: number | null; sampleSize: number; basis: string }): string`

- [ ] **Step 1: Viết test thất bại (schema)**

Tạo `lib/ai/__tests__/salary-note-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { salaryNoteSchema } from "../salary-note-schema";

describe("salaryNoteSchema", () => {
  it("parse { note }", () => {
    expect(salaryNoteSchema.parse({ note: "Khoảng này hợp lý." }).note).toBe("Khoảng này hợp lý.");
  });
  it("thiếu note -> throw", () => {
    expect(() => salaryNoteSchema.parse({})).toThrow();
  });
});
```

- [ ] **Step 2: Viết test thất bại (prompt)**

Tạo `lib/ai/__tests__/salary-note-prompt.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildSalaryNotePrompt, SALARY_NOTE_SYSTEM_PROMPT } from "../salary-note-prompt";

describe("buildSalaryNotePrompt", () => {
  const p = buildSalaryNotePrompt({
    title: "Frontend Developer", categoryLabel: "Công nghệ thông tin", levelLabel: "Junior",
    skills: "React, TypeScript", medianMin: 12_000_000, medianMax: 24_000_000, sampleSize: 8, basis: "category_level",
  });
  it("chứa tiêu đề, ngành, cấp bậc, cỡ mẫu", () => {
    expect(p).toContain("Frontend Developer");
    expect(p).toContain("Công nghệ thông tin");
    expect(p).toContain("Junior");
    expect(p).toContain("8");
  });
  it("system prompt cấm đưa ra con số mới", () => {
    expect(SALARY_NOTE_SYSTEM_PROMPT.toLowerCase()).toContain("không");
  });
});
```

- [ ] **Step 3: Chạy — phải FAIL**

Run: `npx vitest run lib/ai/__tests__/salary-note-schema.test.ts lib/ai/__tests__/salary-note-prompt.test.ts`
Expected: FAIL (thiếu module).

- [ ] **Step 4: Viết implementation**

Tạo `lib/ai/salary-note-schema.ts`:

```ts
import { z } from "zod";

export const salaryNoteSchema = z.object({
  note: z.string(),
});

export type SalaryNote = z.infer<typeof salaryNoteSchema>;
```

Tạo `lib/ai/salary-note-prompt.ts`:

```ts
import { formatSalary } from "@/lib/jobs/salary";

export const SALARY_NOTE_SYSTEM_PROMPT = `Bạn là chuyên gia nhân sự. \
Nhiệm vụ: viết 1-2 câu tiếng Việt nhận định ngắn gọn về KHOẢNG LƯƠNG ĐÃ ĐƯỢC CUNG CẤP cho một vị trí. \
TUYỆT ĐỐI KHÔNG đưa ra con số lương mới hay thay đổi con số đã cho; chỉ nhận xét (mức độ phù hợp, yếu tố ảnh hưởng như kỹ năng/địa điểm, lưu ý nếu cỡ mẫu nhỏ). \
Trả lời hoàn toàn bằng tiếng Việt, đúng cấu trúc JSON được yêu cầu ("note").`;

export function buildSalaryNotePrompt(input: {
  title: string;
  categoryLabel: string;
  levelLabel: string;
  skills: string;
  medianMin: number | null;
  medianMax: number | null;
  sampleSize: number;
  basis: string;
}): string {
  const range = formatSalary(input.medianMin, input.medianMax, false) ?? "chưa xác định";
  return [
    `Vị trí: ${input.title}`,
    `Ngành: ${input.categoryLabel}`,
    `Cấp bậc: ${input.levelLabel}`,
    `Kỹ năng: ${input.skills || "(không có)"}`,
    `Khoảng lương tham chiếu (đã tính từ dữ liệu, KHÔNG được đổi): ${range}`,
    `Cỡ mẫu: ${input.sampleSize} tin (cơ sở: ${input.basis})`,
    `Hãy viết "note" 1-2 câu nhận định về khoảng lương này.`,
  ].join("\n");
}
```

- [ ] **Step 5: Chạy — phải PASS**

Run: `npx vitest run lib/ai/__tests__/salary-note-schema.test.ts lib/ai/__tests__/salary-note-prompt.test.ts`
Expected: PASS (4 test).

- [ ] **Step 6: Commit**

```bash
git add lib/ai/salary-note-schema.ts lib/ai/salary-note-prompt.ts lib/ai/__tests__/salary-note-schema.test.ts lib/ai/__tests__/salary-note-prompt.test.ts
git commit -m "feat(ai): schema + prompt nhận định lương (AI không bịa số)"
```

---

### Task 3: Data accessor + request wrapper + server action

**Files:**
- Modify: `lib/salary/insights-data.ts` (thêm `getCachedSalaryRows`)
- Create: `lib/ai/request-salary-note.ts`
- Create: `lib/jobs/salary-suggest-actions.ts`

**Interfaces:**
- Consumes: `computeSalarySuggestion`/`SalarySuggestion`/`SuggestionRow` (Task 1), `salaryNoteSchema`/`SalaryNote` (Task 2), `buildSalaryNotePrompt`/`SALARY_NOTE_SYSTEM_PROMPT` (Task 2), `getAiClient`/`AI_MODEL`, `requireRole`, `checkRateLimit`, `JOB_CATEGORY_LABELS`, `EXPERIENCE_LEVEL_LABELS`, `normalizeCategory`.
- Produces:
  - `getCachedSalaryRows(): Promise<SuggestionRow[]>`
  - `requestSalaryNote(prompt: string): Promise<SalaryNote>`
  - `suggestSalary(input: { title: string; category: string | null; experienceLevel: string | null; skills: string }): Promise<{ ok: true; suggestion: SalarySuggestion; note: string } | { ok: false; error: string }>`

- [ ] **Step 1: Thêm `getCachedSalaryRows`**

Trong `lib/salary/insights-data.ts`, thêm (import `SuggestionRow` từ `./suggestion`):

```ts
import type { SuggestionRow } from "./suggestion";

const getCachedRows = unstable_cache(
  async (): Promise<SuggestionRow[]> => {
    return prisma.jobDescription.findMany({
      where: { isPublic: true },
      select: { category: true, experienceLevel: true, salaryMin: true, salaryMax: true },
    });
  },
  ["salary-rows"],
  { tags: [CACHE_TAGS.jobs], revalidate: 3600 },
);

export async function getCachedSalaryRows(): Promise<SuggestionRow[]> {
  return getCachedRows();
}
```

(Các import `unstable_cache`, `prisma`, `CACHE_TAGS` đã có sẵn ở đầu file.)

- [ ] **Step 2: Request wrapper**

Tạo `lib/ai/request-salary-note.ts`:

```ts
import { zodResponseFormat } from "openai/helpers/zod";
import { getAiClient, AI_MODEL } from "./client";
import { SALARY_NOTE_SYSTEM_PROMPT } from "./salary-note-prompt";
import { salaryNoteSchema, type SalaryNote } from "./salary-note-schema";

export async function requestSalaryNote(prompt: string): Promise<SalaryNote> {
  const client = getAiClient();
  const completion = await client.chat.completions.parse({
    model: AI_MODEL,
    messages: [
      { role: "system", content: SALARY_NOTE_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: zodResponseFormat(salaryNoteSchema, "salary_note"),
  });
  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    throw new Error("Model không trả về kết quả hợp lệ");
  }
  return parsed;
}
```

- [ ] **Step 3: Server action**

Tạo `lib/jobs/salary-suggest-actions.ts`:

```ts
"use server";

import { requireRole } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/security/ratelimit";
import { getCachedSalaryRows } from "@/lib/salary/insights-data";
import { computeSalarySuggestion, type SalarySuggestion } from "@/lib/salary/suggestion";
import { buildSalaryNotePrompt } from "@/lib/ai/salary-note-prompt";
import { requestSalaryNote } from "@/lib/ai/request-salary-note";
import { JOB_CATEGORY_LABELS, normalizeCategory } from "@/lib/jobs/job-categories";
import { EXPERIENCE_LEVEL_LABELS, EXPERIENCE_LEVELS } from "@/lib/jobs/job-fields";
import type { ExperienceLevel } from "@/lib/jobs/job-fields";

export async function suggestSalary(input: {
  title: string;
  category: string | null;
  experienceLevel: string | null;
  skills: string;
}): Promise<{ ok: true; suggestion: SalarySuggestion; note: string } | { ok: false; error: string }> {
  const session = await requireRole("RECRUITER");
  if (!(await checkRateLimit("ai", session.user!.id as string)))
    return { ok: false, error: "Bạn thao tác quá nhanh, thử lại sau một phút" };

  const rows = await getCachedSalaryRows();
  const suggestion = computeSalarySuggestion(rows, {
    category: input.category,
    experienceLevel: input.experienceLevel,
  });
  if (!suggestion) return { ok: false, error: "Chưa đủ dữ liệu lương để gợi ý" };

  const cat = normalizeCategory(input.category);
  const level =
    input.experienceLevel && (EXPERIENCE_LEVELS as readonly string[]).includes(input.experienceLevel)
      ? (input.experienceLevel as ExperienceLevel)
      : null;

  let note = "";
  try {
    const result = await requestSalaryNote(
      buildSalaryNotePrompt({
        title: input.title || "(chưa có tiêu đề)",
        categoryLabel: cat ? JOB_CATEGORY_LABELS[cat] : "(chưa chọn)",
        levelLabel: level ? EXPERIENCE_LEVEL_LABELS[level] : "(chưa chọn)",
        skills: input.skills,
        medianMin: suggestion.medianMin,
        medianMax: suggestion.medianMax,
        sampleSize: suggestion.sampleSize,
        basis: suggestion.basis,
      }),
    );
    note = result.note;
  } catch {
    note = ""; // AI lỗi không chặn phần số — số quan trọng hơn
  }

  return { ok: true, suggestion, note };
}
```

- [ ] **Step 4: Kiểm tra type + test + build**

Run: `npx tsc --noEmit && npm test`
Expected: 0 lỗi type; toàn bộ test xanh.

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/salary/insights-data.ts lib/ai/request-salary-note.ts lib/jobs/salary-suggest-actions.ts
git commit -m "feat(ai): action suggestSalary (dữ liệu median + AI note) + cache salary rows"
```

---

### Task 4: UI gợi ý lương trong `NewJobForm`

**Files:**
- Modify: `app/jobs/new/NewJobForm.tsx`

**Interfaces:**
- Consumes: `suggestSalary` (Task 3), `formatSalary`/`vndToMillions` (`@/lib/jobs/salary`), `SalarySuggestion` type.

- [ ] **Step 1: Chuyển ô lương thành controlled + thêm khối gợi ý**

Trong `app/jobs/new/NewJobForm.tsx`:

(a) Thêm import:
```ts
import { formatSalary, vndToMillions } from "@/lib/jobs/salary";
import { suggestSalary } from "@/lib/jobs/salary-suggest-actions";
import type { SalarySuggestion } from "@/lib/salary/suggestion";
```

(b) Thêm state (cạnh các state hiện có):
```tsx
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [sug, setSug] = useState<{ suggestion: SalarySuggestion; note: string } | null>(null);
  const [sugPending, startSug] = useTransition();
```

(c) Thêm hàm gọi gợi ý + áp dụng:
```tsx
  const BASIS_LABEL: Record<SalarySuggestion["basis"], string> = {
    category_level: "theo ngành & cấp bậc",
    category: "theo ngành",
    level: "theo cấp bậc",
    overall: "toàn thị trường",
  };

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
```

(d) Thay 2 ô lương thành controlled và thêm nút + thẻ gợi ý. Thay khối "Mức lương" hiện tại bằng:
```tsx
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
```

> `category`, `experienceLevel`, `skills`, `title` đã là state controlled sẵn trong `NewJobForm` (từ vòng JD assistant). `useTransition` + `toast` + `Button` đã được import sẵn — nếu thiếu import nào, thêm.

- [ ] **Step 2: Kiểm tra type + build**

Run: `npx tsc --noEmit && npm run build`
Expected: 0 lỗi type; build PASS; `/jobs/new` build được.

- [ ] **Step 3: Commit**

```bash
git add app/jobs/new/NewJobForm.tsx
git commit -m "feat(ai): khối gợi ý lương AI trong form đăng tin"
```

---

### Task 5: Kiểm tra tổng thể cuối

- [ ] **Step 1: Kiểm tra tổng thể**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: tsc 0; lint 0 error (2 warning tồn đọng ở `schema.test.ts` + `cv/actions.ts` chấp nhận); test xanh; build PASS.

- [ ] **Step 2: (chỉ commit nếu có sửa phát sinh)**

```bash
git add -A && git commit -m "chore(ai): dọn cuối gợi ý lương"
```

---

## Việc người dùng phải tự làm sau khi merge
Không thêm env/DB. Kiểm tay: đăng nhập recruiter → `/jobs/new` → chọn ngành + cấp bậc → "Gợi ý
lương (AI)" → xem khoảng + cỡ mẫu + cơ sở + nhận định → "Áp dụng" → 2 ô lương được điền. Thử cả
trường hợp ít dữ liệu (fallback overall / "ít dữ liệu").

## Để dành vòng sau
Số lương theo kỹ năng cụ thể; gợi ý ở trang sửa tin; biểu đồ phân phối; "so với thị trường" khi ứng viên xem tin.
