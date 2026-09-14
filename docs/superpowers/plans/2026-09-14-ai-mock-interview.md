# AI phỏng vấn thử (mock interview) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ứng viên luyện phỏng vấn với AI: sinh câu hỏi từ JD → trả lời → AI chấm + góp ý (batch, không lưu DB).

**Architecture:** Mirror stack AI: prompt thuần + Zod schema (test được), request wrapper dùng `chat.completions.parse` + `zodResponseFormat` (structured output như `requestScreening`), server action `requireRole("CANDIDATE")` + `checkRateLimit("ai")` fetch JD server-side. UI: trang gate + client component máy trạng thái.

**Tech Stack:** Next.js 16 App Router, Gemini (`gemini-2.5-flash` qua `getAiClient()`), openai SDK `zodResponseFormat`, Zod, vitest.

## Global Constraints

- Không schema/DB mới (ephemeral). prisma default `@/lib/db/prisma`; model qua `getAiClient()`/`AI_MODEL`.
- Fetch JD server-side theo `jobId` (chỉ `isPublic`) — KHÔNG tin JD từ client.
- Rate-limit `checkRateLimit("ai", userId)` cho cả 2 action; gate `requireRole("CANDIDATE")`.
- `QUESTION_COUNT = 5`; điểm/câu 0–10; tổng 0–100. Tiếng Việt; Tailwind tokens.
- Baseline 437 tests giữ xanh. Test `npx vitest run`; typecheck `npx tsc --noEmit`; lint `npm run lint` (0 error).

---

### Task 1: Prompt thuần + Zod schema (+ tests)

**Files:**
- Create: `lib/ai/mock-interview-schema.ts`
- Create: `lib/ai/mock-interview-prompt.ts`
- Create: `lib/ai/__tests__/mock-interview.test.ts`

**Interfaces:**
- Produces:
  - `mockQuestionsSchema` (z), `MockQuestions`; `mockScoringSchema` (z), `MockScoring`
  - `QUESTION_COUNT = 5`, `MOCK_QUESTIONS_SYSTEM_PROMPT`, `MOCK_SCORING_SYSTEM_PROMPT`
  - `buildQuestionsPrompt(jd)`, `buildScoringPrompt(jd, qa)`

- [ ] **Step 1: Viết test thất bại**

`lib/ai/__tests__/mock-interview.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { mockQuestionsSchema, mockScoringSchema } from "../mock-interview-schema";
import { buildQuestionsPrompt, buildScoringPrompt, QUESTION_COUNT } from "../mock-interview-prompt";

const jd = { title: "Kỹ sư Backend", company: "ACME", rawText: "Node.js, PostgreSQL, 2 năm KN" };

describe("buildQuestionsPrompt", () => {
  it("chứa JD và số câu hỏi", () => {
    const p = buildQuestionsPrompt(jd);
    expect(p).toContain("Kỹ sư Backend");
    expect(p).toContain("ACME");
    expect(p).toContain("PostgreSQL");
    expect(p).toContain(String(QUESTION_COUNT));
  });
});

describe("buildScoringPrompt", () => {
  it("chứa từng câu hỏi + trả lời; trả lời trống -> (bỏ trống)", () => {
    const p = buildScoringPrompt(jd, [
      { question: "Giới thiệu bản thân", answer: "Tôi là dev" },
      { question: "Điểm yếu?", answer: "" },
    ]);
    expect(p).toContain("Giới thiệu bản thân");
    expect(p).toContain("Tôi là dev");
    expect(p).toContain("Điểm yếu?");
    expect(p).toContain("(bỏ trống)");
  });
});

describe("mockQuestionsSchema", () => {
  it("hợp lệ", () => {
    expect(mockQuestionsSchema.safeParse({ questions: ["a", "b"] }).success).toBe(true);
  });
  it("mảng rỗng -> lỗi", () => {
    expect(mockQuestionsSchema.safeParse({ questions: [] }).success).toBe(false);
  });
});

describe("mockScoringSchema", () => {
  it("hợp lệ", () => {
    const ok = {
      perAnswer: [{ score: 8, feedback: "Tốt" }],
      overall: { score: 75, summary: "Khá", tips: ["Nói rõ hơn"] },
    };
    expect(mockScoringSchema.safeParse(ok).success).toBe(true);
  });
  it("điểm ngoài khoảng -> lỗi", () => {
    const bad = {
      perAnswer: [{ score: 11, feedback: "x" }],
      overall: { score: 75, summary: "y", tips: [] },
    };
    expect(mockScoringSchema.safeParse(bad).success).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test — phải fail**

Run: `npx vitest run lib/ai/__tests__/mock-interview.test.ts`
Expected: FAIL (module chưa tồn tại).

- [ ] **Step 3: Viết `lib/ai/mock-interview-schema.ts`**

```ts
import { z } from "zod";

