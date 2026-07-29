# Stretch: Upload PDF tự động điền CV — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho ứng viên tải PDF CV lên, AI trích xuất thông tin, tạo sẵn CV rồi mở trình sửa để xem/chỉnh.

**Architecture:** API route (`/api/cv/import`) nhận PDF, dùng `unpdf` trích text, gọi Gemini (structured output + Zod) để trích xuất `CvInput`, chuẩn hóa bằng `normalizeCv` (Phase 2), tạo CV + mục con, trả `cvId`. Client trên dashboard upload file rồi chuyển tới trình sửa CV. Logic thuần (schema, prompt) test theo TDD.

**Tech Stack:** Next.js 16, TypeScript, Prisma 6, `openai` SDK (Gemini), `unpdf`, Zod, shadcn/ui, Vitest.

## Global Constraints

- Ngôn ngữ: TypeScript, `strict`.
- AI: Gemini `gemini-2.5-flash` qua `getAiClient()` + `AI_MODEL`. **KHÔNG set `effort`/`thinking`.**
- `GEMINI_API_KEY` chỉ ở server.
- Route đọc PDF: `export const runtime = "nodejs"`.
- Chỉ user đăng nhập; CV tạo ra thuộc về họ.
- Chỉ hỗ trợ PDF có text; PDF scan ảnh → báo lỗi mềm.
- Giới hạn file ~5MB.
- Tái dùng `normalizeCv` (`@/lib/cv/normalize`) + `CvInput` (`@/lib/cv/types`) + trình sửa CV Phase 2 (không viết lại).
- Neon qua npm script khi cần lệnh DB.
- Mỗi task kết thúc bằng một commit; test cũ vẫn PASS.

---

### Task 1: `cvExtractionSchema` + `buildExtractionPrompt` (TDD) + cài unpdf

**Files:**
- Create: `lib/ai/extract.ts`
- Test: `lib/ai/__tests__/extract.test.ts`

**Interfaces:**
- Consumes: `CvInput` từ `@/lib/cv/types`.
- Produces:
  - `cvExtractionSchema` (Zod) — cấu trúc khớp `CvInput`, mọi trường là chuỗi cho phép rỗng.
  - `EXTRACTION_SYSTEM: string`.
  - `buildExtractionPrompt(text: string): string`.

- [ ] **Step 1: Cài unpdf**

```bash
npm install unpdf
```

- [ ] **Step 2: Viết test (failing)**

Create `lib/ai/__tests__/extract.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { cvExtractionSchema, buildExtractionPrompt, EXTRACTION_SYSTEM } from "../extract";

describe("cvExtractionSchema", () => {
  it("chap nhan du lieu day du", () => {
    const r = cvExtractionSchema.safeParse({
      title: "CV",
      profile: { fullName: "A", headline: "Dev", email: "a@b.com", phone: "0900", summary: "x" },
      experiences: [{ company: "FPT", position: "Dev", startDate: "2023", endDate: "2024", description: "web" }],
      educations: [{ school: "BK", major: "CNTT", startDate: "2019", endDate: "2023" }],
      skills: [{ name: "React", level: "" }],
      projects: [{ name: "P", description: "d", tech: "React", link: "" }],
    });
    expect(r.success).toBe(true);
  });

  it("chap nhan khi trong rong (cho phep chuoi rong)", () => {
    const r = cvExtractionSchema.safeParse({
      title: "",
      profile: { fullName: "", headline: "", email: "", phone: "", summary: "" },
      experiences: [],
      educations: [],
      skills: [],
      projects: [],
    });
    expect(r.success).toBe(true);
  });
});

describe("buildExtractionPrompt", () => {
  it("chua van ban dau vao + yeu cau JSON", () => {
    const p = buildExtractionPrompt("Nguyễn Văn A - Frontend Developer");
    expect(p).toContain("Nguyễn Văn A");
    expect(p.toLowerCase()).toContain("json");
  });

  it("EXTRACTION_SYSTEM nhac vai tro trich xuat", () => {
    expect(EXTRACTION_SYSTEM.toLowerCase()).toContain("trích xuất");
  });
});
```

- [ ] **Step 3: Chạy test xác nhận FAIL**

Run: `npx vitest run lib/ai/__tests__/extract.test.ts`
Expected: FAIL "Cannot find module '../extract'".

- [ ] **Step 4: Viết extract.ts**

Create `lib/ai/extract.ts`:
```ts
import { z } from "zod";
import type { CvInput } from "@/lib/cv/types";

export const cvExtractionSchema = z.object({
  title: z.string(),
  profile: z.object({
    fullName: z.string(),
    headline: z.string(),
    email: z.string(),
    phone: z.string(),
    summary: z.string(),
  }),
  experiences: z.array(
    z.object({
      company: z.string(),
      position: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      description: z.string(),
    }),
  ),
  educations: z.array(
    z.object({
      school: z.string(),
      major: z.string(),
      startDate: z.string(),
      endDate: z.string(),
    }),
  ),
  skills: z.array(z.object({ name: z.string(), level: z.string() })),
  projects: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      tech: z.string(),
      link: z.string(),
    }),
  ),
});

// Kết quả khớp cấu trúc CvInput.
export type CvExtraction = CvInput;

export const EXTRACTION_SYSTEM =
  "Bạn là trợ lý trích xuất dữ liệu CV. Từ văn bản CV, hãy trích xuất thông tin thành JSON đúng cấu trúc yêu cầu. " +
  "Để trống (chuỗi rỗng) cho trường không tìm thấy; KHÔNG bịa thông tin. Giữ nguyên tiếng Việt.";

export function buildExtractionPrompt(text: string): string {
  return `Trích xuất thông tin từ nội dung CV sau thành JSON đúng cấu trúc (title, profile, experiences, educations, skills, projects).
