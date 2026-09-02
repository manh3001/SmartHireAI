# Cover Letter AI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho ứng viên sinh nháp thư giới thiệu bằng AI (từ CV đã chọn + JD) ngay trong form ứng tuyển, đổ vào ô "Thư giới thiệu" sẵn có.

**Architecture:** Lớp AI thuần (system prompt + `buildCoverLetterPrompt`, tái dùng `formatCv`) + `requestCoverLetter` (plain-text completion, không JSON). Server action `generateCoverLetter` bám khuôn `previewMatch` (CANDIDATE-only, rate-limit "ai", load job+CV, try/catch AI). UI: nút trong `ApplyForm` đổ text vào state `coverLetter`; ghi đè qua Dialog xác nhận. Không schema mới.

**Tech Stack:** Next.js 16, React 19, OpenAI SDK trỏ Gemini (`gemini-2.5-flash`), Zod (không dùng cho task này), Vitest, Tailwind v4, lucide-react.

## Global Constraints

- Không schema mới; thư lưu vào `Application.coverLetter` (đã có) khi nộp.
- Hàm prompt thuần: không import prisma/auth; test bằng vitest.
- Action trả `{ ok: true; ... } | { ok: false; error: string }`; prisma default import `@/lib/db/prisma`; auth từ `@/auth`.
- AI: `getAiClient()` + `AI_MODEL` từ `@/lib/ai/client`; rate-limit `checkRateLimit("ai", userId)` từ `@/lib/security/ratelimit`.
- Chỉ `CANDIDATE`; toàn bộ chữ tiếng Việt; chỉ Tailwind design token; dark-mode readable.
- Thư ~150–250 từ, chỉ dùng dữ kiện trong CV (không bịa), không markdown.
- Ghi đè ô thư dùng **Dialog** (`components/ui/dialog`), KHÔNG `window.confirm`.
- Không sửa component xem trước CV. Baseline 359 test.

---

### Task 1: Lớp AI — prompt thuần + request

Export `formatCv` để tái dùng; thêm system prompt + builder + hàm gọi AI văn xuôi.

**Files:**
- Modify: `lib/ai/prompt.ts` (đổi `function formatCv` → `export function formatCv`)
- Create: `lib/ai/cover-letter-prompt.ts`
- Create: `lib/ai/request-cover-letter.ts`
- Test: `lib/ai/__tests__/cover-letter-prompt.test.ts`

**Interfaces:**
- Produces:
  - `export function formatCv(cv: CvInput): string` (từ `lib/ai/prompt.ts`)
  - `COVER_LETTER_SYSTEM_PROMPT: string`
  - `buildCoverLetterPrompt(cv: CvInput, jdText: string, candidateName: string): string`
  - `requestCoverLetter(prompt: string): Promise<string>`

- [ ] **Step 1: Export `formatCv` trong `lib/ai/prompt.ts`**

Đổi dòng khai báo (hiện tại `function formatCv(cv: CvInput): string {`) thành:
```typescript
export function formatCv(cv: CvInput): string {
```
Không đổi gì khác trong file (giữ nguyên `buildEvaluationPrompt`, `SYSTEM_PROMPT`).

- [ ] **Step 2: Viết test thất bại `lib/ai/__tests__/cover-letter-prompt.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { buildCoverLetterPrompt, COVER_LETTER_SYSTEM_PROMPT } from "../cover-letter-prompt";
import type { CvInput } from "@/lib/cv/types";

const cv: CvInput = {
  title: "CV",
  profile: {
    fullName: "Nguyễn Văn A", headline: "Frontend Dev", email: "", phone: "",
    location: "", linkedin: "", github: "", portfolio: "", summary: "Yêu thích React",
  },
  experiences: [{ company: "FPT", position: "Dev", startDate: "2023", endDate: "2024", description: "Làm web" }],
  educations: [],
  skills: [{ name: "React", level: "" }],
  projects: [],
  languages: [],
  certifications: [],
};

describe("buildCoverLetterPrompt", () => {
  it("chứa tên ứng viên, nội dung JD và dữ kiện CV", () => {
    const p = buildCoverLetterPrompt(cv, "Cần React và giao tiếp tốt", "Nguyễn Văn A");
    expect(p).toContain("Nguyễn Văn A");
    expect(p).toContain("Cần React và giao tiếp tốt");
    expect(p).toContain("FPT");
    expect(p).toContain("React");
  });
});

describe("COVER_LETTER_SYSTEM_PROMPT", () => {
  it("có chỉ dẫn độ dài và không bịa thông tin", () => {
    expect(COVER_LETTER_SYSTEM_PROMPT).toContain("150");
    expect(COVER_LETTER_SYSTEM_PROMPT.toLowerCase()).toContain("không bịa");
  });
});
```