export const mockQuestionsSchema = z.object({
  questions: z.array(z.string()).min(1),
});
export type MockQuestions = z.infer<typeof mockQuestionsSchema>;

export const mockScoringSchema = z.object({
  perAnswer: z.array(
    z.object({
      score: z.number().min(0).max(10),
      feedback: z.string(),
    }),
  ),
  overall: z.object({
    score: z.number().min(0).max(100),
    summary: z.string(),
    tips: z.array(z.string()),
  }),
});
export type MockScoring = z.infer<typeof mockScoringSchema>;
```

- [ ] **Step 4: Viết `lib/ai/mock-interview-prompt.ts`**

```ts
export const QUESTION_COUNT = 5;

export const MOCK_QUESTIONS_SYSTEM_PROMPT = `Bạn là chuyên gia tuyển dụng. Dựa trên mô tả công việc (JD), \
hãy tạo ${QUESTION_COUNT} câu hỏi phỏng vấn bằng tiếng Việt, trộn câu hỏi hành vi và chuyên môn phù hợp vị trí. \
Trả về đúng định dạng cấu trúc được yêu cầu.`;

export const MOCK_SCORING_SYSTEM_PROMPT = `Bạn là người phỏng vấn giàu kinh nghiệm. \
Chấm điểm từng câu trả lời của ứng viên (0–10) kèm nhận xét ngắn, và một đánh giá tổng thể (0–100) \
gồm tóm tắt và vài lời khuyên cải thiện. Nhận xét bằng tiếng Việt, mang tính xây dựng. \
Trả về đúng định dạng cấu trúc được yêu cầu.`;

type Jd = { title: string; company: string; rawText: string };

export function buildQuestionsPrompt(jd: Jd): string {
  return `=== MÔ TẢ CÔNG VIỆC ===
Vị trí: ${jd.title}
Công ty: ${jd.company}

${jd.rawText}

Hãy tạo ${QUESTION_COUNT} câu hỏi phỏng vấn phù hợp.`;
}

export function buildScoringPrompt(jd: Jd, qa: { question: string; answer: string }[]): string {
  const items = qa
    .map((x, i) => `Câu ${i + 1}: ${x.question}\nTrả lời: ${x.answer.trim() || "(bỏ trống)"}`)
    .join("\n\n");
  return `=== MÔ TẢ CÔNG VIỆC ===
Vị trí: ${jd.title}
Công ty: ${jd.company}

${jd.rawText}

=== CÂU HỎI & TRẢ LỜI ===
${items}

Hãy chấm điểm từng câu và đánh giá tổng thể.`;
}
```

- [ ] **Step 5: Chạy test — phải pass**

Run: `npx vitest run lib/ai/__tests__/mock-interview.test.ts`
Expected: PASS (6 test).

- [ ] **Step 6: Typecheck + test toàn bộ**

Run: `npx tsc --noEmit` → Expected: không lỗi.
Run: `npx vitest run` → Expected: 437 + 6 = 443 PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/ai/mock-interview-schema.ts lib/ai/mock-interview-prompt.ts lib/ai/__tests__/mock-interview.test.ts
git commit -m "feat(interview): prompt + Zod schema cho AI phỏng vấn thử"
```

---

### Task 2: Request wrappers + server actions

