# CV Enhancements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm 3 tính năng: nhiều phiên bản CV (tối đa 3/ứng viên), link CV công khai, và tab Phân tích AI trong CvEditor.

**Architecture:** Schema thêm 2 cột (`isDefault`, `shareToken`) trên model `CV` hiện có. Server actions mới trong `lib/cv/actions.ts` xử lý guard giới hạn, set-default, enable/disable share. Public page `/cv/share/[token]` (no auth) dùng lại `CvPreview`. Tab "Phân tích" trong `CvEditor` gọi endpoint `POST /api/cv/[id]/analyze` trả JSON qua Gemini.

**Tech Stack:** Next.js App Router, Prisma 6, Gemini 2.5 Flash (OpenAI-compat SDK), Zod, Node crypto (built-in, không thêm dep mới)

## Global Constraints

- Prisma version: 6 — không dùng API của v7
- Không thêm npm dependency mới (dùng Node built-in `crypto` cho token)
- Tất cả màu dùng design token (`primary`, `muted`, `border`...) — không hardcode `blue-*`/`slate-*`
- AI: Gemini 2.5 Flash qua `getAiClient()` + `AI_MODEL` từ `lib/ai/client.ts`
- Server actions dùng `"use server"` directive
- Mọi route API Next.js dùng `export const runtime = "nodejs"`
- Giới hạn CV: CANDIDATE tối đa 3, kiểm tra trong code (không dùng DB constraint)
- `shareToken`: 12 ký tự base64url từ `crypto.randomBytes(9).toString('base64url')`

---

## File Structure

| File | Tạo/Sửa | Trách nhiệm |
|---|---|---|
| `prisma/schema.prisma` | Sửa | Thêm `isDefault`, `shareToken` vào model CV |
| `lib/cv/actions.ts` | Sửa | createCv (guard), renameCv, setDefaultCv, deleteCv (guard), enableShare, disableShare |
| `lib/cv/__tests__/cv-actions-multi.test.ts` | Tạo | Unit tests cho actions mới |
| `app/dashboard/CvCard.tsx` | Tạo | Client component: card 1 CV + menu ⋮ |
| `app/dashboard/page.tsx` | Sửa | CV section: grid cards + nút tạo mới + đếm giới hạn |
| `app/jobs/[id]/apply/page.tsx` | Sửa | Query CV kèm `isDefault`, sort isDefault trước |
| `app/jobs/[id]/apply/ApplyForm.tsx` | Sửa | Default select CV có `isDefault = true` |
| `app/cv/share/[token]/page.tsx` | Tạo | Public profile page (no auth) |
| `app/api/cv/share/[token]/pdf/route.tsx` | Tạo | PDF qua shareToken, no auth |
| `app/cv/[id]/CvEditor.tsx` | Sửa | Thêm nút Chia sẻ + tab Phân tích |
| `app/api/cv/[id]/analyze/route.ts` | Tạo | POST endpoint AI analyze CV |
| `components/cv/CvAnalysis.tsx` | Tạo | Client component: panel phân tích AI |

---

## Task 1: Schema migration — thêm `isDefault` và `shareToken` vào CV

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `CV.isDefault: Boolean`, `CV.shareToken: String?` — dùng bởi tất cả tasks sau

- [ ] **Step 1: Sửa schema**

Trong `prisma/schema.prisma`, tìm model `CV` và thêm 2 dòng sau `font`:

```prisma
model CV {
  id          String       @id @default(cuid())
  userId      String
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  title       String       @default("CV chưa đặt tên")
  template    String       @default("classic")
  accent      String       @default("indigo")
  font        String       @default("roboto")
  isDefault   Boolean      @default(false)
  shareToken  String?      @unique
  profile        Profile?
  experiences    Experience[]
  educations     Education[]
  skills         Skill[]
  projects       Project[]
  languages      Language[]
  certifications Certification[]
  evaluations Evaluation[]
  applications Application[]
  chatSessions ChatSession[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}
```

- [ ] **Step 2: Tạo migration**

```bash
npx prisma migrate dev --name add_cv_isdefault_sharetoken
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 3: Generate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add isDefault and shareToken to CV"
```

---

## Task 2: CV management server actions + tests

**Files:**
- Modify: `lib/cv/actions.ts`
- Create: `lib/cv/__tests__/cv-actions-multi.test.ts`

**Interfaces:**
- Consumes: `prisma.cV`, `requireUser` từ `lib/auth/session`, `CACHE_TAGS` từ `lib/cache/tags`
- Produces:
  - `createCv(name?: string, template?: string): Promise<void>` — redirect `/cv/[id]` hoặc throw nếu ≥3 CV
  - `renameCv(id: string, title: string): Promise<{ ok: boolean; error?: string }>`
  - `setDefaultCv(id: string): Promise<{ ok: boolean; error?: string }>`
  - `deleteCv(formData: FormData): Promise<void>` — giữ signature cũ, thêm guards
  - `enableShare(id: string): Promise<{ ok: boolean; token?: string; error?: string }>`
  - `disableShare(id: string): Promise<{ ok: boolean; error?: string }>`