- [ ] **Step 3: Chạy test để xác nhận FAIL**

Run: `npx vitest run lib/ai/__tests__/cover-letter-prompt.test.ts`
Expected: FAIL — "Cannot find module '../cover-letter-prompt'".

- [ ] **Step 4: Viết `lib/ai/cover-letter-prompt.ts`**

```typescript
import type { CvInput } from "@/lib/cv/types";
import { formatCv } from "./prompt";

export const COVER_LETTER_SYSTEM_PROMPT = `Bạn là trợ lý viết thư xin việc chuyên nghiệp. \
Viết một thư giới thiệu (cover letter) bằng tiếng Việt cho ứng viên dựa trên CV và mô tả công việc (JD) người dùng cung cấp. \
Yêu cầu: độ dài khoảng 150–250 từ; giọng chuyên nghiệp, chân thành, tự tin nhưng không khoa trương; \
nêu bật các kỹ năng và kinh nghiệm trong CV khớp với JD; \
CHỈ dùng thông tin có trong CV, KHÔNG bịa số liệu hay kinh nghiệm không có; \
KHÔNG lặp lại nguyên văn JD; KHÔNG dùng markdown hay tiêu đề — chỉ trả về nội dung thư.`;

export function buildCoverLetterPrompt(
  cv: CvInput,
  jdText: string,
  candidateName: string,
): string {
  return `Ứng viên: ${candidateName}

=== CV ỨNG VIÊN ===
${formatCv(cv)}

=== MÔ TẢ CÔNG VIỆC (JD) ===
${jdText}

Hãy viết thư giới thiệu theo đúng yêu cầu ở trên.`;
}
```

- [ ] **Step 5: Chạy test để xác nhận PASS**

Run: `npx vitest run lib/ai/__tests__/cover-letter-prompt.test.ts`
Expected: PASS (2 test).

- [ ] **Step 6: Viết `lib/ai/request-cover-letter.ts`**

```typescript
import { getAiClient, AI_MODEL } from "./client";
import { COVER_LETTER_SYSTEM_PROMPT } from "./cover-letter-prompt";

export async function requestCoverLetter(prompt: string): Promise<string> {
  const client = getAiClient();
  const completion = await client.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: "system", content: COVER_LETTER_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  });
  const text = completion.choices[0]?.message.content?.trim();
  if (!text) throw new Error("Model không trả về nội dung thư");
  return text;
}
```

- [ ] **Step 7: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: 0 lỗi.
```bash
git add lib/ai/prompt.ts lib/ai/cover-letter-prompt.ts lib/ai/request-cover-letter.ts lib/ai/__tests__/cover-letter-prompt.test.ts
git commit -m "feat(cover-letter): AI prompt layer + requestCoverLetter (plain-text completion)"
```

---

### Task 2: Server action `generateCoverLetter`

**Files:**
- Modify: `lib/applications/actions.ts` (thêm import + hàm `generateCoverLetter`)

**Interfaces:**
- Consumes: `buildCoverLetterPrompt`, `requestCoverLetter` (Task 1); có sẵn trong file: `auth`, `prisma`, `checkRateLimit`, `loadCvInput`, `composeJdText`.
- Produces: `generateCoverLetter(jobId: string, cvId: string): Promise<{ ok: true; text: string } | { ok: false; error: string }>`

- [ ] **Step 1: Thêm import**

Trong `lib/applications/actions.ts`, sau dòng `import { buildEvaluationPrompt } from "@/lib/ai/prompt";`, thêm:
```typescript
import { requestCoverLetter } from "@/lib/ai/request-cover-letter";
import { buildCoverLetterPrompt } from "@/lib/ai/cover-letter-prompt";
```

- [ ] **Step 2: Thêm hàm `generateCoverLetter`**

