# Đánh giá công ty (Company Reviews) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho ứng viên đã ứng tuyển đánh giá công ty (sao 1–5 + nhận xét, ẩn danh); trang công ty hiện điểm TB + danh sách; thẻ directory hiện badge sao.

**Architecture:** Model `CompanyReview` mới khoá theo `CompanyProfile.id`, `@@unique([userId, companyId])` (mỗi người 1 review, upsert). Logic thuần (Zod schema, tổng hợp điểm, kiểm quyền) tách vào `lib/company/reviews.ts` + test vitest. Server actions wiring prisma + auth. Điểm TB tính on-the-fly bằng `prisma.aggregate`/`groupBy`. UI trên trang server component `/companies/[id]` + form client gọi action.

**Tech Stack:** Next.js 16, React 19, Prisma 6, Zod, NextAuth v5 (JWT), Tailwind v4 (design tokens), Vitest, lucide-react.

## Global Constraints

- Schema sync bằng `npm run db:push` (Prisma db push, **không** migration). Nếu DB offline: `npx prisma generate` để cập nhật type client (đủ cho typecheck/test).
- Prisma pin v6 — không nâng cấp.
- Hàm logic thuần: **không** import `prisma`/`auth` trực tiếp; test bằng vitest thuần.
- Actions trả `{ ok: boolean; error?: string }` (nếp hiện có). prisma default import: `import prisma from "@/lib/db/prisma"`.
- Chỉ dùng Tailwind design token (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary`…). Không màu cứng mới. Dark mode phải đọc được.
- Toàn bộ chữ UI tiếng Việt.
- Review **ẩn danh**: query hiển thị KHÔNG select `user`/tên. Chỉ ứng viên (`role === "CANDIDATE"`) đã có `Application` vào `JobDescription` của `company.userId`, và không phải chủ công ty, mới được đánh giá.
- Không sửa component xem trước CV.
- Baseline: 348 test đang xanh.

---

### Task 1: Schema `CompanyReview` + logic thuần `lib/company/reviews.ts`

Model mới + hàm thuần (schema Zod, tổng hợp điểm, kiểm quyền), test độc lập không đụng DB.

**Files:**
- Modify: `prisma/schema.prisma` (thêm model `CompanyReview`; thêm quan hệ ngược vào `model CompanyProfile` và `model User`)
- Create: `lib/company/reviews.ts`
- Test: `lib/company/__tests__/reviews.test.ts`

**Interfaces:**
- Produces:
  - `reviewSchema` (Zod) và `type ReviewInput = { rating: number; comment: string }`
  - `type ReviewSummary = { average: number; count: number }`
  - `summarizeReviews(ratings: number[]): ReviewSummary`
  - `canReview(args: { hasApplied: boolean; isOwner: boolean }): boolean`

- [ ] **Step 1: Thêm model + quan hệ ngược vào `prisma/schema.prisma`**

Thêm model mới (đặt sau `model CompanyProfile { ... }`):
```prisma
model CompanyReview {
  id        String         @id @default(cuid())
  companyId String
  company   CompanyProfile @relation(fields: [companyId], references: [id], onDelete: Cascade)
  userId    String
  user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  rating    Int
  comment   String         @default("")
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt

  @@unique([userId, companyId])
  @@index([companyId])
}
```

Trong `model CompanyProfile`, thêm dòng quan hệ ngược (trước dấu `}` đóng model):
```prisma
  reviews     CompanyReview[]
```

Trong `model User`, thêm dòng quan hệ ngược (cùng khu vực các quan hệ khác, trước `}`):
```prisma
  companyReviews CompanyReview[]
```

- [ ] **Step 2: Đồng bộ schema + regenerate client**

Run: `npm run db:push`
Expected: "Your database is now in sync with your Prisma schema" và client được generate lại.
(Nếu DB không kết nối được: chạy `npx prisma generate` — đủ cho typecheck/test.)

- [ ] **Step 3: Viết test thất bại `lib/company/__tests__/reviews.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { reviewSchema, summarizeReviews, canReview } from "../reviews";