**Files:**
- Create: `lib/ai/request-mock-interview.ts`
- Create: `lib/interview-practice/actions.ts`

**Interfaces:**
- Consumes: `mockQuestionsSchema`/`mockScoringSchema`/`MockScoring`, `buildQuestionsPrompt`/`buildScoringPrompt`/system prompts, `getAiClient`/`AI_MODEL`, `requireRole`, `checkRateLimit`, `prisma`
- Produces:
  - `requestMockQuestions(prompt: string): Promise<string[]>`, `requestMockScoring(prompt: string): Promise<MockScoring>`
  - `startMockInterview(jobId): Promise<{ ok: true; questions: string[] } | { ok: false; error: string }>`
  - `scoreMockInterview(jobId, qa): Promise<{ ok: true; result: MockScoring } | { ok: false; error: string }>` với `qa: { question: string; answer: string }[]`

- [ ] **Step 1: Request wrappers `lib/ai/request-mock-interview.ts`**

```ts
import { zodResponseFormat } from "openai/helpers/zod";
import { getAiClient, AI_MODEL } from "./client";
import { MOCK_QUESTIONS_SYSTEM_PROMPT, MOCK_SCORING_SYSTEM_PROMPT } from "./mock-interview-prompt";
import { mockQuestionsSchema, mockScoringSchema, type MockScoring } from "./mock-interview-schema";

export async function requestMockQuestions(prompt: string): Promise<string[]> {
  const client = getAiClient();
  const completion = await client.chat.completions.parse({
    model: AI_MODEL,
    messages: [
      { role: "system", content: MOCK_QUESTIONS_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: zodResponseFormat(mockQuestionsSchema, "mock_questions"),
  });
  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) throw new Error("Model không trả về câu hỏi hợp lệ");
  return parsed.questions;
}

export async function requestMockScoring(prompt: string): Promise<MockScoring> {
  const client = getAiClient();
  const completion = await client.chat.completions.parse({
    model: AI_MODEL,
    messages: [
      { role: "system", content: MOCK_SCORING_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: zodResponseFormat(mockScoringSchema, "mock_scoring"),
  });
  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) throw new Error("Model không trả về kết quả chấm điểm hợp lệ");
  return parsed;
}
```

- [ ] **Step 2: Server actions `lib/interview-practice/actions.ts`**

```ts
"use server";

import prisma from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/security/ratelimit";
import { buildQuestionsPrompt, buildScoringPrompt } from "@/lib/ai/mock-interview-prompt";
import { requestMockQuestions, requestMockScoring } from "@/lib/ai/request-mock-interview";
import type { MockScoring } from "@/lib/ai/mock-interview-schema";

async function loadJd(jobId: string) {
  return prisma.jobDescription.findFirst({
    where: { id: jobId, isPublic: true },
    select: { title: true, company: true, rawText: true },
  });
}

export async function startMockInterview(
  jobId: string,
): Promise<{ ok: true; questions: string[] } | { ok: false; error: string }> {
  const session = await requireRole("CANDIDATE");
  if (!(await checkRateLimit("ai", session.user.id)))
    return { ok: false, error: "Bạn thao tác quá nhanh, vui lòng thử lại sau." };
  const jd = await loadJd(jobId);
  if (!jd) return { ok: false, error: "Không tìm thấy tin tuyển dụng." };
  try {
    const questions = await requestMockQuestions(buildQuestionsPrompt(jd));
    return { ok: true, questions };
  } catch {
    return { ok: false, error: "Không tạo được câu hỏi, vui lòng thử lại." };
  }
}

export async function scoreMockInterview(
  jobId: string,
  qa: { question: string; answer: string }[],
): Promise<{ ok: true; result: MockScoring } | { ok: false; error: string }> {
  const session = await requireRole("CANDIDATE");
  if (!(await checkRateLimit("ai", session.user.id)))
    return { ok: false, error: "Bạn thao tác quá nhanh, vui lòng thử lại sau." };
  if (!Array.isArray(qa) || qa.length === 0 || qa.every((x) => !x.answer.trim()))
    return { ok: false, error: "Hãy trả lời ít nhất một câu hỏi." };
  const jd = await loadJd(jobId);
  if (!jd) return { ok: false, error: "Không tìm thấy tin tuyển dụng." };
  try {
    const result = await requestMockScoring(buildScoringPrompt(jd, qa));
    return { ok: true, result };
  } catch {
    return { ok: false, error: "Không chấm được, vui lòng thử lại." };
  }
}
```

