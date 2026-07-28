# Phase 3: AI đánh giá CV theo JD — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho ứng viên dán JD và để Claude đánh giá độ phù hợp của CV (điểm, mạnh/yếu, từ khóa, skill gap), lưu kết quả và xem lại lịch sử.

**Architecture:** Ứng viên dán JD ở `/cv/[id]/evaluate`. API route gọi Claude (Haiku) qua `@anthropic-ai/sdk` với structured output (`messages.parse` + Zod) để ép JSON đúng schema. Logic điều phối (`runCvEvaluation`) nhận dependencies (model + DB) nên test được không cần gọi Claude thật. Kết quả lưu vào PostgreSQL (JobDescription + Evaluation). Logic thuần (prompt, schema, score, rate-limit) viết theo TDD với Vitest.

**Tech Stack:** Next.js 16, TypeScript, Prisma 6, PostgreSQL (Neon), `@anthropic-ai/sdk`, Zod, shadcn/ui, Vitest.

## Global Constraints

- Ngôn ngữ: TypeScript, chế độ `strict`.
- **Prisma giữ ở v6** (không nâng v7).
- **Chạy lệnh Prisma/dev qua npm script** (đã có `cross-env NODE_OPTIONS=--dns-result-order=ipv4first`) để tránh lỗi Neon P1001 do IPv6. Khi chạy `npx prisma ...` trực tiếp mà lỗi P1001, thêm tiền tố `NODE_OPTIONS=--dns-result-order=ipv4first`.
- Mọi secret trong `.env`, KHÔNG commit. **`ANTHROPIC_API_KEY` chỉ dùng ở server, không lộ ra client.**
- Model AI: `claude-haiku-4-5`. **KHÔNG set `output_config.effort` hay `thinking`** (Haiku không hỗ trợ, sẽ lỗi 400).
- Validate mọi output AI bằng Zod trước khi lưu.
- Next.js 16: `params` của route/page động là `Promise` — phải `await params`.
- Ứng viên chỉ đánh giá/xem CV và kết quả của chính mình (kiểm tra `userId` từ session).
- Mỗi task kết thúc bằng một commit.

---

### Task 1: Prisma models JobDescription + Evaluation

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: model `User`, `CV` đã có.
- Produces: models `JobDescription`, `Evaluation` trong Prisma Client; quan hệ `User.jobDescriptions`, `User.evaluations`, `CV.evaluations`.

- [ ] **Step 1: Thêm quan hệ ngược vào User**

Trong `model User`, thêm 2 dòng sau `cvs CV[]`:
```prisma
  jobDescriptions JobDescription[]
  evaluations     Evaluation[]
```

- [ ] **Step 2: Thêm quan hệ ngược vào CV**

Trong `model CV`, thêm dòng sau `projects Project[]`:
```prisma
  evaluations Evaluation[]
```

- [ ] **Step 3: Thêm 2 model mới**

Thêm vào cuối `prisma/schema.prisma`:
```prisma
model JobDescription {
  id          String       @id @default(cuid())
  userId      String
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  title       String       @default("")
  company     String       @default("")
  rawText     String
  evaluations Evaluation[]
  createdAt   DateTime     @default(now())
}

model Evaluation {
  id               String         @id @default(cuid())
  cvId             String
  cv               CV             @relation(fields: [cvId], references: [id], onDelete: Cascade)
  jobDescriptionId String
  jobDescription   JobDescription @relation(fields: [jobDescriptionId], references: [id], onDelete: Cascade)
  userId           String
  user             User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  overallScore     Int
  strengths        Json
  weaknesses       Json
  matchedKeywords  Json
  missingKeywords  Json
  skillGaps        Json
  summary          String
  rawModelOutput   Json
  createdAt        DateTime       @default(now())
}
```

- [ ] **Step 4: Đẩy schema lên Neon**

```bash
npm run db:push
```
Expected: "Your database is now in sync"; bảng `JobDescription`, `Evaluation` được tạo. (Nếu vẫn lỗi P1001, chạy `NODE_OPTIONS=--dns-result-order=ipv4first npx prisma db push`.)

- [ ] **Step 5: Kiểm tra type**