Nếu không có thông tin cho một trường, để chuỗi rỗng. Ngày tháng giữ dạng ngắn (vd "2023" hoặc "2023-01").

=== NỘI DUNG CV ===
${text}`;
}
```

- [ ] **Step 5: Chạy test xác nhận PASS**

Run: `npx vitest run lib/ai/__tests__/extract.test.ts`
Expected: 4 test PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/extract.ts lib/ai/__tests__/extract.test.ts package.json package-lock.json
git commit -m "feat: add CV extraction schema and prompt with tests"
```

---

### Task 2: API route `/api/cv/import`

**Files:**
- Create: `app/api/cv/import/route.ts`

**Interfaces:**
- Consumes: `getAiClient`, `AI_MODEL`; `cvExtractionSchema`, `EXTRACTION_SYSTEM`, `buildExtractionPrompt` từ `@/lib/ai/extract`; `normalizeCv` từ `@/lib/cv/normalize`; `createRateLimiter`; `prisma`, `auth`; `CvInput`.
- Produces: `POST /api/cv/import` nhận multipart `file` (PDF), trả `{ cvId }`.

- [ ] **Step 1: Viết route**

Create `app/api/cv/import/route.ts`:
```ts
import { NextResponse } from "next/server";
import { zodResponseFormat } from "openai/helpers/zod";
import { extractText, getDocumentProxy } from "unpdf";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { getAiClient, AI_MODEL } from "@/lib/ai/client";
import {
  cvExtractionSchema,
  EXTRACTION_SYSTEM,
  buildExtractionPrompt,
} from "@/lib/ai/extract";
import { normalizeCv } from "@/lib/cv/normalize";
import { createRateLimiter } from "@/lib/ai/rate-limit";
import type { CvInput } from "@/lib/cv/types";

export const runtime = "nodejs";

const limiter = createRateLimiter({ max: 5, windowMs: 60000 });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  const userId = session.user.id;

  if (!limiter.check(userId, Date.now())) {
    return NextResponse.json(
      { error: "Bạn thao tác quá nhanh, vui lòng thử lại sau" },
      { status: 429 },
    );
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: "Chưa chọn file" }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Chỉ hỗ trợ file PDF" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "File quá lớn (tối đa 5MB)" }, { status: 400 });
  }

  // Trích text từ PDF
  let text = "";
  try {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buffer);
    const res = await extractText(pdf, { mergePages: true });
    text = Array.isArray(res.text) ? res.text.join("\n") : res.text;
  } catch {
    return NextResponse.json({ error: "Không đọc được file PDF" }, { status: 400 });
  }
  if (text.trim().length < 20) {
    return NextResponse.json(
      { error: "Không đọc được nội dung; hãy dùng PDF có chữ (không phải ảnh scan)" },
      { status: 422 },
    );
  }

  // Gemini trích xuất
  let extracted: CvInput;
  try {
    const client = getAiClient();
    const completion = await client.chat.completions.parse({
      model: AI_MODEL,
      max_tokens: 4096,
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM },
        { role: "user", content: buildExtractionPrompt(text) },
      ],
      response_format: zodResponseFormat(cvExtractionSchema, "cv"),
    });
    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) throw new Error("no parse");
    extracted = parsed;
  } catch {
    return NextResponse.json(
      { error: "AI không trích xuất được, vui lòng thử lại" },
      { status: 500 },
    );
  }

  const data = normalizeCv(extracted);

  const cv = await prisma.cV.create({
    data: {
      userId,
      title: data.title || "CV nhập từ PDF",
      profile: {
        create: {
          fullName: data.profile.fullName,
          headline: data.profile.headline,
          email: data.profile.email,
          phone: data.profile.phone,
          summary: data.profile.summary,
        },
      },
      experiences: { create: data.experiences.map((e, i) => ({ ...e, order: i })) },
      educations: { create: data.educations.map((e, i) => ({ ...e, order: i })) },
      skills: { create: data.skills.map((s, i) => ({ ...s, order: i })) },
      projects: { create: data.projects.map((p, i) => ({ ...p, order: i })) },
    },
    select: { id: true },
  });

  return NextResponse.json({ cvId: cv.id }, { status: 201 });
}
```

- [ ] **Step 2: Kiểm tra type + build**

Run: `npx tsc --noEmit && npm run build`
Expected: không lỗi; route `/api/cv/import` xuất hiện.

- [ ] **Step 3: Commit**

```bash
git add app/api/cv/import/route.ts
git commit -m "feat: add PDF import API route (extract CV via Gemini)"
```

---

### Task 3: Nút "Nhập CV từ PDF" trên dashboard

**Files:**
- Create: `app/dashboard/ImportCvButton.tsx`
- Modify: `app/dashboard/page.tsx` (thêm nút vào nhánh ứng viên)

**Interfaces:**
- Consumes: API `/api/cv/import`; `Button` từ shadcn; `useRouter`.
- Produces: `<ImportCvButton />` (client) — chọn file PDF, upload, chuyển tới trình sửa CV.

- [ ] **Step 1: Viết client component**

Create `app/dashboard/ImportCvButton.tsx`:
```tsx
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ImportCvButton() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/cv/import", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) {
        toast.success("Đã đọc CV, hãy kiểm tra lại");
        router.push(`/cv/${data.cvId}`);
      } else {
        toast.error(data.error ?? "Nhập PDF thất bại");
      }
    } catch {
      toast.error("Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={onFile}
      />
      <Button
        variant="outline"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mr-1 h-4 w-4" />
        {loading ? "Đang đọc PDF..." : "Nhập CV từ PDF"}
      </Button>
    </>
  );
}
```

- [ ] **Step 2: Thêm nút vào dashboard (nhánh ứng viên)**

Trong `app/dashboard/page.tsx`:

(a) Thêm import ở đầu (sau các import component):
```tsx
import ImportCvButton from "./ImportCvButton";
```

(b) Trong **nhánh ứng viên** (không phải nhánh recruiter), tìm khối nút "Tạo CV mới" và bọc thêm nút nhập. Đổi:
```tsx
          <form action={createCv}>
            <Button type="submit"><Plus className="mr-1 h-4 w-4" /> Tạo CV mới</Button>
          </form>
