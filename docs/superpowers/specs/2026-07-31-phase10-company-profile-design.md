# Thiết kế: Hồ sơ công ty (Gói D2)

**Ngày:** 2026-07-31
**Tác giả:** Nguyễn Đức Mạnh
**Trạng thái:** Đã duyệt (chờ lập kế hoạch triển khai)

## 1. Bối cảnh & Mục tiêu

Hiện mỗi tin tuyển dụng chỉ có ô `company` là text tự do; nhà tuyển dụng (NTD) chưa có hồ sơ công ty, ứng viên không xem được thông tin công ty hay các tin khác cùng công ty. Gói D2 (phần còn lại của gói D, sau D1 "JD có cấu trúc") thêm:

1. **Hồ sơ công ty** cho mỗi NTD (tên, mô tả, website, địa điểm, logo URL).
2. **Trang công ty công khai** hiển thị hồ sơ + danh sách tin của công ty.
3. **Liên kết** từ tin và dashboard tới hồ sơ/trang công ty.

## 2. Mô hình dữ liệu

```prisma
model CompanyProfile {
  id          String   @id @default(cuid())
  userId      String   @unique
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String
  description String   @default("")
  website     String   @default("")
  location    String   @default("")
  logoUrl     String   @default("")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```
Quan hệ ngược: `User.companyProfile CompanyProfile?`. Một hồ sơ / mỗi NTD (`userId @unique`).

Giữ nguyên ô `company` (String) trên `JobDescription` — hồ sơ công ty là thực thể riêng, không đụng dữ liệu tin cũ. Không auto-điền tên công ty vào form đăng tin (YAGNI).

## 3. NTD chỉnh hồ sơ

### 3.1 Zod `lib/company/schema.ts`
- `companySchema`:
  - `name` bắt buộc (min 1).
  - `description`, `website`, `location`, `logoUrl` chuỗi (mặc định rỗng, không bắt buộc).
- Kiểu `CompanyInput = z.infer<typeof companySchema>`.
- **TDD.**

### 3.2 Action `lib/company/actions.ts` — `upsertCompanyProfile(formData)`
- `auth()` + role `RECRUITER`, nếu không → điều hướng phù hợp.
- Đọc FormData, validate bằng `companySchema`; sai → quay lại `/company/edit`.
- **Upsert** `CompanyProfile` theo `userId` (tạo mới nếu chưa có, cập nhật nếu đã có).
- `revalidatePath` trang liên quan; redirect về `/company/edit` (hoặc dashboard) sau khi lưu.

### 3.3 Trang `/company/edit` (SSR, chỉ RECRUITER)
- Nạp hồ sơ hiện tại (nếu có) → điền `defaultValue` vào form.
- Form: tên, mô tả (textarea), website, địa điểm, logo URL. Submit gọi `upsertCompanyProfile`.

## 4. Trang công ty công khai

- Route `app/companies/[id]/page.tsx` (SSR, `force-dynamic`, id = `CompanyProfile.id`). Yêu cầu đăng nhập (như các trang khác); mọi vai trò xem được.
- Nạp `CompanyProfile` theo `id`; không có → `notFound()`.
- Hiển thị: logo (nếu có `logoUrl`), tên, địa điểm, link website (nếu có), mô tả.
- Danh sách **tin công khai của công ty đó**: `JobDescription` có `userId = profile.userId` và `isPublic = true`, mới nhất trước; mỗi tin dùng lại thẻ (link `/jobs/[id]`) + badge `JobMeta` (đã có từ D1).

## 5. Liên kết

- **Trang chi tiết tin `/jobs/[id]`:** nếu NTD đăng tin có `CompanyProfile` → thêm link **"Xem trang công ty →"** tới `/companies/[profileId]`. (Nạp qua `job.user.companyProfile` hoặc truy vấn phụ.)
- **Dashboard NTD:** thêm link **"Hồ sơ công ty"** (→ `/company/edit`) và, nếu đã có hồ sơ, **"Xem trang công ty"** (→ `/companies/[id]`).

## 6. Xử lý lỗi & phân quyền

- Chỉ RECRUITER được vào `/company/edit` và `upsertCompanyProfile`; sai vai trò → redirect.
- `companySchema` chặn thiếu tên → quay lại form.
- Trang công ty với `id` không tồn tại → `notFound()`.
- Trường trống (website/location/logoUrl rỗng) hiển thị an toàn (ẩn phần tương ứng).
- Logo URL chỉ là chuỗi; render `<img>` với `alt`; URL hỏng thì trình duyệt tự xử lý (không cần validate nghiêm).

## 7. Kiểm thử

- **Unit (Vitest, TDD):** `companySchema` — chấp nhận input hợp lệ; từ chối thiếu `name`; các trường khác rỗng vẫn hợp lệ.
- **Glue (action)/UI/trang:** không unit-test (chuẩn dự án); an toàn bằng `npx tsc --noEmit` + `npm test` xanh.

## 8. Cấu trúc thư mục (dự kiến)

```
/prisma
  schema.prisma                 thêm model CompanyProfile + quan hệ ngược trên User
/lib/company
  schema.ts                     Zod companySchema
  actions.ts                    "use server": upsertCompanyProfile
  __tests__/schema.test.ts
/app
  company/edit/page.tsx         form chỉnh hồ sơ (SSR, RECRUITER)
  companies/[id]/page.tsx       trang công ty công khai
  jobs/[id]/page.tsx            thêm link "Xem trang công ty" (sửa)
  dashboard/page.tsx            thêm link hồ sơ/xem công ty (sửa)
```

## 9. Thứ tự xây dựng (dự kiến)

1. Prisma `CompanyProfile` + quan hệ + `db push`.
2. `companySchema` (Zod) — TDD.
3. `upsertCompanyProfile` action + trang `/company/edit`.
4. Trang công ty công khai `/companies/[id]` (hồ sơ + danh sách tin).
5. Liên kết: link từ `/jobs/[id]` + dashboard NTD.