Run: `npx tsc --noEmit`
Expected: không lỗi (Prisma Client có `prisma.jobDescription`, `prisma.evaluation`).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add JobDescription and Evaluation models"
```

---

### Task 2: Cài SDK + Zod schema + prompt + score (TDD)

**Files:**
- Create: `lib/ai/schema.ts`
- Create: `lib/ai/prompt.ts`
- Create: `lib/ai/score.ts`
- Modify: `.env.example`
- Test: `lib/ai/__tests__/schema.test.ts`
- Test: `lib/ai/__tests__/prompt.test.ts`
- Test: `lib/ai/__tests__/score.test.ts`

**Interfaces:**
- Consumes: `CvInput` từ `@/lib/cv/types`.
- Produces:
  - Từ `lib/ai/schema.ts`: `evaluationResultSchema` (Zod) và type `EvaluationResult = { overallScore: number; strengths: string[]; weaknesses: string[]; matchedKeywords: string[]; missingKeywords: string[]; skillGaps: { skill: string; why: string; howToLearn: string }[]; summary: string }`.
  - Từ `lib/ai/prompt.ts`: `SYSTEM_PROMPT: string` và `buildEvaluationPrompt(cv: CvInput, jdText: string): string`.
  - Từ `lib/ai/score.ts`: `scoreColor(score: number): "red" | "yellow" | "green"`.

- [ ] **Step 1: Cài Anthropic SDK**

```bash
npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Thêm ANTHROPIC_API_KEY vào .env.example**

Thêm vào cuối `.env.example`:
```
ANTHROPIC_API_KEY="sk-ant-... (lay tai console.anthropic.com)"
```

- [ ] **Step 3: Viết test cho schema (failing)**

Create `lib/ai/__tests__/schema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { evaluationResultSchema } from "../schema";

const valid = {
  overallScore: 75,
  strengths: ["React tốt"],
  weaknesses: ["Thiếu backend"],
  matchedKeywords: ["React"],
  missingKeywords: ["Node"],
  skillGaps: [{ skill: "Node", why: "JD yêu cầu", howToLearn: "Học trên MDN" }],
  summary: "Khá phù hợp",
};

describe("evaluationResultSchema", () => {
  it("chap nhan ket qua hop le", () => {
    expect(evaluationResultSchema.safeParse(valid).success).toBe(true);
  });

  it("tu choi khi thieu summary", () => {
    const { summary, ...rest } = valid;
    expect(evaluationResultSchema.safeParse(rest).success).toBe(false);
  });

  it("tu choi diem ngoai 0-100", () => {
    expect(evaluationResultSchema.safeParse({ ...valid, overallScore: 120 }).success).toBe(false);
  });

  it("tu choi skillGap thieu howToLearn", () => {
    const bad = { ...valid, skillGaps: [{ skill: "Node", why: "x" }] };
    expect(evaluationResultSchema.safeParse(bad).success).toBe(false);
  });
});
```

- [ ] **Step 4: Chạy test xác nhận FAIL**

Run: `npx vitest run lib/ai/__tests__/schema.test.ts`
Expected: FAIL "Cannot find module '../schema'".

- [ ] **Step 5: Viết schema.ts**

Create `lib/ai/schema.ts`:
```ts
import { z } from "zod";

export const evaluationResultSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  matchedKeywords: z.array(z.string()),
  missingKeywords: z.array(z.string()),
  skillGaps: z.array(
    z.object({
      skill: z.string(),
      why: z.string(),
      howToLearn: z.string(),
    }),
  ),
  summary: z.string(),
});

export type EvaluationResult = z.infer<typeof evaluationResultSchema>;
```

- [ ] **Step 6: Chạy test xác nhận PASS**

Run: `npx vitest run lib/ai/__tests__/schema.test.ts`
Expected: 4 test PASS.

- [ ] **Step 7: Viết test cho prompt (failing)**

Create `lib/ai/__tests__/prompt.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildEvaluationPrompt, SYSTEM_PROMPT } from "../prompt";
import type { CvInput } from "@/lib/cv/types";

const cv: CvInput = {
  title: "CV",
  profile: { fullName: "Nguyễn Văn A", headline: "Dev", email: "", phone: "", summary: "Yêu code" },
  experiences: [{ company: "FPT", position: "Dev", startDate: "2023", endDate: "2024", description: "Làm web" }],
  educations: [],
  skills: [{ name: "React", level: "" }],
  projects: [],
};

describe("buildEvaluationPrompt", () => {
  it("chua thong tin CV va JD", () => {
    const p = buildEvaluationPrompt(cv, "Cần React và Node");
    expect(p).toContain("Nguyễn Văn A");
    expect(p).toContain("FPT");
    expect(p).toContain("React");
    expect(p).toContain("Cần React và Node");
  });

  it("SYSTEM_PROMPT nhac vai tro chuyen gia tuyen dung", () => {
    expect(SYSTEM_PROMPT.toLowerCase()).toContain("tuyển dụng");
  });
});
```

- [ ] **Step 8: Chạy test xác nhận FAIL**

Run: `npx vitest run lib/ai/__tests__/prompt.test.ts`
Expected: FAIL "Cannot find module '../prompt'".

