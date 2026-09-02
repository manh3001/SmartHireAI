# Đánh giá công ty (Company Reviews) — Design Spec

**Ngày:** 2026-09-02
**Vòng:** 6 (tính năng đầu tiên của nhóm E "tính năng hoãn")

## Mục tiêu

Cho phép **ứng viên đã từng ứng tuyển** vào một công ty viết **đánh giá** (rating sao + nhận xét) về công ty đó, kiểu Glassdoor gọn nhẹ. Trang công ty hiển thị điểm trung bình + danh sách đánh giá (ẩn danh). Thẻ công ty ở directory hiện badge sao.

## Quyết định thiết kế (đã chốt với user)

- **Quyền viết:** chỉ tài khoản `CANDIDATE` đã có ≥1 `Application` vào một `JobDescription` thuộc `userId` của công ty. Chủ công ty không được tự đánh giá.
- **Cấu trúc review:** 1 rating sao tổng (1–5) + 1 ô nhận xét tự do (≤ 1000 ký tự, cho phép rỗng).
- **Số review mỗi người:** mỗi ứng viên tối đa 1 review/công ty, **sửa được** (upsert). Tác giả xoá được review của mình.
- **Danh tính:** hiển thị **ẩn danh** ("Ứng viên" + ngày), không lộ tên/email. Lưu `userId` nội bộ để kiểm quyền + chống trùng.
- **Không** có phản hồi của NTD (ngoài phạm vi vòng này).
- Tổng hợp điểm tính **on-the-fly** bằng `prisma.aggregate` (không denormalize vào `CompanyProfile`).

## Kiến trúc

Bám cấu trúc hiện có: `CompanyProfile` (1–1 với recruiter `User`), trang `/companies/[id]` keyed theo `CompanyProfile.id`, tin tuyển dụng nối qua `company.userId`. Logic thuần tách khỏi Prisma/auth và test bằng DI + vitest (nếp chung của repo).

### 1. Data model (Prisma) — `prisma/schema.prisma`

```prisma
model CompanyReview {
  id        String         @id @default(cuid())
  companyId String
  company   CompanyProfile @relation(fields: [companyId], references: [id], onDelete: Cascade)
  userId    String
  user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  rating    Int            // 1..5
  comment   String         @default("")
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt

  @@unique([userId, companyId])
  @@index([companyId])
}
```

Thêm quan hệ ngược:
- `CompanyProfile`: `reviews CompanyReview[]`
- `User`: `companyReviews CompanyReview[]`

Đồng bộ schema: `npm run db:push` (KHÔNG dùng migration — theo nếp dự án). Nếu DB offline: `npx prisma generate` để cập nhật type client cho typecheck/test.

### 2. Logic thuần — `lib/company/reviews.ts` (+ `__tests__/reviews.test.ts`)

