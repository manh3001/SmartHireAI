# Gói D — Performance & Infrastructure

- **Ngày**: 2026-08-29
- **Trạng thái**: Đã duyệt thiết kế, chờ viết plan
- **Bối cảnh**: Vòng 4 của lộ trình "nâng cấp bám sát web tuyển dụng thật". Gói A (bảo mật) + B (tìm kiếm) + C (UI states) đã merge. Gói D giải quyết hiệu năng hạ tầng: logo DB bytes → Vercel Blob, revalidatePath → revalidateTag, next/image.

## 1. Mục tiêu & vấn đề hiện tại

**Mục tiêu**: giảm tải DB, chuẩn bị caching pattern cho ISR tương lai, tối ưu hình ảnh.

**Hiện trạng**:
- Company logo lưu dạng `Bytes` trong DB, serve qua `/api/company/[id]/logo` — DB hit mỗi cache miss.
- Toàn bộ cache invalidation dùng `revalidatePath` (9 chỗ trải 5 file) — thô, không cross-route.
- 3 raw `<img>` tag cho company logo (có eslint-disable comment) — không lazy load, không format tối ưu.
- Navbar query (`getNotificationSignal`) chạy trên mọi trang render — 2 DB queries mỗi page.
- N+1 query: không tồn tại — codebase đã dùng nested include hiệu quả.

**Phạm vi loại trừ**: không thay đổi `force-dynamic` trên các trang (pages vẫn giữ dynamic rendering); không migrate sang ISR.

## 2. Kiến trúc

### 2.1 Logo Migration — DB Bytes → Vercel Blob

**Package**: `@vercel/blob` (Vercel-native, CDN tự động, `put`/`del` API đơn giản).

**Luồng upload mới** (`lib/company/actions.ts`):
```
File → validateSize/type → vercel blob put() → blob URL → prisma.companyProfile.update({ logoUrl: blobUrl })
```

**Luồng cũ** (deprecated sau migration):
```
File → validateSize/type → Uint8Array → prisma.companyProfile.update({ logoData, logoMime, logoUrl: "/api/..." })
```

**Schema**: không thay đổi cấu trúc — `logoUrl String?`, `logoData Bytes?`, `logoMime String?` giữ nguyên. Sau khi chạy migration script, `logoData`/`logoMime` sẽ là `null` cho tất cả row. Các field này không bị drop (nullable, backward-compatible).

**Migration script** (`scripts/migrate-logos.ts`):
- Đọc tất cả CompanyProfile có `logoData != null`
- Upload từng logo lên Vercel Blob: `put(filename, buffer, { access: "public" })`
- Update `logoUrl` = blob URL, clear `logoData = null`, `logoMime = null`
- Idempotent: skip nếu `logoUrl` đã là blob URL (chứa `vercel-storage.com`)

**API route** (`app/api/company/[id]/logo/route.ts`):
- Nếu `logoUrl` set → `redirect(logoUrl, 301)`
- Nếu không (legacy row chưa migrate) → serve từ `logoData` như cũ
- Sau khi migration script chạy xong toàn bộ: route chỉ còn redirect

**Env var**: `BLOB_READ_WRITE_TOKEN` (thêm vào `.env.local`, `.env.example`). Nếu thiếu trong dev → action throw lỗi rõ ràng thay vì crash ngầm.

**`next.config.ts`**: thêm remote pattern:
```ts
{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }
```

### 2.2 Cache Tags — revalidatePath → revalidateTag

**Tag constants** (`lib/cache/tags.ts`):
```ts
export const CACHE_TAGS = {
  jobs: "jobs",
  company: "company",
  applications: "applications",
  notifications: "notifications",
  cv: "cv",
  dashboard: "dashboard",
} as const;
```

**Mapping thay thế** (9 revalidatePath → revalidateTag, trải 5 file):

| File | Trước | Sau |
|------|-------|-----|
| `lib/cv/actions.ts` | `revalidatePath("/dashboard")` | `revalidateTag(CACHE_TAGS.dashboard)` |
| `lib/cv/actions.ts` | `revalidatePath("/cv/[id]")` | `revalidateTag(CACHE_TAGS.cv)` |
| `lib/applications/actions.ts` | `revalidatePath("/applications")` | `revalidateTag(CACHE_TAGS.applications)` |
| `lib/applications/actions.ts` | `revalidatePath("/jobs/[id]")` | `revalidateTag(CACHE_TAGS.jobs)` |
| `lib/applications/actions.ts` | `revalidatePath("/applications")` | `revalidateTag(CACHE_TAGS.applications)` |
| `lib/jobs/actions.ts` | `revalidatePath("/jobs")` | `revalidateTag(CACHE_TAGS.jobs)` |
| `lib/jobs/actions.ts` | `revalidatePath("/jobs/saved")` | `revalidateTag(CACHE_TAGS.jobs)` |
| `lib/company/actions.ts` | `revalidatePath("/company/edit")` | `revalidateTag(CACHE_TAGS.company)` |
| `lib/notifications/actions.ts` | `revalidatePath("/notifications")` | `revalidateTag(CACHE_TAGS.notifications)` |