describe("reviewSchema", () => {
  it("chấp nhận rating 1-5 và comment rỗng", () => {
    expect(reviewSchema.safeParse({ rating: 5, comment: "" }).success).toBe(true);
  });
  it("coerce chuỗi số '4' -> 4", () => {
    const r = reviewSchema.safeParse({ rating: "4", comment: "ổn" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.rating).toBe(4);
  });
  it("từ chối rating ngoài 1-5", () => {
    expect(reviewSchema.safeParse({ rating: 0, comment: "" }).success).toBe(false);
    expect(reviewSchema.safeParse({ rating: 6, comment: "" }).success).toBe(false);
  });
  it("từ chối comment quá 1000 ký tự", () => {
    expect(reviewSchema.safeParse({ rating: 3, comment: "x".repeat(1001) }).success).toBe(false);
  });
});

describe("summarizeReviews", () => {
  it("rỗng -> average 0, count 0", () => {
    expect(summarizeReviews([])).toEqual({ average: 0, count: 0 });
  });
  it("một phần tử", () => {
    expect(summarizeReviews([4])).toEqual({ average: 4, count: 1 });
  });
  it("làm tròn 1 chữ số thập phân", () => {
    expect(summarizeReviews([5, 4, 4])).toEqual({ average: 4.3, count: 3 });
  });
});

describe("canReview", () => {
  it("đã ứng tuyển và không phải chủ -> true", () => {
    expect(canReview({ hasApplied: true, isOwner: false })).toBe(true);
  });
  it("chưa ứng tuyển -> false", () => {
    expect(canReview({ hasApplied: false, isOwner: false })).toBe(false);
  });
  it("chủ công ty -> false", () => {
    expect(canReview({ hasApplied: true, isOwner: true })).toBe(false);
  });
});
```

- [ ] **Step 4: Chạy test để xác nhận FAIL**

Run: `npx vitest run lib/company/__tests__/reviews.test.ts`
Expected: FAIL — "Cannot find module '../reviews'".

- [ ] **Step 5: Viết `lib/company/reviews.ts`**

```typescript
import { z } from "zod";

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).default(""),
});

export type ReviewInput = z.infer<typeof reviewSchema>;

export type ReviewSummary = { average: number; count: number };

// Trung bình làm tròn 1 chữ số thập phân; count = số review. Rỗng -> {0,0}.
export function summarizeReviews(ratings: number[]): ReviewSummary {
  if (ratings.length === 0) return { average: 0, count: 0 };
  const sum = ratings.reduce((a, b) => a + b, 0);
  return { average: Math.round((sum / ratings.length) * 10) / 10, count: ratings.length };
}

// Đủ điều kiện đánh giá khi đã ứng tuyển và KHÔNG phải chủ công ty.
export function canReview({ hasApplied, isOwner }: { hasApplied: boolean; isOwner: boolean }): boolean {
  return hasApplied && !isOwner;
}
```

- [ ] **Step 6: Chạy test để xác nhận PASS**

Run: `npx vitest run lib/company/__tests__/reviews.test.ts`
Expected: PASS (10 test).

- [ ] **Step 7: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: 0 lỗi.
```bash
git add prisma/schema.prisma lib/company/reviews.ts lib/company/__tests__/reviews.test.ts
git commit -m "feat(reviews): CompanyReview schema + pure review logic (schema/summary/eligibility)"
```

---

### Task 2: Mở rộng directory ranking để mang điểm sao

`rankCompanies` nhận thêm map điểm theo companyId; `CompanyDirItem` thêm `rating`/`reviewCount`.

**Files:**
- Modify: `lib/company/directory.ts`
- Test: `lib/company/__tests__/directory.test.ts`

**Interfaces:**
- Consumes: (không có từ task khác)
- Produces:
  - `type CompanyRating = { average: number; count: number }`
  - `CompanyDirItem` mở rộng: thêm `rating: number; reviewCount: number`
  - `rankCompanies(companies, countByUserId, ratingByCompanyId?): CompanyDirItem[]` — tham số thứ 3 optional, default `{}`.

- [ ] **Step 1: Đọc test hiện có**

Run: `npx vitest run lib/company/__tests__/directory.test.ts`
Expected: PASS (test baseline). Ghi nhớ cấu trúc để không phá.

- [ ] **Step 2: Cập nhật `lib/company/directory.ts`**

Thay toàn bộ nội dung file thành:
```typescript
export type CompanyDirInput = {
  id: string;
  userId: string;
  name: string;
  description: string;
  location: string;
  logoUrl: string;
};