Chèn ngay sau hàm `previewMatch` (trước `submitApplication`):
```typescript
export async function generateCoverLetter(
  jobId: string,
  cvId: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "CANDIDATE")
    return { ok: false, error: "Chỉ ứng viên mới dùng tính năng này" };

  if (!(await checkRateLimit("ai", userId)))
    return { ok: false, error: "Bạn thao tác quá nhanh, thử lại sau một phút" };

  const job = await prisma.jobDescription.findFirst({
    where: { id: jobId, isPublic: true },
    select: {
      id: true, rawText: true,
      location: true, employmentType: true, experienceLevel: true, skills: true,
      salaryMin: true, salaryMax: true, salaryNegotiable: true,
    },
  });
  if (!job) return { ok: false, error: "Không tìm thấy tin tuyển dụng" };

  const cv = await loadCvInput(cvId, userId);
  if (!cv) return { ok: false, error: "Không tìm thấy CV" };

  try {
    const text = await requestCoverLetter(
      buildCoverLetterPrompt(
        cv,
        composeJdText(job),
        cv.profile.fullName || session.user.name || "Ứng viên",
      ),
    );
    return { ok: true, text };
  } catch {
    return { ok: false, error: "AI viết thư thất bại, vui lòng thử lại" };
  }
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: 0 lỗi.
```bash
git add lib/applications/actions.ts
git commit -m "feat(cover-letter): generateCoverLetter server action (CANDIDATE, rate-limited)"
```

---

### Task 3: UI trong `ApplyForm` + verify tổng

Nút "Viết thư bằng AI" đổ text vào ô thư; ghi đè qua Dialog xác nhận.

**Files:**
- Modify: `app/jobs/[id]/apply/ApplyForm.tsx`

**Interfaces:**
- Consumes: `generateCoverLetter` (Task 2); `Dialog*` từ `@/components/ui/dialog`; `Sparkles` từ lucide-react.

- [ ] **Step 1: Cập nhật import action**

Đổi dòng:
```tsx
import { previewMatch, submitApplication } from "@/lib/applications/actions";
```
thành:
```tsx
import { previewMatch, submitApplication, generateCoverLetter } from "@/lib/applications/actions";
```

- [ ] **Step 2: Thêm import Dialog + icon**

Sau dòng `import ScoreBadge from "@/components/ScoreBadge";`, thêm:
```tsx
import { Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
```

- [ ] **Step 3: Thêm state**

Sau dòng `const [submitting, setSubmitting] = useState(false);`, thêm:
```tsx
  const [generating, setGenerating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
```

- [ ] **Step 4: Thêm hàm sinh thư**

Ngay sau hàm `onSubmit() { ... }`, thêm:
```tsx
  async function runGenerate() {
    if (!cvId) return;
    setConfirmOpen(false);
    setGenerating(true);
    const r = await generateCoverLetter(jobId, cvId);
    if (r.ok) {
      setCoverLetter(r.text);
      toast.success("Đã tạo thư giới thiệu");
    } else {
      toast.error(r.error);
    }
    setGenerating(false);
  }

  function onGenerateClick() {
    if (coverLetter.trim()) {
      setConfirmOpen(true);
    } else {
      runGenerate();
    }
  }
```

- [ ] **Step 5: Thay label ô thư bằng hàng label + nút**

Đổi dòng:
```tsx
        <label className="text-sm font-medium text-foreground">Thư giới thiệu (không bắt buộc)</label>
```
thành:
```tsx
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm font-medium text-foreground">Thư giới thiệu (không bắt buộc)</label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onGenerateClick}
            disabled={generating || !cvId}
          >
            <Sparkles className="h-4 w-4" />
            {generating ? "Đang viết..." : "Viết thư bằng AI"}
          </Button>
        </div>
```

- [ ] **Step 6: Thêm Dialog xác nhận ghi đè**

Ngay trước thẻ đóng `</CardContent>` (sau nút "Nộp đơn"), chèn:
```tsx
        <Dialog open={confirmOpen} onOpenChange={(v) => !generating && setConfirmOpen(v)}>
          <DialogContent className="max-w-sm" showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Thay nội dung thư?</DialogTitle>
              <DialogDescription>
                Ô thư đang có nội dung. Bản AI sẽ thay thế nội dung hiện tại.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={generating}>
                Giữ nguyên
              </Button>
              <Button onClick={runGenerate} disabled={generating}>
                {generating ? "Đang viết..." : "Thay bằng AI"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
```

- [ ] **Step 7: Typecheck + toàn bộ test + build**

Run: `npx tsc --noEmit`
Expected: 0 lỗi.
Run: `npx vitest run`
Expected: PASS (359 baseline + 2 mới = 361).
Run: `npm run build`
Expected: build thành công.

- [ ] **Step 8: Commit**

```bash
git add app/jobs/[id]/apply/ApplyForm.tsx
git commit -m "feat(cover-letter): 'Viết thư bằng AI' button in ApplyForm with overwrite confirm"
```

---

## Ghi chú kiểm thử tổng (sau tất cả task)

Manual bằng `npm run dev` (cần `GEMINI_API_KEY`; nếu subagent không chạy được dev/AI, ghi "cần user xác nhận"):
- Ứng viên vào `/jobs/<id>/apply`, chọn CV → bấm "Viết thư bằng AI" → thư tiếng Việt ~150–250 từ đổ vào ô, sửa được.
- Ô thư đang có chữ → bấm nút → Dialog "Thay nội dung thư?" → "Thay bằng AI" mới ghi đè; "Giữ nguyên" thì thôi.
- Nộp đơn → `Application.coverLetter` lưu đúng nội dung đã sửa.
- Bấm quá nhanh nhiều lần → thông báo rate-limit.
- Dark mode: nút + Dialog đọc được.