```typescript
import { z } from "zod";

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).default(""),
});
export type ReviewInput = z.infer<typeof reviewSchema>;

export type ReviewSummary = { average: number; count: number };

// Trung bình làm tròn 1 chữ số thập phân; count = số review. Rỗng → {average:0,count:0}.
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

**Test:** `summarizeReviews` (rỗng, 1 phần tử, làm tròn ví dụ [5,4,4]→4.3), `canReview` (4 tổ hợp bool), `reviewSchema` (rating ngoài 1–5 fail, coerce string "4"→4, comment quá dài fail, comment rỗng ok).

### 3. Server actions — `lib/company/review-actions.ts`

`"use server"`. Trả `{ ok: true } | { ok: false; error: string }` như các action hiện có.

- **`submitReview(companyId: string, raw: { rating: number|string; comment: string })`**
  1. `auth()`; chưa đăng nhập → `{ok:false}`.
  2. `reviewSchema.safeParse(raw)`; fail → `{ok:false, error}`.
  3. Load `company = companyProfile.findUnique({ where:{id:companyId}, select:{userId:true} })`; không có → `{ok:false}`.
  4. `isOwner = company.userId === session.user.id`.
  5. `hasApplied = (await application.count({ where:{ candidateId: session.user.id, job:{ userId: company.userId } } })) > 0`. *(Đã xác nhận schema: `Application.candidateId → User`, `Application.job.userId` = recruiter.)*
  6. `canReview({hasApplied, isOwner})` false → `{ok:false, error:"Bạn cần ứng tuyển công ty này trước khi đánh giá"}` (hoặc lỗi chủ công ty).
  7. `companyReview.upsert({ where:{ userId_companyId:{ userId, companyId } }, create:{...}, update:{ rating, comment } })`.
  8. `revalidatePath(`/companies/${companyId}`)`; `{ok:true}`.

- **`deleteReview(companyId: string)`**
  - `auth()`, `deleteMany({ where:{ userId, companyId } })` (deleteMany để không throw khi không có — tránh P2025), `revalidatePath`, `{ok:true}`.

### 4. Data layer đọc — trong trang (server component)

Trên `/companies/[id]/page.tsx`:
- Lấy list review: `companyReview.findMany({ where:{companyId}, orderBy:{createdAt:"desc"}, select:{ id:true, rating:true, comment:true, createdAt:true } })` (KHÔNG select user → ẩn danh).
- `summary = summarizeReviews(reviews.map(r=>r.rating))`.
- Tính `canUserReview` + `myReview`: nếu đã đăng nhập & là CANDIDATE, query `hasApplied` (count như trên) và `myReview = find({where:{userId_companyId}})` để pre-fill form.

Directory `/companies` (`lib/company/directory.ts` + trang gọi nó):
- Query aggregate rating theo từng companyId: `companyReview.groupBy({ by:['companyId'], _avg:{rating:true}, _count:{rating:true} })` → map vào `CompanyDirItem`.
- Mở rộng `CompanyDirItem` thêm `rating?: number; reviewCount?: number`. `rankCompanies` giữ nguyên thứ tự sort theo jobCount (không đổi tiêu chí xếp hạng ở vòng này).

### 5. UI

- **`components/companies/StarRating.tsx`** (mới, dùng chung): hiển thị N sao (đọc-only) từ số; và biến thể input (chọn 1–5) cho form. Icon `Star` từ lucide (fill khi chọn). Có thể tách 2 component `StarDisplay` + `StarInput` cho gọn.
- **`components/companies/ReviewForm.tsx`** (client): props `companyId`, `initial?: {rating, comment}`. `StarInput` + `Textarea` + nút "Lưu đánh giá"/"Cập nhật". Gọi `submitReview`, toast, `router.refresh()`. Nếu `initial` có → nút "Xoá" gọi `deleteReview`.
- **Khối "Đánh giá" trong `/companies/[id]/page.tsx`:** tiêu đề + `StarDisplay average` + "(n đánh giá)". `ReviewForm` chỉ render khi `canUserReview`. Danh sách: mỗi item "★★★★☆ · Ứng viên · dd/mm/yyyy" + nhận xét (`whitespace-pre-wrap`). Rỗng → dòng "Chưa có đánh giá nào."
- **`components/companies/CompanyCard.tsx`:** thêm badge `★ x.x (n)` khi `reviewCount > 0`; ẩn khi chưa có.

### 6. Testing & verify

- Unit: `lib/company/__tests__/reviews.test.ts` (summarize, canReview, schema).
- `npx tsc --noEmit` → 0 lỗi.
- `npx vitest run` → toàn bộ xanh (baseline 348 + số test mới).
- `npm run build` → pass.
- Manual (user tự kiểm bằng `npm run dev`): (a) ứng viên chưa ứng tuyển không thấy form; (b) ứng tuyển rồi → viết review → điểm TB cập nhật; (c) sửa/xoá review của mình; (d) chủ công ty không thấy form; (e) badge sao ở `/companies`.

## Ghi chú triển khai

- **Tên field `Application`:** đã xác nhận `model Application` có `candidateId` (→ User) và `job` (→ JobDescription có `userId`). `@@unique([jobId, candidateId])`. Query `hasApplied` dùng `{ candidateId, job:{ userId } }`.
- Toàn bộ chữ UI tiếng Việt.
- Chỉ dùng Tailwind design token (không màu cứng mới), hỗ trợ dark mode sẵn.
- Không sửa các component xem trước CV.

## Ngoài phạm vi (YAGNI)

Phản hồi của NTD; nhiều tiêu chí sao (văn hóa/lương/quản lý); ô Ưu/Nhược riêng; kiểm duyệt/report; phân trang danh sách review; denormalize avg vào CompanyProfile; xếp hạng directory theo rating.