- [ ] **Step 9: Viết prompt.ts**

Create `lib/ai/prompt.ts`:
```ts
import type { CvInput } from "@/lib/cv/types";

export const SYSTEM_PROMPT = `Bạn là chuyên gia tuyển dụng giàu kinh nghiệm. \
Nhiệm vụ: đánh giá mức độ phù hợp của một CV với một mô tả công việc (JD). \
Chấm điểm khách quan theo các tiêu chí: kỹ năng khớp, kinh nghiệm liên quan, \
mức độ đáp ứng yêu cầu. Trả lời hoàn toàn bằng tiếng Việt, đúng cấu trúc JSON được yêu cầu. \
overallScore là số nguyên 0-100. Với mỗi kỹ năng còn thiếu, giải thích vì sao cần và cách học.`;

function formatCv(cv: CvInput): string {
  const p = cv.profile;
  const lines: string[] = [];
  lines.push(`Họ tên: ${p.fullName}`);
  if (p.headline) lines.push(`Chức danh: ${p.headline}`);
  if (p.summary) lines.push(`Giới thiệu: ${p.summary}`);

  if (cv.experiences.length) {
    lines.push("Kinh nghiệm:");
    for (const e of cv.experiences) {
      lines.push(`- ${e.position} tại ${e.company} (${e.startDate}-${e.endDate}): ${e.description}`);
    }
  }
  if (cv.educations.length) {
    lines.push("Học vấn:");
    for (const e of cv.educations) {
      lines.push(`- ${e.school} - ${e.major} (${e.startDate}-${e.endDate})`);
    }
  }
  if (cv.skills.length) {
    lines.push("Kỹ năng: " + cv.skills.map((s) => (s.level ? `${s.name} (${s.level})` : s.name)).join(", "));
  }
  if (cv.projects.length) {
    lines.push("Dự án:");
    for (const pr of cv.projects) {
      lines.push(`- ${pr.name} (${pr.tech}): ${pr.description}`);
    }
  }
  return lines.join("\n");
}

export function buildEvaluationPrompt(cv: CvInput, jdText: string): string {
  return `=== CV ỨNG VIÊN ===
${formatCv(cv)}

=== MÔ TẢ CÔNG VIỆC (JD) ===
${jdText}

Hãy đánh giá CV trên so với JD và trả về kết quả theo đúng cấu trúc JSON yêu cầu.`;
}
```

- [ ] **Step 10: Chạy test xác nhận PASS**

Run: `npx vitest run lib/ai/__tests__/prompt.test.ts`
Expected: 2 test PASS.

- [ ] **Step 11: Viết test cho score (failing)**

Create `lib/ai/__tests__/score.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { scoreColor } from "../score";

describe("scoreColor", () => {
  it("diem thap -> red", () => {
    expect(scoreColor(30)).toBe("red");
    expect(scoreColor(49)).toBe("red");
  });
  it("diem trung binh -> yellow", () => {
    expect(scoreColor(50)).toBe("yellow");
    expect(scoreColor(74)).toBe("yellow");
  });
  it("diem cao -> green", () => {
    expect(scoreColor(75)).toBe("green");
    expect(scoreColor(100)).toBe("green");
  });
});
```

- [ ] **Step 12: Chạy test xác nhận FAIL**

Run: `npx vitest run lib/ai/__tests__/score.test.ts`
Expected: FAIL "Cannot find module '../score'".

- [ ] **Step 13: Viết score.ts**

Create `lib/ai/score.ts`:
```ts
export function scoreColor(score: number): "red" | "yellow" | "green" {
  if (score < 50) return "red";
  if (score < 75) return "yellow";
  return "green";
}
```

- [ ] **Step 14: Chạy toàn bộ test**

Run: `npm test`
Expected: tất cả test PASS.

- [ ] **Step 15: Commit**

```bash
git add lib/ai .env.example package.json package-lock.json
git commit -m "feat: add AI evaluation schema, prompt, score with tests"
```

---

### Task 3: Điều phối đánh giá `runCvEvaluation` (TDD với mock)

**Files:**
- Create: `lib/ai/evaluate.ts`
- Test: `lib/ai/__tests__/evaluate.test.ts`