- [ ] **Step 1: Viết test trước (TDD)**

Tạo file `lib/cv/__tests__/cv-actions-multi.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma và auth
vi.mock("@/lib/db/prisma", () => ({
  default: {
    cV: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    application: {
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth/session", () => ({
  requireUser: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/cache/tags", () => ({
  CACHE_TAGS: { cv: "cv", dashboard: "dashboard" },
}));

import prisma from "@/lib/db/prisma";
import { renameCv, setDefaultCv, enableShare, disableShare } from "@/lib/cv/actions";

const mockPrisma = prisma as unknown as {
  cV: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  application: { count: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

beforeEach(() => vi.clearAllMocks());

describe("renameCv", () => {
  it("returns error if CV not owned", async () => {
    mockPrisma.cV.findFirst.mockResolvedValue(null);
    const result = await renameCv("cv-1", "Tên mới");
    expect(result).toEqual({ ok: false, error: "Không tìm thấy CV" });
  });

  it("updates title when owned", async () => {
    mockPrisma.cV.findFirst.mockResolvedValue({ id: "cv-1" });
    mockPrisma.cV.update.mockResolvedValue({});
    const result = await renameCv("cv-1", "Tên mới");
    expect(result).toEqual({ ok: true });
    expect(mockPrisma.cV.update).toHaveBeenCalledWith({
      where: { id: "cv-1" },
      data: { title: "Tên mới" },
    });
  });
});

describe("setDefaultCv", () => {
  it("returns error if CV not owned", async () => {
    mockPrisma.cV.findFirst.mockResolvedValue(null);
    const result = await setDefaultCv("cv-1");
    expect(result).toEqual({ ok: false, error: "Không tìm thấy CV" });
  });

  it("unsets all then sets target via transaction", async () => {
    mockPrisma.cV.findFirst.mockResolvedValue({ id: "cv-1" });
    const txFn = vi.fn();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        cV: {
          updateMany: txFn,
          update: txFn,
        },
      };
      return fn(tx);
    });
    const result = await setDefaultCv("cv-1");
    expect(result).toEqual({ ok: true });
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });
});

describe("enableShare", () => {
  it("returns error if CV not owned", async () => {
    mockPrisma.cV.findFirst.mockResolvedValue(null);
    const result = await enableShare("cv-1");
    expect(result).toEqual({ ok: false, error: "Không tìm thấy CV" });
  });

  it("generates token and saves", async () => {
    mockPrisma.cV.findFirst.mockResolvedValue({ id: "cv-1" });
    mockPrisma.cV.update.mockResolvedValue({ shareToken: "abc123def456" });
    const result = await enableShare("cv-1");
    expect(result.ok).toBe(true);
    expect(typeof result.token).toBe("string");
    expect(result.token!.length).toBe(12);
  });
});

describe("disableShare", () => {
  it("sets shareToken null when owned", async () => {
    mockPrisma.cV.findFirst.mockResolvedValue({ id: "cv-1" });
    mockPrisma.cV.update.mockResolvedValue({});
    const result = await disableShare("cv-1");
    expect(result).toEqual({ ok: true });
    expect(mockPrisma.cV.update).toHaveBeenCalledWith({
      where: { id: "cv-1" },
      data: { shareToken: null },
    });
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

```bash
npx vitest run lib/cv/__tests__/cv-actions-multi.test.ts
```

Expected: FAIL — `renameCv is not a function` (chưa implement)

- [ ] **Step 3: Cập nhật `lib/cv/actions.ts`**

Thay toàn bộ nội dung file:

```typescript
"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/tags";
import prisma from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { cvSchema } from "./schema";
import { normalizeCv } from "./normalize";
import type { CvInput } from "./types";
import { normalizeTemplate, type CvTemplate } from "./templates";
import { normalizeAccent, type CvAccent } from "./accents";
import { normalizeFont, type CvFont } from "./fonts";

const CV_LIMIT = 3;

async function requireUserId(): Promise<string> {
  const session = await requireUser();
  return session.user.id;
}

export async function createCv(_formData?: FormData): Promise<void> {
  const userId = await requireUserId();
  const count = await prisma.cV.count({ where: { userId } });
  if (count >= CV_LIMIT) {
    throw new Error(`Đã đạt giới hạn ${CV_LIMIT} CV`);
  }
  const isFirst = count === 0;
  const cv = await prisma.cV.create({
    data: {
      userId,
      title: "CV chưa đặt tên",
      isDefault: isFirst,
      profile: { create: { fullName: "" } },
    },
    select: { id: true },
  });
  redirect(`/cv/${cv.id}`);
}

export async function renameCv(
  id: string,
  title: string,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  const owned = await prisma.cV.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) return { ok: false, error: "Không tìm thấy CV" };
  await prisma.cV.update({ where: { id }, data: { title: title.trim() || "CV chưa đặt tên" } });
  revalidateTag(CACHE_TAGS.dashboard, "max");
  return { ok: true };
}

