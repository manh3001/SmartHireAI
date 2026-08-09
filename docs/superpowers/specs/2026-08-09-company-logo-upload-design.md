# Upload logo công ty thật — Design Spec

**Ngày:** 2026-08-09

## Mục tiêu

Cho nhà tuyển dụng (RECRUITER) **tải lên file ảnh logo thật** cho hồ sơ công ty, thay vì dán URL. Ảnh lưu trong Neon DB (bytes) và phục vụ qua route nội bộ; `logoUrl` trỏ tới route đó. Mọi nơi đang hiển thị `logoUrl ? <img> : CompanyAvatar` (avatar chữ cái) hoạt động không đổi.

## Quyết định thiết kế (đã chốt khi brainstorm)

- **Nơi lưu:** bytes ảnh + mime lưu thẳng trong `CompanyProfile` (Neon Postgres); phục vụ qua route `/api/company/<id>/logo`. Không dùng dịch vụ/khóa ngoài (không Vercel Blob, không Supabase Storage). Danh sách công ty vẫn nhẹ (chỉ chứa URL string, không phải base64).
- **Giới hạn ảnh:** PNG/JPEG/WebP, tối đa 500KB. **Không resize phía server** (tránh thêm `sharp`), chỉ validate mime + size.
- **`logoUrl` là nguồn hiển thị duy nhất** (giữ nguyên để không sửa các nơi render).

## Phạm vi

**Trong phạm vi:** 2 cột mới trên `CompanyProfile` (`logoData`, `logoMime`); route GET phục vụ ảnh; helper thuần `validateLogo`; đổi form `/company/edit` từ dán-URL sang upload file (kèm xem trước + xóa logo); cập nhật `upsertCompanyProfile` xử lý file/xóa; bỏ `logoUrl` khỏi form nhập tay.

**Ngoài phạm vi:** resize/crop ảnh; nhiều ảnh/gallery; upload logo cho thực thể khác (chỉ công ty); giữ khả năng dán URL ngoài; CDN/dịch vụ storage ngoài.

## Kiến trúc

### 1. Data model (`prisma/schema.prisma`)

Thêm vào `model CompanyProfile` (đồng bộ `npm run db:push`, an toàn — chỉ thêm cột nullable):

```prisma
  logoData    Bytes?
  logoMime    String?
```

Giữ nguyên `logoUrl String @default("")`. Ngữ nghĩa mới của `logoUrl`:
- Khi có logo upload: `logoUrl = "/api/company/<profileId>/logo?v=<timestamp>"` (query `v` để bust cache trình duyệt sau mỗi lần đổi).
- Khi không có / đã xóa: `logoUrl = ""` (các nơi hiển thị rơi về `CompanyAvatar`).

### 2. Route phục vụ ảnh (`app/api/company/[id]/logo/route.ts`)

- `export const runtime = "nodejs";`
- GET công khai (logo là thông tin công khai — không cần auth).
- Đọc `CompanyProfile` theo `id`, lấy `logoData` + `logoMime`.
- Không có `logoData` hoặc `logoMime` không thuộc allowlist → `404`.
- Có → trả bytes với header:
  - `Content-Type: <logoMime>`
  - `Cache-Control: public, max-age=3600`
- Trả `new Response(new Uint8Array(logoData), { headers })` (giống cách route PDF trả buffer).

### 3. Validate thuần (`lib/company/logo.ts`)

```ts
export const LOGO_MAX_BYTES = 500 * 1024;
export const LOGO_MIME = ["image/png", "image/jpeg", "image/webp"] as const;
export type LogoMime = (typeof LOGO_MIME)[number];

export function isLogoMime(v: string): v is LogoMime;
export function validateLogo(file: { type: string; size: number }):
  | { ok: true }
  | { ok: false; error: string };
```

- `validateLogo`: mime không thuộc `LOGO_MIME` → `{ ok:false, error:"Chỉ hỗ trợ PNG, JPEG, WebP" }`; size `> LOGO_MAX_BYTES` → `{ ok:false, error:"Ảnh quá lớn (tối đa 500KB)" }`; size `<= 0` → coi như không có file (xử lý ở action). Hợp lệ → `{ ok:true }`.
- Hàm thuần → unit-test.

### 4. Luồng upload (form + action)