export type CompanyRating = { average: number; count: number };

export type CompanyDirItem = CompanyDirInput & {
  jobCount: number;
  rating: number;
  reviewCount: number;
};

export function rankCompanies(
  companies: CompanyDirInput[],
  countByUserId: Record<string, number>,
  ratingByCompanyId: Record<string, CompanyRating> = {},
): CompanyDirItem[] {
  return companies
    .map((c) => {
      const r = ratingByCompanyId[c.id];
      return {
        ...c,
        jobCount: countByUserId[c.userId] ?? 0,
        rating: r?.average ?? 0,
        reviewCount: r?.count ?? 0,
      };
    })
    .sort((a, b) => b.jobCount - a.jobCount || a.name.localeCompare(b.name, "vi"));
}
```

- [ ] **Step 3: Thêm test cho điểm sao**

Trong `lib/company/__tests__/directory.test.ts`, thêm test (giữ nguyên các test cũ):
```typescript
  it("gắn rating/reviewCount theo companyId; mặc định 0 khi thiếu", () => {
    const companies = [
      { id: "c1", userId: "u1", name: "A", description: "", location: "", logoUrl: "" },
      { id: "c2", userId: "u2", name: "B", description: "", location: "", logoUrl: "" },
    ];
    const ranked = rankCompanies(companies, { u1: 2, u2: 1 }, { c1: { average: 4.5, count: 3 } });
    const c1 = ranked.find((c) => c.id === "c1")!;
    const c2 = ranked.find((c) => c.id === "c2")!;
    expect(c1.rating).toBe(4.5);
    expect(c1.reviewCount).toBe(3);
    expect(c2.rating).toBe(0);
    expect(c2.reviewCount).toBe(0);
  });
```
(Nếu file test chưa import `rankCompanies`, thêm vào dòng import đầu file: `import { rankCompanies } from "../directory";`.)

- [ ] **Step 4: Chạy test**

Run: `npx vitest run lib/company/__tests__/directory.test.ts`
Expected: PASS (test cũ + test mới).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: 0 lỗi.
```bash
git add lib/company/directory.ts lib/company/__tests__/directory.test.ts
git commit -m "feat(reviews): carry company rating/reviewCount through rankCompanies"
```

---

### Task 3: Server actions `lib/company/review-actions.ts`

Ghi/xoá đánh giá, kiểm quyền qua `canReview` + query `Application`.

**Files:**
- Create: `lib/company/review-actions.ts`

**Interfaces:**
- Consumes: `reviewSchema`, `canReview` (Task 1); prisma; `auth` từ `@/auth`.
- Produces:
  - `submitReview(companyId: string, raw: { rating: number | string; comment: string }): Promise<{ ok: boolean; error?: string }>`
  - `deleteReview(companyId: string): Promise<{ ok: boolean; error?: string }>`

- [ ] **Step 1: Viết `lib/company/review-actions.ts`**

```typescript
"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { reviewSchema, canReview } from "./reviews";