export async function setDefaultCv(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  const owned = await prisma.cV.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) return { ok: false, error: "Không tìm thấy CV" };
  await prisma.$transaction([
    prisma.cV.updateMany({ where: { userId }, data: { isDefault: false } }),
    prisma.cV.update({ where: { id }, data: { isDefault: true } }),
  ]);
  revalidateTag(CACHE_TAGS.dashboard, "max");
  return { ok: true };
}

export async function deleteCv(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");

  const cv = await prisma.cV.findFirst({
    where: { id, userId },
    select: { id: true, isDefault: true },
  });
  if (!cv) return;

  if (cv.isDefault) {
    const otherCount = await prisma.cV.count({ where: { userId, id: { not: id } } });
    if (otherCount > 0) {
      // Không cho xóa CV mặc định khi còn CV khác
      return;
    }
  }

  await prisma.cV.deleteMany({ where: { id, userId } });
  revalidateTag(CACHE_TAGS.dashboard, "max");
}

export async function enableShare(
  id: string,
): Promise<{ ok: boolean; token?: string; error?: string }> {
  const userId = await requireUserId();
  const owned = await prisma.cV.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) return { ok: false, error: "Không tìm thấy CV" };
  const token = randomBytes(9).toString("base64url");
  await prisma.cV.update({ where: { id }, data: { shareToken: token } });
  revalidateTag(CACHE_TAGS.cv, "max");
  return { ok: true, token };
}

export async function disableShare(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  const owned = await prisma.cV.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) return { ok: false, error: "Không tìm thấy CV" };
  await prisma.cV.update({ where: { id }, data: { shareToken: null } });
  revalidateTag(CACHE_TAGS.cv, "max");
  return { ok: true };
}

export async function saveCv(
  cvId: string,
  input: CvInput,
  template?: CvTemplate,
  accent?: CvAccent,
  font?: CvFont,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();

  const owned = await prisma.cV.findFirst({
    where: { id: cvId, userId },
    select: { id: true },
  });
  if (!owned) return { ok: false, error: "Không tìm thấy CV" };

  const data = normalizeCv(input);
  const parsed = cvSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  await prisma.$transaction(async (tx) => {
    await tx.cV.update({
      where: { id: cvId },
      data: {
        title: data.title || "CV chưa đặt tên",
        template: normalizeTemplate(template),
        accent: normalizeAccent(accent),
        font: normalizeFont(font),
      },
    });
    await tx.profile.upsert({
      where: { cvId },
      create: { cvId, ...data.profile },
      update: { ...data.profile },
    });

    await tx.experience.deleteMany({ where: { cvId } });
    await tx.experience.createMany({
      data: data.experiences.map((e, i) => ({ ...e, cvId, order: i })),
    });

    await tx.education.deleteMany({ where: { cvId } });
    await tx.education.createMany({
      data: data.educations.map((e, i) => ({ ...e, cvId, order: i })),
    });

    await tx.skill.deleteMany({ where: { cvId } });
    await tx.skill.createMany({
      data: data.skills.map((s, i) => ({ ...s, cvId, order: i })),
    });

    await tx.project.deleteMany({ where: { cvId } });
    await tx.project.createMany({
      data: data.projects.map((p, i) => ({ ...p, cvId, order: i })),
    });

    await tx.language.deleteMany({ where: { cvId } });
    await tx.language.createMany({
      data: data.languages.map((l, i) => ({ ...l, cvId, order: i })),
    });

    await tx.certification.deleteMany({ where: { cvId } });
    await tx.certification.createMany({
      data: data.certifications.map((c, i) => ({ ...c, cvId, order: i })),
    });
  });

  revalidateTag(CACHE_TAGS.cv, "max");
  revalidateTag(CACHE_TAGS.dashboard, "max");
  return { ok: true };
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

```bash
npx vitest run lib/cv/__tests__/cv-actions-multi.test.ts
```

Expected: tất cả tests PASS

- [ ] **Step 5: Chạy toàn bộ test suite**

```bash
npx vitest run
```

Expected: tất cả tests pass, không có regression

- [ ] **Step 6: Commit**

```bash
git add lib/cv/actions.ts lib/cv/__tests__/cv-actions-multi.test.ts
git commit -m "feat(cv): multi-CV actions — guard, rename, setDefault, share"
```

---

## Task 3: Dashboard CV cards

**Files:**
- Create: `app/dashboard/CvCard.tsx`
- Modify: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `renameCv`, `setDefaultCv`, `deleteCv`, `enableShare`, `disableShare` từ `lib/cv/actions`
- Produces: `<CvCard>` component cho mỗi CV trong grid

- [ ] **Step 1: Tạo `app/dashboard/CvCard.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FileText, Star, Share2, MoreVertical, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { renameCv, setDefaultCv, deleteCv, enableShare, disableShare } from "@/lib/cv/actions";

type CvCardProps = {
  id: string;
  title: string;
  template: string;
  updatedAt: Date;
  isDefault: boolean;
  shareToken: string | null;
};

export default function CvCard({ id, title, template, updatedAt, isDefault, shareToken }: CvCardProps) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(title);
  const [token, setToken] = useState<string | null>(shareToken);
  const [copied, setCopied] = useState(false);

  const shareUrl = token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/cv/share/${token}`
    : null;

  function copyShareUrl() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleRename() {
    if (!editing) { setEditing(true); return; }
    startTransition(async () => {
      const r = await renameCv(id, nameValue);
      if (r.ok) { setEditing(false); toast.success("Đã đổi tên CV"); }
      else toast.error(r.error);
    });
  }

  function handleSetDefault() {
    startTransition(async () => {
      const r = await setDefaultCv(id);
      if (!r.ok) toast.error(r.error);
      else toast.success("Đã đặt làm CV mặc định");
    });
  }

  function handleToggleShare() {
    startTransition(async () => {
      if (token) {
        const r = await disableShare(id);
        if (r.ok) { setToken(null); toast.success("Đã tắt chia sẻ"); }
        else toast.error(r.error);
      } else {
        const r = await enableShare(id);
        if (r.ok && r.token) { setToken(r.token); toast.success("Đã bật chia sẻ"); }
        else toast.error(r.error);
      }
    });
  }

  function handleDelete() {
    if (isDefault) {
      toast.error("Hãy đặt CV khác làm mặc định trước khi xóa CV này");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.append("id", id);
      await deleteCv(fd);
      toast.success("Đã xóa CV");
    });
  }

  return (
    <Card className="border-border transition-colors hover:border-primary/40">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/cv/${id}`} className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              {editing ? (
                <input
                  autoFocus
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setEditing(false); }}
                  onClick={(e) => e.preventDefault()}
                  className="block w-full rounded border border-input bg-background px-2 py-0.5 text-sm font-medium text-foreground"
                />
              ) : (
                <span className="block truncate font-medium text-foreground hover:text-primary">
                  {nameValue}
                </span>
              )}
              <span className="block text-xs text-muted-foreground">
                {template} · Sửa {new Date(updatedAt).toLocaleDateString("vi-VN")}
              </span>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-1">
            {isDefault && (
              <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <Star className="h-3 w-3" /> Mặc định
              </span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pending}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleRename}>
                  {editing ? "Lưu tên" : "Đổi tên"}
                </DropdownMenuItem>
                {!isDefault && (
                  <DropdownMenuItem onClick={handleSetDefault}>
                    Đặt làm mặc định
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleToggleShare}>
                  {token ? "Tắt chia sẻ" : "Bật chia sẻ"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  Xóa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Share URL row */}
        {token && shareUrl && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
            <Share2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{shareUrl}</span>
            <button onClick={copyShareUrl} className="shrink-0 text-primary hover:text-primary/80">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Cập nhật `app/dashboard/page.tsx` — phần candidate**

Tìm đoạn `const cvs = await prisma.cV.findMany(...)` trong branch candidate (dòng ~89) và thay toàn bộ phần return của candidate:

```tsx
  // Thay query cvs cũ:
  const cvs = await prisma.cV.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: { id: true, title: true, template: true, updatedAt: true, isDefault: true, shareToken: true },
  });
  const cvCount = cvs.length;
  const atLimit = cvCount >= 3;