**Interfaces:**
- Consumes: `EvaluationResult` từ `@/lib/ai/schema`; `buildEvaluationPrompt` từ `@/lib/ai/prompt`; `CvInput` từ `@/lib/cv/types`.
- Produces:
  - `type CvEvaluationDeps = { findCv: (cvId: string, userId: string) => Promise<CvInput | null>; requestEvaluation: (prompt: string) => Promise<EvaluationResult>; saveEvaluation: (data: SaveEvaluationInput) => Promise<{ id: string }> }`.
  - `type SaveEvaluationInput = { cvId: string; userId: string; jdText: string; jdTitle: string; jdCompany: string; result: EvaluationResult }`.
  - `type CvEvaluationParams = { cvId: string; userId: string; jdText: string; jdTitle: string; jdCompany: string }`.
  - `runCvEvaluation(params: CvEvaluationParams, deps: CvEvaluationDeps): Promise<{ ok: true; evaluationId: string; result: EvaluationResult } | { ok: false; error: string }>`.

- [ ] **Step 1: Viết test (failing)**

Create `lib/ai/__tests__/evaluate.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { runCvEvaluation } from "../evaluate";
import type { EvaluationResult } from "../schema";
import type { CvInput } from "@/lib/cv/types";

const cv: CvInput = {
  title: "CV",
  profile: { fullName: "A", headline: "", email: "", phone: "", summary: "" },
  experiences: [], educations: [], skills: [], projects: [],
};

const result: EvaluationResult = {
  overallScore: 80, strengths: [], weaknesses: [],
  matchedKeywords: [], missingKeywords: [], skillGaps: [], summary: "ok",
};

const deps = () => ({
  findCv: vi.fn().mockResolvedValue(cv),
  requestEvaluation: vi.fn().mockResolvedValue(result),
  saveEvaluation: vi.fn().mockResolvedValue({ id: "ev1" }),
});

const params = { cvId: "c1", userId: "u1", jdText: "Cần React", jdTitle: "Dev", jdCompany: "FPT" };

describe("runCvEvaluation", () => {
  it("danh gia thanh cong, luu ket qua", async () => {
    const d = deps();
    const r = await runCvEvaluation(params, d);
    expect(r).toEqual({ ok: true, evaluationId: "ev1", result });
    expect(d.saveEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({ cvId: "c1", userId: "u1", result }),
    );
  });

  it("tu choi khi JD rong", async () => {
    const d = deps();
    const r = await runCvEvaluation({ ...params, jdText: "   " }, d);
    expect(r.ok).toBe(false);
    expect(d.requestEvaluation).not.toHaveBeenCalled();
  });

  it("bao loi khi khong tim thay CV", async () => {
    const d = deps();
    d.findCv.mockResolvedValue(null);
    const r = await runCvEvaluation(params, d);
    expect(r).toEqual({ ok: false, error: "Không tìm thấy CV" });
  });

  it("bao loi khi model that bai", async () => {
    const d = deps();
    d.requestEvaluation.mockRejectedValue(new Error("boom"));
    const r = await runCvEvaluation(params, d);
    expect(r.ok).toBe(false);
    expect(d.saveEvaluation).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Chạy test xác nhận FAIL**

Run: `npx vitest run lib/ai/__tests__/evaluate.test.ts`
Expected: FAIL "Cannot find module '../evaluate'".

- [ ] **Step 3: Viết evaluate.ts**

Create `lib/ai/evaluate.ts`:
```ts
import { buildEvaluationPrompt } from "./prompt";
import type { EvaluationResult } from "./schema";
import type { CvInput } from "@/lib/cv/types";

export type SaveEvaluationInput = {
  cvId: string;
  userId: string;
  jdText: string;
  jdTitle: string;
  jdCompany: string;
  result: EvaluationResult;
};

export type CvEvaluationDeps = {
  findCv: (cvId: string, userId: string) => Promise<CvInput | null>;
  requestEvaluation: (prompt: string) => Promise<EvaluationResult>;
  saveEvaluation: (data: SaveEvaluationInput) => Promise<{ id: string }>;
};

export type CvEvaluationParams = {
  cvId: string;
  userId: string;
  jdText: string;
  jdTitle: string;
  jdCompany: string;
};

export type CvEvaluationOutcome =
  | { ok: true; evaluationId: string; result: EvaluationResult }
  | { ok: false; error: string };

export async function runCvEvaluation(
  params: CvEvaluationParams,
  deps: CvEvaluationDeps,
): Promise<CvEvaluationOutcome> {
  if (!params.jdText.trim()) {
    return { ok: false, error: "Vui lòng dán mô tả công việc" };
  }

  const cv = await deps.findCv(params.cvId, params.userId);
  if (!cv) return { ok: false, error: "Không tìm thấy CV" };

  const prompt = buildEvaluationPrompt(cv, params.jdText);

  let result: EvaluationResult;
  try {
    result = await deps.requestEvaluation(prompt);
  } catch {
    return { ok: false, error: "AI đánh giá thất bại, vui lòng thử lại" };
  }

  const saved = await deps.saveEvaluation({
    cvId: params.cvId,
    userId: params.userId,
    jdText: params.jdText,
    jdTitle: params.jdTitle,
    jdCompany: params.jdCompany,
    result,
  });

  return { ok: true, evaluationId: saved.id, result };
}
```

- [ ] **Step 4: Chạy test xác nhận PASS**

Run: `npx vitest run lib/ai/__tests__/evaluate.test.ts`
Expected: 4 test PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/evaluate.ts lib/ai/__tests__/evaluate.test.ts
git commit -m "feat: add runCvEvaluation orchestration with tests"
```