export async function submitReview(
  companyId: string,
  raw: { rating: number | string; comment: string },
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "CANDIDATE")
    return { ok: false, error: "Chỉ ứng viên được đánh giá" };

  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dữ liệu không hợp lệ" };

  const company = await prisma.companyProfile.findUnique({
    where: { id: companyId },
    select: { userId: true },
  });
  if (!company) return { ok: false, error: "Không tìm thấy công ty" };

  const isOwner = company.userId === userId;
  const appliedCount = await prisma.application.count({
    where: { candidateId: userId, job: { userId: company.userId } },
  });
  if (!canReview({ hasApplied: appliedCount > 0, isOwner }))
    return { ok: false, error: "Bạn cần ứng tuyển công ty này trước khi đánh giá" };

  await prisma.companyReview.upsert({
    where: { userId_companyId: { userId, companyId } },
    create: { userId, companyId, rating: parsed.data.rating, comment: parsed.data.comment },
    update: { rating: parsed.data.rating, comment: parsed.data.comment },
  });

  revalidatePath(`/companies/${companyId}`);
  return { ok: true };
}

export async function deleteReview(
  companyId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };

  // deleteMany để không throw P2025 khi review đã bị xoá (race).
  await prisma.companyReview.deleteMany({ where: { userId, companyId } });

  revalidatePath(`/companies/${companyId}`);
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: 0 lỗi.
```bash
git add lib/company/review-actions.ts
git commit -m "feat(reviews): submitReview/deleteReview server actions with eligibility gate"
```

---

### Task 4: Component sao `StarDisplay` + `StarInput`

**Files:**
- Create: `components/companies/StarRating.tsx`

**Interfaces:**
- Produces:
  - `StarDisplay({ value, className? }: { value: number; className?: string })` — hiển thị 5 sao đọc-only (fill khi `i < Math.round(value)`).
  - `StarInput({ value, onChange }: { value: number; onChange: (v: number) => void })` — 5 nút chọn 1–5.

- [ ] **Step 1: Viết `components/companies/StarRating.tsx`**

```tsx
"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarDisplay({ value, className }: { value: number; className?: string }) {
  const filled = Math.round(value);
  return (
    <span className={cn("inline-flex items-center", className)} aria-label={`${value} trên 5 sao`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          className={cn(
            "h-4 w-4",
            i < filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
          )}
        />
      ))}
    </span>
  );
}

export function StarInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} sao`}
          className="rounded p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Star
            className={cn(
              "h-6 w-6 transition-colors",
              n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40 hover:text-amber-400",
            )}
          />
        </button>
      ))}
    </div>
  );
}
```
(Lưu ý: `fill-amber-400`/`text-amber-400` là màu accent sao đọc được ở cả light/dark — dùng cho biểu tượng đánh giá, không phải màu nền UI mới.)

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: 0 lỗi.
```bash
git add components/companies/StarRating.tsx
git commit -m "feat(reviews): StarDisplay + StarInput components"
```

---

### Task 5: Form đánh giá `ReviewForm`

**Files:**
- Create: `components/companies/ReviewForm.tsx`

**Interfaces:**
- Consumes: `submitReview`, `deleteReview` (Task 3); `StarInput` (Task 4).
- Produces: `ReviewForm({ companyId, initial? }: { companyId: string; initial?: { rating: number; comment: string } })` (default export).

- [ ] **Step 1: Viết `components/companies/ReviewForm.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarInput } from "@/components/companies/StarRating";
import { submitReview, deleteReview } from "@/lib/company/review-actions";