```

Thay phần return của candidate:

```tsx
  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">CV của bạn</h1>
            <p className="text-sm text-muted-foreground">Xin chào, {session.user.name}</p>
          </div>
          <div className="flex gap-2">
            <ImportCvButton />
            {!atLimit ? (
              <form action={createCv}>
                <Button type="submit"><Plus className="mr-1 h-4 w-4" /> Tạo CV mới</Button>
              </form>
            ) : (
              <Button disabled title="Đã đạt giới hạn 3 CV">
                <Plus className="mr-1 h-4 w-4" /> Tạo CV mới ({cvCount}/3)
              </Button>
            )}
          </div>
        </div>
        <CandidateStats userId={session.user.id} />
        <div className="flex flex-col gap-3">
          {cvs.length === 0 && (
            <EmptyState
              icon={<FileText className="h-10 w-10" />}
              title="Chưa có CV nào"
              description={'Bấm "Tạo CV mới" để tạo CV đầu tiên của bạn.'}
            />
          )}
          {cvs.map((cv) => (
            <CvCard
              key={cv.id}
              id={cv.id}
              title={cv.title}
              template={cv.template}
              updatedAt={cv.updatedAt}
              isDefault={cv.isDefault}
              shareToken={cv.shareToken}
            />
          ))}
        </div>
      </main>
    </div>
  );
```

Thêm import `CvCard` vào đầu file:

```tsx
import CvCard from "./CvCard";
```

- [ ] **Step 3: Chạy test**

```bash
npx vitest run
```

Expected: tất cả pass

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/CvCard.tsx app/dashboard/page.tsx
git commit -m "feat(dashboard): CV card grid với menu đổi tên, mặc định, share, xóa"
```

---

## Task 4: Cập nhật form ứng tuyển — default theo `isDefault`