**`unstable_cache` cho Navbar query** (`lib/notifications/poll.ts`):
- Wrap `getNotificationSignal` trong `unstable_cache` với tag `CACHE_TAGS.notifications`, TTL 60s
- Khi `revalidateTag("notifications")` được gọi (khi có notification mới) → cache bị xóa → query lại
- Giảm DB load cho Navbar render trên mọi trang

### 2.3 next/image

**Thay thế 2/3 raw `<img>` tag:**

| File | Hành động |
|------|-----------|
| `components/companies/CompanyCard.tsx` | `<img>` → `<Image>` từ `next/image` |
| `app/companies/[id]/page.tsx` | `<img>` → `<Image>` từ `next/image` |
| `app/company/edit/page.tsx` | **Giữ raw `<img>`** — hiển thị `blob:` preview URL từ FileReader (client-side object URL, next/image không optimize được) |

Xóa `// eslint-disable-next-line` comment trên 2 file được replace.

## 3. Tasks

### Task 1: Vercel Blob setup + upload action
**Files tạo/sửa:**
- `package.json` — thêm `@vercel/blob`
- `.env.example` — thêm `BLOB_READ_WRITE_TOKEN=`
- `next.config.ts` — thêm remote pattern cho blob hostname
- `lib/company/actions.ts` — thay thế upload từ DB sang `put()`, thêm `del()` khi replace logo

### Task 2: Migration script + API route fallback
**Files tạo/sửa:**
- `scripts/migrate-logos.ts` — script idempotent migrate logos từ DB → Blob
- `app/api/company/[id]/logo/route.ts` — redirect nếu `logoUrl` set, else serve `logoData`

### Task 3: Cache tags
**Files tạo/sửa:**
- `lib/cache/tags.ts` — tag constants
- `lib/cv/actions.ts` — 2 revalidatePath → revalidateTag
- `lib/applications/actions.ts` — 3 revalidatePath → revalidateTag
- `lib/jobs/actions.ts` — 2 revalidatePath → revalidateTag
- `lib/company/actions.ts` — 1 revalidatePath → revalidateTag
- `lib/notifications/actions.ts` — 1 revalidatePath → revalidateTag
- `lib/notifications/poll.ts` — wrap trong unstable_cache

### Task 4: next/image
**Files sửa:**
- `components/companies/CompanyCard.tsx` — `<img>` → `<Image>`
- `app/companies/[id]/page.tsx` — `<img>` → `<Image>`

## 4. Kiểm thử

- Mỗi task: `npx tsc --noEmit` + `npm run build` pass, `npm test` xanh (265 tests).
- Smoke thủ công Task 1: upload logo mới → hiện trên `/companies/[id]` từ blob URL.
- Smoke Task 2: chạy `npx tsx scripts/migrate-logos.ts` → verify logo cũ vẫn hiện, `logoData` null trong DB.
- Smoke Task 3: update job → `/jobs` không còn thấy data cũ sau revalidateTag.
- Smoke Task 4: inspect element trên CompanyCard → `<img>` là Next.js optimized image tag.

## 5. Môi trường

**Env mới** (không bắt buộc trong dev nếu không test logo upload):
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob read/write token

**Không thay đổi**: `DATABASE_URL`, `NODE_OPTIONS`, Prisma v6, proxy.ts conventions.

## 6. Definition of Done

- Company logo upload lưu lên Vercel Blob, không ghi vào DB bytes.
- Migration script chạy được, idempotent, migrate logo hiện có.
- API route redirect logo sang blob URL.
- Tất cả `revalidatePath` được thay bằng `revalidateTag`.
- Navbar notification query có `unstable_cache` 60s.
- 2 CompanyCard/company detail dùng `next/image`.
- `npm test` xanh, `npm run build` pass.

## 7. Ngoài phạm vi

- Xóa `force-dynamic` / migrate sang ISR → Gói F hoặc sau
- CV profile photo upload → không trong roadmap
- Avatar/image cho user profile → không trong roadmap
- Drop `logoData`/`logoMime` columns từ schema → sau khi production ổn định