```
thành:
```tsx
          <div className="flex gap-2">
            <ImportCvButton />
            <form action={createCv}>
              <Button type="submit"><Plus className="mr-1 h-4 w-4" /> Tạo CV mới</Button>
            </form>
          </div>
```
> Lưu ý: chỉ đổi khối "Tạo CV mới" ở **nhánh ứng viên** (khối thứ hai trong file, sau `const cvs = ...`), KHÔNG đổi khối "Đăng JD" ở nhánh recruiter.

- [ ] **Step 3: Kiểm tra type + build + test**

Run: `npx tsc --noEmit && npm run build && npm test`
Expected: build sạch; route `/api/cv/import` có; test **44/44 PASS** (40 cũ + 4 mới ở Task 1).

- [ ] **Step 4: Kiểm tra thủ công (cần GEMINI_API_KEY + đăng nhập)**

```bash
npm run dev
```
1. Đăng nhập tài khoản ứng viên → dashboard → bấm "Nhập CV từ PDF".
2. Chọn một file CV PDF (có chữ, không phải ảnh scan).
3. Chờ "Đang đọc PDF..." → tự chuyển sang trình sửa CV với thông tin đã điền.
4. Kiểm tra/chỉnh → Lưu.
5. Thử file không phải PDF / PDF ảnh → thấy thông báo lỗi thân thiện.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard
git commit -m "feat: add Import CV from PDF button to dashboard"
```

---

## Self-Review

**Spec coverage:**
- Trích text PDF bằng `unpdf` → Task 2. ✓
- Gemini structured output (`cvExtractionSchema`) → Task 1 (schema), Task 2 (gọi). ✓
- `normalizeCv` (Phase 2) → Task 2. ✓
- Tạo CV + mục con, thuộc user → Task 2. ✓
- Mở trình sửa CV (Phase 2) đã điền → Task 3 (redirect `/cv/[id]`). ✓
- Nút "Nhập CV từ PDF" trên dashboard ứng viên → Task 3. ✓
- Xử lý lỗi (không phải PDF, quá lớn, không có text, Gemini lỗi, 429) → Task 2. ✓
- Chỉ user đăng nhập; CV thuộc họ → Task 2. ✓
- Rate limit → Task 2. ✓
- TDD schema + prompt → Task 1. ✓

**Placeholder scan:** Không có TBD/TODO; mọi step có code/lệnh cụ thể. ✓

**Type consistency:** `cvExtractionSchema`/`EXTRACTION_SYSTEM`/`buildExtractionPrompt` định nghĩa Task 1, dùng Task 2. Kết quả trích xuất kiểu `CvInput` → hợp `normalizeCv(input: CvInput)` và prisma nested create (các mục con khớp trường Phase 2). `ImportCvButton` (Task 3) gọi `/api/cv/import` (Task 2) trả `{ cvId }`. ✓

**Lưu ý runtime đã tính:** route `runtime = "nodejs"` (unpdf + prisma); Gemini không set `effort`/`thinking`; `zodResponseFormat` với Zod v4 (đã chạy tốt ở Phase 3); normalizeCv giữ profile, lọc mục con rỗng; live test có thể dùng PDF sinh từ react-pdf (Phase 2) vì có text thật.