export default function ReviewForm({
  companyId,
  initial,
}: {
  companyId: string;
  initial?: { rating: number; comment: string };
}) {
  const router = useRouter();
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (rating < 1) {
      toast.error("Vui lòng chọn số sao");
      return;
    }
    startTransition(async () => {
      const r = await submitReview(companyId, { rating, comment });
      if (r.ok) {
        toast.success(initial ? "Đã cập nhật đánh giá" : "Đã gửi đánh giá");
        router.refresh();
      } else {
        toast.error(r.error ?? "Gửi đánh giá thất bại");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const r = await deleteReview(companyId);
      if (r.ok) {
        setRating(0);
        setComment("");
        toast.success("Đã xoá đánh giá");
        router.refresh();
      } else {
        toast.error(r.error ?? "Xoá đánh giá thất bại");
      }
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">
        {initial ? "Đánh giá của bạn" : "Viết đánh giá"}
      </p>
      <StarInput value={rating} onChange={setRating} />
      <Textarea
        placeholder="Chia sẻ trải nghiệm của bạn về công ty này..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={1000}
        rows={3}
        className="resize-none"
      />
      <div className="flex justify-end gap-2">
        {initial && (
          <Button variant="outline" size="sm" onClick={handleDelete} disabled={isPending}>
            Xoá
          </Button>
        )}
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? "Đang lưu..." : initial ? "Cập nhật" : "Gửi đánh giá"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: 0 lỗi.
```bash
git add components/companies/ReviewForm.tsx
git commit -m "feat(reviews): ReviewForm client component (submit/update/delete)"
```

---

### Task 6: Khối "Đánh giá" trên trang `/companies/[id]`

**Files:**
- Modify: `app/companies/[id]/page.tsx`

**Interfaces:**
- Consumes: `summarizeReviews`, `canReview` (Task 1); `StarDisplay` (Task 4); `ReviewForm` (Task 5); prisma.

- [ ] **Step 1: Thêm import**

Trong `app/companies/[id]/page.tsx`, thêm sau các import hiện có (sau `import { Card, ... }`):
```tsx
import { summarizeReviews, canReview } from "@/lib/company/reviews";
import { StarDisplay } from "@/components/companies/StarRating";
import ReviewForm from "@/components/companies/ReviewForm";
```

- [ ] **Step 2: Load dữ liệu review sau khối `const jobs = await ...`**

Ngay sau truy vấn `jobs` (trước `return (`), thêm:
```tsx
  const reviews = await prisma.companyReview.findMany({
    where: { companyId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, rating: true, comment: true, createdAt: true }, // ẩn danh: không select user
  });
  const summary = summarizeReviews(reviews.map((r) => r.rating));

  const isOwner = company.userId === session.user.id;
  const isCandidate = session.user.role === "CANDIDATE";
  const appliedCount = isCandidate
    ? await prisma.application.count({
        where: { candidateId: session.user.id, job: { userId: company.userId } },
      })
    : 0;
  const eligible = isCandidate && canReview({ hasApplied: appliedCount > 0, isOwner });
  const myReview = eligible
    ? await prisma.companyReview.findUnique({
        where: { userId_companyId: { userId: session.user.id, companyId: id } },
        select: { rating: true, comment: true },
      })
    : null;
```

- [ ] **Step 3: Thêm khối JSX "Đánh giá" trước thẻ đóng `</main>`**

Ngay sau khối `<div className="flex flex-col gap-3"> ... </div>` của danh sách tin (trước `</main>`), chèn:
```tsx
        <section className="mt-8">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-lg font-semibold text-foreground">Đánh giá</h2>
            {summary.count > 0 && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <StarDisplay value={summary.average} />
                <span className="font-medium text-foreground">{summary.average.toFixed(1)}</span>
                <span>({summary.count} đánh giá)</span>
              </span>
            )}
          </div>

          {eligible && (
            <div className="mb-4">
              <ReviewForm
                companyId={id}
                initial={myReview ? { rating: myReview.rating, comment: myReview.comment } : undefined}
              />
            </div>
          )}

          <div className="flex flex-col gap-3">
            {reviews.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground">
                  Chưa có đánh giá nào.
                </CardContent>
              </Card>
            ) : (
              reviews.map((r) => (
                <Card key={r.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <StarDisplay value={r.rating} />
                      <span>· Ứng viên ·</span>
                      <span>{new Date(r.createdAt).toLocaleDateString("vi-VN")}</span>
                    </div>
                    {r.comment && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{r.comment}</p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </section>
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit`
Expected: 0 lỗi.
Run: `npm run build`
Expected: build thành công.

- [ ] **Step 5: Commit**

```bash
git add app/companies/[id]/page.tsx
git commit -m "feat(reviews): reviews section + form on company page"
```

---

### Task 7: Badge sao ở directory `/companies`

**Files:**
- Modify: `app/companies/page.tsx`
- Modify: `components/companies/CompanyCard.tsx`

**Interfaces:**
- Consumes: `rankCompanies(..., ratingByCompanyId)` (Task 2); `CompanyDirItem.rating/reviewCount` (Task 2); `StarDisplay` (Task 4).

- [ ] **Step 1: Query rating theo companyId trong `app/companies/page.tsx`**

Ngay sau khối lấy `companies` (trước `const ranked = rankCompanies(...)`), thêm:
```tsx
  const companyIds = companies.map((c) => c.id);
  const ratingRows =
    companyIds.length === 0
      ? []
      : await prisma.companyReview.groupBy({
          by: ["companyId"],
          where: { companyId: { in: companyIds } },
          _avg: { rating: true },
          _count: { rating: true },
        });
  const ratingByCompanyId: Record<string, { average: number; count: number }> = {};
  for (const row of ratingRows) {
    ratingByCompanyId[row.companyId] = {
      average: Math.round((row._avg.rating ?? 0) * 10) / 10,
      count: row._count.rating,
    };
  }
```

Đổi dòng `const ranked = rankCompanies(companies, countByUserId);` thành:
```tsx
  const ranked = rankCompanies(companies, countByUserId, ratingByCompanyId);
```

- [ ] **Step 2: Badge sao trong `components/companies/CompanyCard.tsx`**

Thêm import ở đầu file:
```tsx
import { StarDisplay } from "@/components/companies/StarRating";
```

Trong `<CardContent>`, thay khối hiện tại:
```tsx
        <CardContent>
          <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {company.jobCount} tin đang tuyển
          </span>
          {company.description && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{company.description}</p>
          )}
        </CardContent>
```
thành:
```tsx
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {company.jobCount} tin đang tuyển
            </span>
            {company.reviewCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <StarDisplay value={company.rating} className="[&_svg]:h-3.5 [&_svg]:w-3.5" />
                <span className="font-medium text-foreground">{company.rating.toFixed(1)}</span>
                <span>({company.reviewCount})</span>
              </span>
            )}
          </div>
          {company.description && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{company.description}</p>
          )}
        </CardContent>
```

- [ ] **Step 3: Typecheck + toàn bộ test + build**

Run: `npx tsc --noEmit`
Expected: 0 lỗi.
Run: `npx vitest run`
Expected: PASS (348 baseline + 11 mới ~ 359).
Run: `npm run build`
Expected: build thành công.

- [ ] **Step 4: Commit**

```bash
git add app/companies/page.tsx components/companies/CompanyCard.tsx
git commit -m "feat(reviews): star rating badge on company directory cards"
```

---

## Ghi chú kiểm thử tổng (sau tất cả task)

Manual bằng `npm run dev` (nếu subagent không chạy được dev, ghi "cần user xác nhận"):
- Ứng viên **chưa** ứng tuyển công ty X → vào `/companies/<X>` **không** thấy form đánh giá.
- Ứng viên **đã** ứng tuyển → thấy form → chọn sao + nhận xét → Gửi → điểm TB + danh sách cập nhật; review hiển thị "Ứng viên · ngày" (ẩn danh).
- Sửa lại (form pre-fill review cũ) → Cập nhật; Xoá → biến mất.
- Chủ công ty (recruiter) xem trang công ty mình → **không** thấy form.
- `/companies` → thẻ công ty có review hiện badge `★ x.x (n)`; công ty chưa có review không hiện badge.
- Kiểm dark mode: sao và chữ đọc được.