- [ ] **Step 3: Typecheck + test**

Run: `npx tsc --noEmit` → Expected: không lỗi.
Run: `npx vitest run` → Expected: 443 (không đổi).

- [ ] **Step 4: Commit**

```bash
git add lib/ai/request-mock-interview.ts lib/interview-practice/actions.ts
git commit -m "feat(interview): request wrappers + server actions phỏng vấn thử"
```

---

### Task 3: UI — trang + component + link

**Files:**
- Create: `app/jobs/[id]/interview-practice/page.tsx`
- Create: `components/interview-practice/MockInterview.tsx`
- Modify: `app/jobs/[id]/page.tsx` (link "Phỏng vấn thử" cho ứng viên)

**Interfaces:**
- Consumes: `startMockInterview`/`scoreMockInterview` (`@/lib/interview-practice/actions`), `MockScoring`

- [ ] **Step 1: Client component `components/interview-practice/MockInterview.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { startMockInterview, scoreMockInterview } from "@/lib/interview-practice/actions";
import type { MockScoring } from "@/lib/ai/mock-interview-schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Step = "idle" | "answering" | "result";

export default function MockInterview({ jobId }: { jobId: string }) {
  const [step, setStep] = useState<Step>("idle");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<MockScoring | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function begin() {
    setError(null);
    startTransition(async () => {
      const res = await startMockInterview(jobId);
      if (res.ok) {
        setQuestions(res.questions);
        setAnswers(res.questions.map(() => ""));
        setStep("answering");
      } else setError(res.error);
    });
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const qa = questions.map((question, i) => ({ question, answer: answers[i] ?? "" }));
      const res = await scoreMockInterview(jobId, qa);
      if (res.ok) {
        setResult(res.result);
        setStep("result");
      } else setError(res.error);
    });
  }

  function reset() {
    setStep("idle");
    setQuestions([]);
    setAnswers([]);
    setResult(null);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {step === "idle" && (
        <div>
          <p className="text-sm text-muted-foreground">
            AI sẽ tạo {`5`} câu hỏi phỏng vấn dựa trên tin này. Trả lời rồi nhận nhận xét & điểm.
          </p>
          <Button className="mt-3" onClick={begin} disabled={isPending}>
            {isPending ? "Đang tạo câu hỏi..." : "Bắt đầu phỏng vấn thử"}
          </Button>
        </div>
      )}

      {step === "answering" && (
        <div className="flex flex-col gap-4">
          {questions.map((q, i) => (
            <div key={i}>
              <p className="font-medium text-foreground">Câu {i + 1}: {q}</p>
              <Textarea
                className="mt-1"
                rows={3}
                value={answers[i] ?? ""}
                onChange={(e) => setAnswers((a) => a.map((v, j) => (j === i ? e.target.value : v)))}
                placeholder="Câu trả lời của bạn..."
              />
            </div>
          ))}
          <Button onClick={submit} disabled={isPending} className="self-start">
            {isPending ? "Đang chấm..." : "Nộp & chấm điểm"}
          </Button>
        </div>
      )}

      {step === "result" && result && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-3xl font-bold text-brand-gradient">{result.overall.score}/100</div>
            <p className="mt-1 text-sm text-foreground">{result.overall.summary}</p>
            {result.overall.tips.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                {result.overall.tips.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {result.perAnswer.map((a, i) => (
              <div key={i} className="rounded-xl border border-border p-3">
                <p className="text-sm font-medium text-foreground">Câu {i + 1}: {questions[i]}</p>
                <p className="mt-1 text-sm text-primary">Điểm: {a.score}/10</p>
                <p className="mt-1 text-sm text-muted-foreground">{a.feedback}</p>
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={reset} className="self-start">Làm lại</Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Trang `app/jobs/[id]/interview-practice/page.tsx`**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import MockInterview from "@/components/interview-practice/MockInterview";

export const dynamic = "force-dynamic";

export default async function InterviewPracticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("CANDIDATE");
  const { id } = await params;
  const job = await prisma.jobDescription.findFirst({
    where: { id, isPublic: true },
    select: { id: true, title: true, company: true },
  });
  if (!job) notFound();

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
        <Link href={`/jobs/${job.id}`} className="text-sm text-primary hover:underline">← Về tin tuyển dụng</Link>
        <h1 className="mt-3 text-2xl font-bold text-foreground">Phỏng vấn thử</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {job.title || "Tin tuyển dụng"}{job.company ? ` · ${job.company}` : ""}
        </p>
        <div className="mt-6">
          <MockInterview jobId={job.id} />
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Link "Phỏng vấn thử" trên `app/jobs/[id]/page.tsx`**

Trong `actionSlot` (biến JSX ở `app/jobs/[id]/page.tsx`), trong nhánh `{isCandidate && (...)}` — thêm nút SAU nút ứng tuyển/đã ứng tuyển (ngay trước `{isCandidate && <SaveJobButton .../>}` hoặc cạnh đó), một `Link`:
```tsx
      {isCandidate && (
        <Link href={`/jobs/${job.id}/interview-practice`} className={buttonVariants({ variant: "outline" })}>
          Phỏng vấn thử
        </Link>
      )}