---

### Task 4: Rate limit đơn giản (TDD)

**Files:**
- Create: `lib/ai/rate-limit.ts`
- Test: `lib/ai/__tests__/rate-limit.test.ts`

**Interfaces:**
- Consumes: (không có)
- Produces: `createRateLimiter(opts: { max: number; windowMs: number }): { check: (key: string, now: number) => boolean }` — trả `true` nếu còn lượt, `false` nếu vượt hạn mức trong cửa sổ thời gian.

- [ ] **Step 1: Viết test (failing)**

Create `lib/ai/__tests__/rate-limit.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createRateLimiter } from "../rate-limit";

describe("createRateLimiter", () => {
  it("cho phep toi da 'max' lan trong cua so", () => {
    const rl = createRateLimiter({ max: 2, windowMs: 60000 });
    expect(rl.check("u1", 1000)).toBe(true);
    expect(rl.check("u1", 1100)).toBe(true);
    expect(rl.check("u1", 1200)).toBe(false); // lan 3 -> chan
  });

  it("reset sau khi qua cua so thoi gian", () => {
    const rl = createRateLimiter({ max: 1, windowMs: 1000 });
    expect(rl.check("u1", 0)).toBe(true);
    expect(rl.check("u1", 500)).toBe(false);
    expect(rl.check("u1", 1500)).toBe(true); // da qua 1000ms
  });

  it("tach biet theo key", () => {
    const rl = createRateLimiter({ max: 1, windowMs: 60000 });
    expect(rl.check("u1", 0)).toBe(true);
    expect(rl.check("u2", 0)).toBe(true);
    expect(rl.check("u1", 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test xác nhận FAIL**

Run: `npx vitest run lib/ai/__tests__/rate-limit.test.ts`
Expected: FAIL "Cannot find module '../rate-limit'".

- [ ] **Step 3: Viết rate-limit.ts**

Create `lib/ai/rate-limit.ts`:
```ts
export function createRateLimiter(opts: { max: number; windowMs: number }) {
  const hits = new Map<string, number[]>();

  return {
    check(key: string, now: number): boolean {
      const cutoff = now - opts.windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
      if (recent.length >= opts.max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
  };
}
```

- [ ] **Step 4: Chạy test xác nhận PASS**

Run: `npx vitest run lib/ai/__tests__/rate-limit.test.ts`
Expected: 3 test PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/rate-limit.ts lib/ai/__tests__/rate-limit.test.ts
git commit -m "feat: add simple in-memory rate limiter with tests"
```

---

### Task 5: Anthropic client thật + API route đánh giá

**Files:**
- Create: `lib/ai/client.ts`
- Create: `app/api/cv/[id]/evaluate/route.ts`

**Interfaces:**
- Consumes: `runCvEvaluation`, `CvEvaluationDeps` từ `@/lib/ai/evaluate`; `evaluationResultSchema`, `EvaluationResult` từ `@/lib/ai/schema`; `SYSTEM_PROMPT` từ `@/lib/ai/prompt`; `createRateLimiter` từ `@/lib/ai/rate-limit`; `prisma`, `auth`; `CvInput` từ `@/lib/cv/types`.
- Produces: `POST /api/cv/[id]/evaluate` nhận `{ jdText, jdTitle, jdCompany }`, trả `{ evaluationId, result }` hoặc `{ error }`; `requestEvaluationWithClient(prompt): Promise<EvaluationResult>` (dùng nội bộ).

- [ ] **Step 1: Viết client.ts**

Create `lib/ai/client.ts`:
```ts
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Chưa cấu hình ANTHROPIC_API_KEY");
  }
  if (!client) client = new Anthropic();
  return client;
}
```

- [ ] **Step 2: Viết API route**

Create `app/api/cv/[id]/evaluate/route.ts`:
```ts
import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { getAnthropicClient } from "@/lib/ai/client";
import { SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { evaluationResultSchema, type EvaluationResult } from "@/lib/ai/schema";
import { runCvEvaluation, type CvEvaluationDeps } from "@/lib/ai/evaluate";
import { createRateLimiter } from "@/lib/ai/rate-limit";
import type { CvInput } from "@/lib/cv/types";

export const runtime = "nodejs";

const limiter = createRateLimiter({ max: 5, windowMs: 60000 });

async function requestEvaluation(prompt: string): Promise<EvaluationResult> {
  const client = getAnthropicClient();
  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    output_config: { format: zodOutputFormat(evaluationResultSchema) },
  });
  if (!response.parsed_output) {
    throw new Error("Model không trả về kết quả hợp lệ");
  }
  return response.parsed_output;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  const userId = session.user.id;

  if (!limiter.check(userId, Date.now())) {
    return NextResponse.json(
      { error: "Bạn đánh giá quá nhanh, vui lòng thử lại sau một phút" },
      { status: 429 },
    );
  }

  let body: { jdText?: string; jdTitle?: string; jdCompany?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const deps: CvEvaluationDeps = {
    findCv: async (cvId, uid) => {
      const cv = await prisma.cV.findFirst({
        where: { id: cvId, userId: uid },
        include: {
          profile: true,
          experiences: { orderBy: { order: "asc" } },
          educations: { orderBy: { order: "asc" } },
          skills: { orderBy: { order: "asc" } },
          projects: { orderBy: { order: "asc" } },
        },
      });
      if (!cv) return null;
      const data: CvInput = {
        title: cv.title,
        profile: {
          fullName: cv.profile?.fullName ?? "",
          headline: cv.profile?.headline ?? "",
          email: cv.profile?.email ?? "",
          phone: cv.profile?.phone ?? "",
          summary: cv.profile?.summary ?? "",
        },
        experiences: cv.experiences.map((e) => ({
          company: e.company, position: e.position,
          startDate: e.startDate, endDate: e.endDate, description: e.description,
        })),
        educations: cv.educations.map((e) => ({
          school: e.school, major: e.major, startDate: e.startDate, endDate: e.endDate,
        })),
        skills: cv.skills.map((s) => ({ name: s.name, level: s.level })),
        projects: cv.projects.map((p) => ({
          name: p.name, description: p.description, tech: p.tech, link: p.link,
        })),
      };
      return data;
    },
    requestEvaluation,
    saveEvaluation: async (d) => {
      const jd = await prisma.jobDescription.create({
        data: { userId: d.userId, title: d.jdTitle, company: d.jdCompany, rawText: d.jdText },
        select: { id: true },
      });
      const ev = await prisma.evaluation.create({
        data: {
          cvId: d.cvId,
          jobDescriptionId: jd.id,
          userId: d.userId,
          overallScore: d.result.overallScore,
          strengths: d.result.strengths,
          weaknesses: d.result.weaknesses,
          matchedKeywords: d.result.matchedKeywords,
          missingKeywords: d.result.missingKeywords,
          skillGaps: d.result.skillGaps,
          summary: d.result.summary,
          rawModelOutput: d.result,
        },
        select: { id: true },
      });
      return { id: ev.id };
    },
  };

  const outcome = await runCvEvaluation(
    {
      cvId: id,
      userId,
      jdText: body.jdText ?? "",
      jdTitle: body.jdTitle ?? "",
      jdCompany: body.jdCompany ?? "",
    },
    deps,
  );

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(
    { evaluationId: outcome.evaluationId, result: outcome.result },
    { status: 201 },
  );
}
```

- [ ] **Step 3: Kiểm tra type + build**

Run: `npx tsc --noEmit && npm run build`
Expected: không lỗi type, build thành công.

- [ ] **Step 4: Commit**

```bash
git add lib/ai/client.ts app/api/cv
git commit -m "feat: add Claude client and evaluate API route"
```

---

### Task 6: Giao diện đánh giá `/cv/[id]/evaluate`

**Files:**
- Create: `app/cv/[id]/evaluate/page.tsx`
- Create: `app/cv/[id]/evaluate/EvaluateClient.tsx`
- Modify: `app/cv/[id]/CvEditor.tsx` (thêm nút "Đánh giá theo JD")

**Interfaces:**
- Consumes: `auth`, `prisma`; `scoreColor` từ `@/lib/ai/score`; `EvaluationResult` từ `@/lib/ai/schema`; component shadcn.
- Produces: luồng dán JD → gọi `/api/cv/[id]/evaluate` → hiển thị kết quả + lịch sử.

- [ ] **Step 1: Viết server component nạp CV + lịch sử**

Create `app/cv/[id]/evaluate/page.tsx`:
```tsx
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/db/prisma";
import EvaluateClient, { type PastEvaluation } from "./EvaluateClient";

export default async function EvaluatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cv = await prisma.cV.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, title: true },
  });
  if (!cv) notFound();

  const rows = await prisma.evaluation.findMany({
    where: { cvId: cv.id, userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      overallScore: true,
      summary: true,
      createdAt: true,
      jobDescription: { select: { title: true, company: true } },
    },
  });

  const history: PastEvaluation[] = rows.map((r) => ({
    id: r.id,
    overallScore: r.overallScore,
    summary: r.summary,
    createdAt: r.createdAt.toISOString(),
    jdTitle: r.jobDescription.title,
    jdCompany: r.jobDescription.company,
  }));

  return <EvaluateClient cvId={cv.id} cvTitle={cv.title} history={history} />;
}
```

- [ ] **Step 2: Viết client component**

Create `app/cv/[id]/evaluate/EvaluateClient.tsx`:
```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { scoreColor } from "@/lib/ai/score";
import type { EvaluationResult } from "@/lib/ai/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type PastEvaluation = {
  id: string;
  overallScore: number;
  summary: string;
  createdAt: string;
  jdTitle: string;
  jdCompany: string;
};

const colorClass: Record<"red" | "yellow" | "green", string> = {
  red: "text-red-600",
  yellow: "text-yellow-600",
  green: "text-green-600",
};

export default function EvaluateClient({
  cvId,
  cvTitle,
  history,
}: {
  cvId: string;
  cvTitle: string;
  history: PastEvaluation[];
}) {
  const [jdText, setJdText] = useState("");
  const [jdTitle, setJdTitle] = useState("");
  const [jdCompany, setJdCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);

  async function onEvaluate() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/cv/${cvId}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdText, jdTitle, jdCompany }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data.result as EvaluationResult);
        toast.success("Đã đánh giá xong");
      } else {
        toast.error(data.error ?? "Đánh giá thất bại");
      }
    } catch {
      toast.error("Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-4 flex items-center justify-between">
        <Link href={`/cv/${cvId}`} className="text-sm underline">← Về CV</Link>
        <h1 className="text-lg font-semibold">Đánh giá: {cvTitle}</h1>
      </div>

      <Card className="mb-4">
        <CardHeader><CardTitle>Mô tả công việc (JD)</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex gap-2">
            <Input placeholder="Tên vị trí (tuỳ chọn)" value={jdTitle} onChange={(e) => setJdTitle(e.target.value)} />
            <Input placeholder="Công ty (tuỳ chọn)" value={jdCompany} onChange={(e) => setJdCompany(e.target.value)} />
          </div>
          <div>
            <Label>Dán nội dung JD vào đây</Label>
            <Textarea rows={8} value={jdText} onChange={(e) => setJdText(e.target.value)}
              placeholder="Copy mô tả công việc từ tin tuyển dụng và dán vào..." />
          </div>
          <Button onClick={onEvaluate} disabled={loading || !jdText.trim()} className="justify-self-start">
            {loading ? "Đang đánh giá..." : "Đánh giá bằng AI"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card className="mb-4">
          <CardHeader><CardTitle>Kết quả</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="text-center">
              <div className={`text-5xl font-bold ${colorClass[scoreColor(result.overallScore)]}`}>
                {result.overallScore}
                <span className="text-xl text-gray-400">/100</span>
              </div>
              <p className="mt-2 text-gray-600">{result.summary}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="font-semibold text-green-700">Điểm mạnh</h3>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {result.strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-red-700">Điểm yếu</h3>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {result.weaknesses.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="font-semibold">Từ khóa khớp: </span>
                {result.matchedKeywords.join(", ") || "—"}
              </div>
              <div>
                <span className="font-semibold">Từ khóa còn thiếu: </span>
                {result.missingKeywords.join(", ") || "—"}
              </div>
            </div>

            {result.skillGaps.length > 0 && (
              <div>
                <h3 className="font-semibold">Kỹ năng còn thiếu & cách học</h3>
                <div className="mt-2 grid gap-2">
                  {result.skillGaps.map((g, i) => (
                    <div key={i} className="rounded border p-3 text-sm">
                      <div className="font-medium">{g.skill}</div>
                      <div className="text-gray-600">Vì sao: {g.why}</div>
                      <div className="text-gray-600">Học thế nào: {g.howToLearn}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Lịch sử đánh giá</CardTitle></CardHeader>
        <CardContent className="grid gap-2">
          {history.length === 0 && <p className="text-sm text-gray-500">Chưa có lần đánh giá nào.</p>}
          {history.map((h) => (
            <div key={h.id} className="flex items-center justify-between border-b pb-2 last:border-0 text-sm">
              <div>
                <span className={`font-bold ${colorClass[scoreColor(h.overallScore)]}`}>{h.overallScore}/100</span>
                <span className="ml-2 text-gray-600">
                  {h.jdTitle || "JD"}{h.jdCompany ? ` @ ${h.jdCompany}` : ""}
                </span>
              </div>
              <span className="text-gray-400">{new Date(h.createdAt).toLocaleDateString("vi-VN")}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 3: Thêm nút "Đánh giá theo JD" vào trình sửa CV**

Trong `app/cv/[id]/CvEditor.tsx`, tìm khối nút phía trên (chứa link "Xuất PDF" và nút "Lưu"). Thêm một link tới trang đánh giá ngay trước nút "Xuất PDF". Khối sau khi sửa:
```tsx
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
```

- [ ] **Step 4: Kiểm tra type + build**

Run: `npx tsc --noEmit && npm run build`
Expected: không lỗi type, build thành công; route `/cv/[id]/evaluate` xuất hiện.

- [ ] **Step 5: Kiểm tra thủ công (cần ANTHROPIC_API_KEY thật + đăng nhập)**

Thêm key thật vào `.env`: `ANTHROPIC_API_KEY="sk-ant-..."` (lấy ở console.anthropic.com, tài khoản mới được $5 miễn phí).
```bash
npm run dev
```
1. Đăng nhập → mở một CV đã có dữ liệu → bấm "Đánh giá theo JD".
2. Dán một JD (vd tin tuyển Frontend Developer) → bấm "Đánh giá bằng AI".
3. Sau vài giây thấy: điểm số (màu theo mức), điểm mạnh/yếu, từ khóa, skill gap, tóm tắt.
4. Tải lại trang → thấy lần đánh giá trong "Lịch sử đánh giá".
5. Bấm "Đánh giá" > 5 lần/phút → thấy thông báo giới hạn (429).

- [ ] **Step 6: Commit**

```bash
git add app/cv
git commit -m "feat: add CV evaluation page with results and history"
```

---

## Self-Review

**Spec coverage:**
- Claude API (Haiku) + structured output (`messages.parse` + Zod) → Task 2 (schema), Task 5 (route). ✓
- `ANTHROPIC_API_KEY` chỉ ở server → Task 5 (`client.ts`, route `runtime = "nodejs"`), Global Constraints. ✓
- Model `JobDescription` + `Evaluation` + quan hệ, `Json` fields, `rawModelOutput` → Task 1, Task 5 (save). ✓
- Schema kết quả (overallScore, strengths, weaknesses, matched/missingKeywords, skillGaps, summary) → Task 2. ✓
- Build prompt từ CV + JD → Task 2. ✓
- Điều phối + validate + lưu, test không tốn tiền (mock model + DB) → Task 3. ✓
- Rate limit đơn giản mỗi user → Task 4, Task 5 (áp dụng trong route). ✓
- Xử lý lỗi mềm (model lỗi, JD rỗng, thiếu key, 429) → Task 3, Task 5. ✓
- Kiểm soát quyền (userId từ session) → Task 5 (findCv theo userId, route check session), Task 6 (page). ✓
- Trang `/cv/[id]/evaluate`: ô JD, nút, hiển thị kết quả, lịch sử, loading → Task 6. ✓
- Score hiển thị màu theo mức → Task 2 (`scoreColor`), Task 6. ✓
- Test TDD cho logic thuần (schema, prompt, score, evaluate, rate-limit) → Task 2, 3, 4. ✓

*(Integration test route với model mock: cốt lõi được phủ bởi `runCvEvaluation` (Task 3, mock cả model lẫn DB — không tốn tiền). Route ở Task 5 là lớp wiring mỏng, phủ bằng type-check + build + kiểm tra thủ công — nhất quán với cách test route ở Phase 1/2.)*

**Placeholder scan:** Không có TBD/TODO; mọi step có code hoặc lệnh cụ thể. ✓

**Type consistency:** `EvaluationResult` định nghĩa ở Task 2, dùng ở Task 3, 5, 6. `CvEvaluationDeps`/`SaveEvaluationInput`/`runCvEvaluation` định nghĩa ở Task 3, dùng ở Task 5. `scoreColor` (Task 2) dùng ở Task 6. `createRateLimiter` (Task 4) dùng ở Task 5. `evaluationResultSchema` (Task 2) dùng ở Task 5 (`zodOutputFormat`). `buildEvaluationPrompt`/`SYSTEM_PROMPT` (Task 2) dùng ở Task 3, 5. `CvInput` (Phase 2) dùng ở Task 2, 3, 5. `session.user.id` (Phase 2) dùng ở Task 5, 6. ✓

**Lưu ý runtime đã tính:** Haiku KHÔNG set `effort`/`thinking` (Global Constraints); `params` là Promise (await ở Task 5, 6); route dùng `runtime = "nodejs"`; Neon IPv4 qua npm script.