**Files:**
- Modify: `app/jobs/[id]/apply/page.tsx`
- Modify: `app/jobs/[id]/apply/ApplyForm.tsx`

**Interfaces:**
- Consumes: `CV.isDefault` từ Task 1
- Produces: `ApplyForm` nhận thêm `defaultCvId: string`

- [ ] **Step 1: Sửa `app/jobs/[id]/apply/page.tsx`**

Thay query CVs (dòng ~31):

```tsx
  const cvs = await prisma.cV.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: { id: true, title: true, isDefault: true },
  });
  const defaultCvId = cvs.find((c) => c.isDefault)?.id ?? cvs[0]?.id ?? "";
```

Thay dòng `<ApplyForm jobId={job.id} cvs={cvs} />`:

```tsx
<ApplyForm jobId={job.id} cvs={cvs} defaultCvId={defaultCvId} />
```

- [ ] **Step 2: Sửa `app/jobs/[id]/apply/ApplyForm.tsx`**

Thêm prop `defaultCvId` và dùng làm giá trị khởi tạo:

```tsx
export default function ApplyForm({
  jobId,
  cvs,
  defaultCvId,
}: {
  jobId: string;
  cvs: { id: string; title: string; isDefault: boolean }[];
  defaultCvId: string;
}) {
  const [cvId, setCvId] = useState(defaultCvId);
  // ... giữ nguyên phần còn lại
```

- [ ] **Step 3: Chạy test**

```bash
npx vitest run
```

Expected: pass

- [ ] **Step 4: Commit**

```bash
git add app/jobs/[id]/apply/page.tsx app/jobs/[id]/apply/ApplyForm.tsx
git commit -m "feat(apply): default CV selection follows isDefault flag"
```

---

## Task 5: Public CV page + PDF route

**Files:**
- Create: `app/cv/share/[token]/page.tsx`
- Create: `app/api/cv/share/[token]/pdf/route.tsx`

**Interfaces:**
- Consumes: `CV.shareToken`, `CvPreview` từ `components/cv/CvPreview`, `loadCvInput` từ `lib/cv/load`, `CvDocument` từ `lib/pdf/CvDocument`

- [ ] **Step 1: Tạo `app/cv/share/[token]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { Mail, Phone, Linkedin, Globe, Download } from "lucide-react";
import prisma from "@/lib/db/prisma";
import { loadCvInput } from "@/lib/cv/load";
import { normalizeTemplate } from "@/lib/cv/templates";
import { normalizeAccent } from "@/lib/cv/accents";
import { normalizeFont } from "@/lib/cv/fonts";
import CvPreview from "@/components/cv/CvPreview";
import { CompanyAvatar } from "@/components/CompanyAvatar";
import { buttonVariants } from "@/components/ui/button";

export default async function ShareCvPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const cv = await prisma.cV.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      userId: true,
      title: true,
      template: true,
      accent: true,
      font: true,
      profile: {
        select: {
          fullName: true,
          headline: true,
          email: true,
          phone: true,
          linkedin: true,
          portfolio: true,
        },
      },
    },
  });

  if (!cv) notFound();

  const cvInput = await loadCvInput(cv.id, cv.userId);
  if (!cvInput) notFound();

  const profile = cv.profile;
  const displayName = profile?.fullName || cv.title;

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header hồ sơ */}
      <div className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <CompanyAvatar name={displayName} size="lg" />
            <div>
              <h1 className="text-xl font-bold text-foreground">{displayName}</h1>
              {profile?.headline && (
                <p className="text-sm text-muted-foreground">{profile.headline}</p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {profile?.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> {profile.email}
                  </span>
                )}
                {profile?.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> {profile.phone}
                  </span>
                )}
                {profile?.linkedin && (
                  <a
                    href={profile.linkedin.startsWith("http") ? profile.linkedin : `https://${profile.linkedin}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-primary"
                  >
                    <Linkedin className="h-3.5 w-3.5" /> LinkedIn
                  </a>
                )}
                {profile?.portfolio && (
                  <a
                    href={profile.portfolio.startsWith("http") ? profile.portfolio : `https://${profile.portfolio}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-primary"
                  >
                    <Globe className="h-3.5 w-3.5" /> Portfolio
                  </a>
                )}
              </div>
            </div>
          </div>
          <a
            href={`/api/cv/share/${token}/pdf`}
            className={buttonVariants({ variant: "outline" })}
          >
            <Download className="mr-2 h-4 w-4" /> Tải PDF
          </a>
        </div>
      </div>

      {/* CV Preview */}
      <div className="mx-auto max-w-4xl px-4 py-8">
        <CvPreview
          cv={cvInput}
          template={normalizeTemplate(cv.template)}
          accent={normalizeAccent(cv.accent)}
          font={normalizeFont(cv.font)}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Tạo `app/api/cv/share/[token]/pdf/route.tsx`**

```tsx
import { renderToBuffer } from "@react-pdf/renderer";
import { notFound } from "next/navigation";
import prisma from "@/lib/db/prisma";
import { loadCvInput } from "@/lib/cv/load";
import { CvDocument } from "@/lib/pdf/CvDocument";
import { normalizeTemplate } from "@/lib/cv/templates";
import { normalizeAccent } from "@/lib/cv/accents";
import { normalizeFont } from "@/lib/cv/fonts";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const cv = await prisma.cV.findUnique({
    where: { shareToken: token },
    select: { id: true, userId: true, title: true, template: true, accent: true, font: true },
  });
  if (!cv) return new Response("Không tìm thấy CV", { status: 404 });

  const data = await loadCvInput(cv.id, cv.userId);
  if (!data) return new Response("Không tìm thấy CV", { status: 404 });

  const buffer = await renderToBuffer(
    <CvDocument
      cv={data}
      template={normalizeTemplate(cv.template)}
      accent={normalizeAccent(cv.accent)}
      font={normalizeFont(cv.font)}
    />,
  );
  const safeTitle = (cv.title || "cv").replace(/[^a-zA-Z0-9-_]+/g, "_");
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeTitle}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
```

- [ ] **Step 3: Chạy test**

```bash
npx vitest run
```

Expected: pass

- [ ] **Step 4: Commit**

```bash
git add app/cv/share/ app/api/cv/share/
git commit -m "feat(cv): public share page /cv/share/[token] + PDF route"
```

---

## Task 6: Nút Chia sẻ trong CvEditor

**Files:**
- Modify: `app/cv/[id]/CvEditor.tsx`
- Modify: `app/cv/[id]/page.tsx`

**Interfaces:**
- Consumes: `enableShare`, `disableShare` từ `lib/cv/actions`, `CV.shareToken` từ page

- [ ] **Step 1: Cập nhật `app/cv/[id]/page.tsx`** — truyền `shareToken` xuống editor

Thay query `cv`:

```tsx
  const [initial, cv] = await Promise.all([
    loadCvInput(id, session.user.id),
    prisma.cV.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, template: true, accent: true, font: true, shareToken: true },
    }),
  ]);