```
(`Link` và `buttonVariants` đã import sẵn ở file này.)

- [ ] **Step 4: Typecheck + test + lint**

Run: `npx tsc --noEmit` → Expected: không lỗi.
Run: `npx vitest run` → Expected: 443.
Run: `npm run lint` → Expected: 0 error.

- [ ] **Step 5: Chạy app soát mắt (khuyến nghị)**

Run: `npm run dev`, đăng nhập ứng viên, mở một tin `isPublic` → bấm "Phỏng vấn thử" → "Bắt đầu" (AI tạo 5 câu) → trả lời → "Nộp & chấm điểm" → thấy điểm tổng + từng câu + tips; "Làm lại" reset. (Cần `GEMINI_API_KEY`.) Nếu action lỗi runtime → DỪNG, báo NEEDS_CONTEXT.

- [ ] **Step 6: Commit**

```bash
git add app/jobs/[id]/interview-practice/page.tsx components/interview-practice/MockInterview.tsx app/jobs/[id]/page.tsx
git commit -m "feat(interview): trang + UI phỏng vấn thử + link trên tin"
```

---

### Task 4: Kiểm chứng cuối

**Files:** (không sửa; chỉ chạy)

- [ ] **Step 1: Lint + typecheck + test đầy đủ**

Run:
```bash
npx tsc --noEmit
npm run lint
npx vitest run
```
Expected: tsc sạch; `npm run lint` 0 error; vitest 443 PASS.

## Self-Review

- **Spec coverage:** prompt thuần (Task 1) ✅ · Zod schema (Task 1) ✅ · request wrappers `chat.completions.parse`+zodResponseFormat (Task 2) ✅ · actions gate+rate-limit+fetch JD server-side (Task 2) ✅ · trang gate CANDIDATE + client component batch idle→answering→result + Làm lại (Task 3) ✅ · link trên tin cho ứng viên (Task 3) ✅ · unit test prompt+schema (Task 1) ✅ · kiểm chứng (Task 4) ✅.
- **Placeholder scan:** không có TBD/TODO; mọi step có code/lệnh.
- **Type consistency:** `MockScoring`/`mockScoringSchema`/`mockQuestionsSchema` dùng nhất quán schema→request→action→UI; `scoreMockInterview(jobId, qa: {question,answer}[])` khớp cách component gọi; `buildQuestionsPrompt`/`buildScoringPrompt` chữ ký khớp request/action; `params` Promise (`await params`) đúng Next 16; `requireRole("CANDIDATE")` trả session có `user.id`.