**`app/company/edit/page.tsx`:**
- Đọc thêm `logoUrl` trong select (đã có).
- Nhận `searchParams` (Promise) để hiện lỗi: nếu có `error`, render thẳng chuỗi đó (Next đã decode) trong một khối cảnh báo. Action redirect kèm `?error=<chuỗi lỗi đã encodeURIComponent>` từ `validateLogo`, nên page chỉ cần hiển thị, không map code.
- Thay khối "Logo (URL ảnh)" bằng:
  - Xem trước: `logoUrl ? <img src={logoUrl} .../> : <CompanyAvatar name={profile?.name ?? ""} />`.
  - `<input type="file" name="logo" accept="image/png,image/jpeg,image/webp" />`.
  - Checkbox `<input type="checkbox" name="removeLogo" value="1" />` "Xóa logo".
- Form thêm `encType="multipart/form-data"`.

**`upsertCompanyProfile` (`lib/company/actions.ts`):**
- Parse các trường text như cũ nhưng **bỏ `logoUrl`** khỏi `companySchema` input (không nhập tay nữa).
- Lấy `logo` (File) + `removeLogo` từ FormData.
- `upsert` hồ sơ với các trường text trước, `select: { id: true }` để có `profileId`.
- Sau đó xác định thay đổi logo:
  - `removeLogo === "1"` → `update` `{ logoData: null, logoMime: null, logoUrl: "" }`.
  - Else nếu `logo instanceof File && logo.size > 0`:
    - `validateLogo({ type: logo.type, size: logo.size })`; lỗi → `redirect("/company/edit?error=" + encodeURIComponent(error))`.
    - Hợp lệ → `update` `{ logoData: Buffer.from(await logo.arrayBuffer()), logoMime: logo.type, logoUrl: "/api/company/" + profileId + "/logo?v=" + Date.now() }`.
  - Else → không đụng tới logo (giữ nguyên).
- `revalidatePath("/company/edit")` rồi `redirect("/dashboard")` như cũ.

**`lib/company/schema.ts`:** bỏ trường `logoUrl` khỏi `companySchema` (giữ `httpUrlOrBlank` cho `website`). Cập nhật test schema tương ứng nếu có assert về `logoUrl`.

### 5. Hiển thị & fallback (hầu hết đã có)

Các nơi đã dùng `logoUrl ? <img> : CompanyAvatar`: `components/companies/CompanyCard.tsx`, `app/companies/[id]/page.tsx`, `components/jobs/JobDetail.tsx`, `components/JobCard.tsx`, `app/messages/[applicationId]/page.tsx`, `app/jobs/[id]/applicants/*`. **Không đổi logic.** Rà lại khi triển khai để chắc mỗi query có `logoUrl` trong `select`; nếu thiếu thì thêm.

## Cấu trúc file

**Tạo mới:**
- `app/api/company/[id]/logo/route.ts`
- `lib/company/logo.ts` + `lib/company/__tests__/logo.test.ts`

**Sửa:**
- `prisma/schema.prisma` (2 cột trên `CompanyProfile`)
- `lib/company/actions.ts` (`upsertCompanyProfile` xử lý file/xóa)
- `lib/company/schema.ts` (bỏ `logoUrl`) + `lib/company/__tests__/schema.test.ts` nếu cần
- `app/company/edit/page.tsx` (form upload + xem trước + lỗi)

## Kiểm thử

- **Unit (thuần):** `logo.test.ts` — `validateLogo` chấp nhận PNG/JPEG/WebP; từ chối mime lạ (`image/gif`, `application/pdf`) và file >500KB, kèm đúng thông báo; `isLogoMime`.
- **Không** unit-test route/action/page (theo quy ước dự án).
- `npm run lint` + `npm run build` phải xanh.
- **Kiểm thử tay (user):** NTD vào `/company/edit`, tải logo PNG hợp lệ → Lưu → logo hiện ở `/company/edit`, `/companies`, trang công ty, `JobCard`/`JobDetail`. File quá lớn/sai định dạng → thấy báo lỗi. Tick "Xóa logo" → về avatar chữ cái.

## Ràng buộc & quy ước

- Prisma **pinned v6**; chỉ thêm 2 cột nullable, đồng bộ `npm run db:push` (không migration tay).
- **Không thêm dependency** (không `sharp`, không `@vercel/blob`).
- `className` nháy thẳng ASCII; nội dung tiếng Việt; **SmartHire**.
- Không đổi AI, auth, realtime, phân quyền, `CvInput`.
- Chỉ RECRUITER sửa hồ sơ công ty (giữ guard hiện có trong `upsertCompanyProfile`). Route logo công khai (GET, chỉ đọc bytes).
- Windows: `npm test`, `npm run lint`, `npm run build`, `npm run db:push`.