```

Thêm prop `initialShareToken` vào `<CvEditor>`:

```tsx
  return (
    <CvEditor
      cvId={cv.id}
      initial={initial}
      initialTemplate={normalizeTemplate(cv.template)}
      initialAccent={normalizeAccent(cv.accent)}
      initialFont={normalizeFont(cv.font)}
      initialShareToken={cv.shareToken ?? null}
    />
  );
```

- [ ] **Step 2: Cập nhật `app/cv/[id]/CvEditor.tsx`** — thêm prop và nút chia sẻ

Thêm `initialShareToken` vào props type và state:

```tsx
export default function CvEditor({
  cvId,
  initial,
  initialTemplate,
  initialAccent,
  initialFont,
  initialShareToken,
}: {
  cvId: string;
  initial: CvInput;
  initialTemplate: CvTemplate;
  initialAccent: CvAccent;
  initialFont: CvFont;
  initialShareToken: string | null;
}) {
  // ... state hiện có ...
  const [shareToken, setShareToken] = useState<string | null>(initialShareToken);
  const [sharePending, startShareTransition] = useTransition();
  const [copied, setCopied] = useState(false);
```

Thêm import:

```tsx
import { enableShare, disableShare } from "@/lib/cv/actions";
import { Share2, Copy, Check } from "lucide-react";
```

Thêm handlers sau `onSave`:

```tsx
  function onToggleShare() {
    startShareTransition(async () => {
      if (shareToken) {
        const r = await disableShare(cvId);
        if (r.ok) { setShareToken(null); toast.success("Đã tắt chia sẻ"); }
        else toast.error(r.error);
      } else {
        const r = await enableShare(cvId);
        if (r.ok && r.token) { setShareToken(r.token); toast.success("Đã bật chia sẻ"); }
        else toast.error(r.error);
      }
    });
  }

  function onCopyShareUrl() {
    if (!shareToken) return;
    const url = `${window.location.origin}/cv/share/${shareToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
```

Thêm nút Chia sẻ vào thanh hành động (sau nút "Xuất PDF", trước nút "Lưu"):

```tsx
            <Button
              size="sm"
              variant="outline"
              onClick={onToggleShare}
              disabled={sharePending}
            >
              <Share2 className="mr-1 h-4 w-4" />
              {shareToken ? "Tắt chia sẻ" : "Chia sẻ"}
            </Button>
            {shareToken && (
              <Button size="sm" variant="ghost" onClick={onCopyShareUrl} title="Sao chép link">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            )}
```

- [ ] **Step 3: Chạy test**

```bash
npx vitest run
```

Expected: pass

- [ ] **Step 4: Commit**

```bash
git add app/cv/[id]/CvEditor.tsx app/cv/[id]/page.tsx
git commit -m "feat(cv-editor): thêm nút Chia sẻ + copy link vào thanh hành động"
```

---

## Task 7: AI analyze endpoint

**Files:**
- Create: `app/api/cv/[id]/analyze/route.ts`

**Interfaces:**
- Consumes: `getAiClient`, `AI_MODEL` từ `lib/ai/client`, `loadCvInput` từ `lib/cv/load`
- Produces: `POST /api/cv/[id]/analyze` → `{ score: number, sections: { name, status, tip }[] }`

- [ ] **Step 1: Tạo `app/api/cv/[id]/analyze/route.ts`**

```typescript
import { z } from "zod";
import { auth } from "@/auth";
import prisma from "@/lib/db/prisma";
import { getAiClient, AI_MODEL } from "@/lib/ai/client";
import { loadCvInput } from "@/lib/cv/load";
import { checkRateLimit } from "@/lib/security/ratelimit";

export const runtime = "nodejs";

const analyzeResponseSchema = z.object({
  score: z.number().int().min(0).max(100),
  sections: z.array(
    z.object({
      name: z.string(),
      status: z.enum(["ok", "warning", "error"]),
      tip: z.string(),
    }),
  ),
});

export type AnalyzeResult = z.infer<typeof analyzeResponseSchema>;

function buildAnalyzePrompt(cvText: string): string {
  return `Bạn là chuyên gia tư vấn CV. Phân tích CV sau và trả về JSON với cấu trúc:
{
  "score": <số nguyên 0-100>,
  "sections": [
    { "name": "Thông tin liên hệ", "status": "ok"|"warning"|"error", "tip": "<gợi ý cụ thể hoặc rỗng nếu ok>" },
    { "name": "Kinh nghiệm", "status": "ok"|"warning"|"error", "tip": "..." },
    { "name": "Học vấn", "status": "ok"|"warning"|"error", "tip": "..." },
    { "name": "Kỹ năng", "status": "ok"|"warning"|"error", "tip": "..." },
    { "name": "Tổng thể", "status": "ok"|"warning"|"error", "tip": "..." }
  ]
}

Quy tắc đánh giá:
- "ok": mục đầy đủ, cụ thể, chuyên nghiệp
- "warning": thiếu một số thông tin quan trọng hoặc còn chung chung
- "error": thiếu hoàn toàn hoặc quá sơ sài
- tip: gợi ý ngắn gọn bằng tiếng Việt, tối đa 100 ký tự. Rỗng ("") nếu status là "ok".
- score: tổng điểm dựa trên tất cả 5 mục

Chỉ trả về JSON, không giải thích thêm.

CV:
${cvText}`;
}

function cvToText(cv: Awaited<ReturnType<typeof loadCvInput>>): string {
  if (!cv) return "";
  const lines: string[] = [];
  const p = cv.profile;
  lines.push(`Họ tên: ${p.fullName}`, `Tiêu đề: ${p.headline}`, `Email: ${p.email}`, `Điện thoại: ${p.phone}`);
  if (p.linkedin) lines.push(`LinkedIn: ${p.linkedin}`);
  if (p.summary) lines.push(`Tóm tắt: ${p.summary}`);
  if (cv.experiences.length) {
    lines.push("\nKINH NGHIỆM:");
    cv.experiences.forEach((e) => lines.push(`- ${e.position} tại ${e.company}: ${e.description}`));
  }
  if (cv.educations.length) {
    lines.push("\nHỌC VẤN:");
    cv.educations.forEach((e) => lines.push(`- ${e.degree} ${e.major} tại ${e.school}, GPA: ${e.gpa}`));
  }
  if (cv.skills.length) {
    lines.push("\nKỸ NĂNG:");
    lines.push(cv.skills.map((s) => `${s.name} (${s.level})`).join(", "));
  }
  if (cv.projects.length) {
    lines.push("\nDỰ ÁN:");
    cv.projects.forEach((p) => lines.push(`- ${p.name}: ${p.description} [${p.tech}]`));
  }
  return lines.join("\n");
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return new Response("Chưa đăng nhập", { status: 401 });
  const userId = session.user.id;

  if (!(await checkRateLimit("ai", userId))) {
    return new Response("Bạn gửi yêu cầu quá nhanh", { status: 429 });
  }

  const cv = await prisma.cV.findFirst({ where: { id, userId }, select: { id: true } });
  if (!cv) return new Response("Không tìm thấy CV", { status: 404 });

  const cvInput = await loadCvInput(id, userId);
  if (!cvInput) return new Response("Không tìm thấy CV", { status: 404 });

  const prompt = buildAnalyzePrompt(cvToText(cvInput));

  try {
    const client = getAiClient();
    const completion = await client.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = analyzeResponseSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return new Response("Phân tích thất bại", { status: 500 });
    }
    return Response.json(parsed.data);
  } catch {
    return new Response("Phân tích thất bại", { status: 500 });
  }
}
```

- [ ] **Step 2: Chạy test**

```bash
npx vitest run
```

Expected: pass

- [ ] **Step 3: Commit**

```bash
git add app/api/cv/[id]/analyze/
git commit -m "feat(api): POST /api/cv/[id]/analyze — AI CV analysis endpoint"
```

---

## Task 8: CvAnalysis component + tab Phân tích trong CvEditor

**Files:**
- Create: `components/cv/CvAnalysis.tsx`
- Modify: `app/cv/[id]/CvEditor.tsx`

**Interfaces:**
- Consumes: `POST /api/cv/[id]/analyze` → `AnalyzeResult` type từ Task 7
- Produces: tab "Phân tích" trong CvEditor

- [ ] **Step 1: Tạo `components/cv/CvAnalysis.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { CheckCircle, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnalyzeResult } from "@/app/api/cv/[id]/analyze/route";

type Section = AnalyzeResult["sections"][number];

function StatusIcon({ status }: { status: Section["status"] }) {
  if (status === "ok") return <CheckCircle className="h-4 w-4 text-green-500" />;
  if (status === "warning") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
}

export default function CvAnalysis({ cvId }: { cvId: string }) {
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ran, setRan] = useState(false);

  async function analyze() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cv/${cvId}/analyze`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data: AnalyzeResult = await res.json();
      setResult(data);
      setRan(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Phân tích thất bại");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" /> Đang phân tích CV...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={analyze}>Thử lại</Button>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-4 p-4">
      {/* Điểm tổng */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">Điểm tổng thể</p>
        <p className="mt-1 text-3xl font-bold text-foreground">
          {result.score}
          <span className="text-base font-normal text-muted-foreground">/100</span>
        </p>
      </div>

      {/* Từng mục */}
      <div className="space-y-2">
        {result.sections.map((s) => (
          <div key={s.name} className="rounded-md border border-border bg-background p-3">
            <div className="flex items-center gap-2">
              <StatusIcon status={s.status} />
              <span className="font-medium text-foreground text-sm">{s.name}</span>
            </div>
            {s.tip && (
              <p className="mt-1.5 pl-6 text-xs text-muted-foreground">{s.tip}</p>
            )}
          </div>
        ))}
      </div>

      {ran && (
        <Button variant="outline" size="sm" onClick={analyze} disabled={loading} className="w-full">
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Phân tích lại
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Cập nhật `app/cv/[id]/CvEditor.tsx`** — thêm tab Phân tích

Thêm import:

```tsx
import CvAnalysis from "@/components/cv/CvAnalysis";
```

Thay `mobileTab` state type:

```tsx
  const [mobileTab, setMobileTab] = useState<"edit" | "preview" | "analyze">("edit");
```

Tìm phần mobile tab switcher (thường nằm trong return, tìm text "edit" | "preview") và thêm tab thứ 3:

```tsx
      {/* Mobile tab switcher */}
      <div className="flex border-b border-border lg:hidden">
        <button
          className={`flex-1 py-2 text-sm font-medium ${mobileTab === "edit" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
          onClick={() => setMobileTab("edit")}
        >Chỉnh sửa</button>
        <button
          className={`flex-1 py-2 text-sm font-medium ${mobileTab === "preview" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
          onClick={() => setMobileTab("preview")}
        >Xem trước</button>
        <button
          className={`flex-1 py-2 text-sm font-medium ${mobileTab === "analyze" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
          onClick={() => setMobileTab("analyze")}
        >Phân tích</button>
      </div>
```

Thêm panel Phân tích (cùng điều kiện hiển thị với preview):

```tsx
      {/* Panel phân tích - mobile */}
      {mobileTab === "analyze" && (
        <div className="lg:hidden">
          <CvAnalysis cvId={cvId} />
        </div>
      )}

      {/* Panel phân tích - desktop (sidebar) */}
      <div className="hidden lg:block lg:w-72 shrink-0 border-l border-border">
        <div className="sticky top-14 overflow-y-auto" style={{ maxHeight: "calc(100vh - 56px)" }}>
          <div className="border-b border-border px-4 py-2.5">
            <p className="text-sm font-medium text-foreground">Phân tích AI</p>
          </div>
          <CvAnalysis cvId={cvId} />
        </div>
      </div>
```

- [ ] **Step 3: Chạy toàn bộ test**

```bash
npx vitest run
```

Expected: tất cả pass

- [ ] **Step 4: Commit**

```bash
git add components/cv/CvAnalysis.tsx app/cv/[id]/CvEditor.tsx
git commit -m "feat(cv-editor): tab Phân tích AI — score + gợi ý từng mục"
```

---

## Kiểm tra tích hợp thủ công (sau khi hoàn tất tất cả tasks)

- [ ] Tạo 3 CV → thử tạo CV thứ 4 → thấy nút bị disable / thông báo giới hạn
- [ ] Đổi tên CV từ menu ⋮ → tên cập nhật ngay
- [ ] Đặt CV khác làm mặc định → badge ★ chuyển sang CV mới
- [ ] Bật chia sẻ → hiện URL → copy → mở ẩn danh → thấy trang hồ sơ + nút Tải PDF → PDF tải được
- [ ] Tắt chia sẻ → mở URL cũ → thấy trang 404
- [ ] Vào `/cv/[id]` → tab Phân tích → thấy spinner → thấy điểm + gợi ý
- [ ] Sửa CV → bấm "Phân tích lại" → kết quả cập nhật
- [ ] Ứng tuyển job → dropdown CV default chọn đúng CV có `isDefault = true`
