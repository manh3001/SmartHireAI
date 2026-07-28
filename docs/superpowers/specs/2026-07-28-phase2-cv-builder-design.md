# Thiết kế Phase 2: CV Builder (tạo/sửa/xem CV + xuất PDF)

**Ngày:** 2026-07-28
**Tác giả:** Nguyễn Đức Mạnh
**Trạng thái:** Đã duyệt (chờ lập kế hoạch triển khai)
**Tiền đề:** Nối tiếp Phase 1 (nền tảng + xác thực đã xong). Xem `2026-07-27-cv-ai-platform-design.md` cho thiết kế tổng thể.

## 1. Mục tiêu

Cho ứng viên **tạo nhiều CV**, mỗi CV gồm 5 mục có cấu trúc (Profile, Experience, Education, Skill, Project), sửa trên một trang, và **xuất ra PDF đẹp**. Dữ liệu CV có cấu trúc là nền tảng cho Phase 3 (AI đánh giá CV theo JD).

## 2. Phạm vi

**Trong phạm vi:**
- Danh sách CV trên dashboard: tạo mới, mở, xóa.
- Trang sửa CV `/cv/[id]`: một trang, mỗi mục là một card; các mục nhiều dòng (Experience, Education, Skill, Project) có nút Thêm/Xóa dòng.
- Đủ 5 mục: Profile, Experience[], Education[], Skill[], Project[].
- Lưu toàn bộ CV bằng một nút "Lưu" (Server Action + transaction).
- Xuất CV ra PDF bằng `@react-pdf/renderer`, tải file về.
- Kiểm soát quyền: chỉ chủ sở hữu xem/sửa/xuất CV của mình.
- Giao diện dùng shadcn/ui.

**Ngoài phạm vi (Phase sau):**
- AI đánh giá CV, skill gap, chatbot (Phase 3–4).
- Upload PDF tự động điền form (stretch).
- Nhiều template PDF (chỉ làm 1 template sạch cho MVP).

## 3. Kiến trúc & luồng

```
Dashboard  ──►  Danh sách CV (tạo / mở / xóa)
                      │
                      ▼
              /cv/[id]  (trang sửa, 1 trang nhiều card)
                      │  Lưu (Server Action, transaction)
                      ▼
                 PostgreSQL (Neon) qua Prisma
                      │
                      ▼
        /api/cv/[id]/pdf  ──►  react-pdf render  ──►  tải file .pdf
```

- Dùng **Next.js Server Actions** cho tạo/sửa/xóa CV thay cho API route CRUD → ít code, hợp App Router.
- Xuất PDF dùng **API route** (`/api/cv/[id]/pdf`) vì cần trả về file nhị phân tải xuống.
- Mọi thao tác đọc/ghi kiểm tra `userId` lấy từ session (`auth()`); user chỉ chạm được CV của mình.

## 4. Mô hình dữ liệu (thêm vào `prisma/schema.prisma`)

```prisma
model CV {
  id         String       @id @default(cuid())
  userId     String
  user       User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  title      String       @default("CV chưa đặt tên")
  profile    Profile?
  experiences Experience[]
  educations Education[]
  skills     Skill[]
  projects   Project[]
  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @updatedAt
}

model Profile {
  id       String  @id @default(cuid())
  cvId     String  @unique
  cv       CV      @relation(fields: [cvId], references: [id], onDelete: Cascade)
  fullName String
  headline String  @default("")
  email    String  @default("")
  phone    String  @default("")
  summary  String  @default("")
}

model Experience {
  id          String @id @default(cuid())
  cvId        String
  cv          CV     @relation(fields: [cvId], references: [id], onDelete: Cascade)
  company     String
  position    String
  startDate   String @default("")   // dạng "2023-01", tránh rắc rối timezone
  endDate     String @default("")
  description String @default("")
  order       Int    @default(0)
}

model Education {
  id        String @id @default(cuid())
  cvId      String
  cv        CV     @relation(fields: [cvId], references: [id], onDelete: Cascade)
  school    String
  major     String @default("")
  startDate String @default("")
  endDate   String @default("")
  order     Int    @default(0)
}

model Skill {
  id    String @id @default(cuid())
  cvId  String
  cv    CV     @relation(fields: [cvId], references: [id], onDelete: Cascade)
  name  String
  level String @default("")   // vd: Beginner / Intermediate / Advanced
  order Int    @default(0)
}

model Project {
  id          String @id @default(cuid())
  cvId        String
  cv          CV     @relation(fields: [cvId], references: [id], onDelete: Cascade)
  name        String
  description String @default("")
  tech        String @default("")   // danh sách công nghệ, phân tách bằng dấu phẩy
  link        String @default("")
  order       Int    @default(0)
}
```

Cần thêm quan hệ ngược `cvs CV[]` vào model `User`.

**Quyết định thiết kế:**
- Ngày tháng lưu dạng chuỗi `"YYYY-MM"` — đơn giản, đủ cho CV, tránh timezone.
- `onDelete: Cascade` khắp nơi → xóa CV (hoặc User) tự xóa mục con.
- `order` (Int) để giữ thứ tự các dòng do người dùng sắp xếp.
- Các trường text mặc định `""` để form và AI không phải xử lý null.

## 5. Cách lưu — Server Action + transaction

- Một Server Action `saveCv(cvId, data)`:
  1. Kiểm tra CV thuộc về user hiện tại (từ `auth()`).
  2. Validate `data` bằng Zod (`cvSchema` dùng chung client + server).
  3. Trong một `prisma.$transaction`: cập nhật `title` + `Profile` (upsert); với các mục nhiều dòng, **xóa hết dòng cũ rồi tạo lại** theo `order` (đơn giản, chắc chắn nhất quán).
- Kiểu lưu "cả CV một lần": người dùng bấm **Lưu**, gửi toàn bộ state form.
- Trả về kết quả `{ ok, error? }`; UI hiện toast thành công / lỗi.

## 6. Xuất PDF — react-pdf

- `lib/pdf/CvDocument.tsx`: component `@react-pdf/renderer` định nghĩa layout PDF (tách hoàn toàn khỏi UI web). Một template sạch: tên + headline trên đầu, rồi các mục.
- `app/api/cv/[id]/pdf/route.ts`: kiểm tra quyền → lấy CV đầy đủ từ DB → `renderToBuffer(<CvDocument cv={...} />)` → trả `Response` với `Content-Type: application/pdf` và `Content-Disposition: attachment`.
- Nút "Xuất PDF" ở trang `/cv/[id]` trỏ tới route này.

## 7. Validation & xử lý lỗi

- `lib/cv/schema.ts`: `cvSchema` (Zod) cho toàn bộ CV, dùng ở cả client (trước khi gửi) và server (trong Server Action). Quy tắc tối thiểu: Profile cần `fullName`; mỗi Experience cần `company` + `position`; mỗi Education cần `school`; mỗi Skill cần `name`; mỗi Project cần `name`. Dòng trống hoàn toàn thì bỏ qua khi lưu.
- Server Action trả lỗi mềm (không throw ra UI); form hiện thông báo.
- Truy cập CV không thuộc về mình → trả 404/redirect, không lộ dữ liệu.

## 8. Kiểm thử (Vitest, TDD cho logic thuần)

- `cvSchema` — validate từng mục, loại dòng trống (TDD).
- Hàm chuẩn hóa dữ liệu trước khi lưu: gán `order`, bỏ dòng trống, trim (TDD).
- Hàm chuẩn bị dữ liệu cho PDF (sắp xếp theo `order`) (TDD).
- Không test E2E browser (YAGNI). Việc lưu DB thật kiểm tra thủ công + một lần chạy end-to-end khi hoàn tất.

## 9. Cấu trúc file (thêm mới)

```
/app
  /dashboard/page.tsx        cập nhật: danh sách CV + nút tạo/xóa
  /cv/[id]/page.tsx          trang sửa CV (server component nạp dữ liệu)
  /cv/[id]/CvEditor.tsx      client component: form nhiều card
  /api/cv/[id]/pdf/route.ts  xuất PDF
/lib
  /cv/schema.ts              Zod schema dùng chung
  /cv/actions.ts             Server Actions: createCv, saveCv, deleteCv
  /cv/normalize.ts           chuẩn hóa dữ liệu (thuần, có test)
  /pdf/CvDocument.tsx        layout PDF react-pdf
/components/ui/*             shadcn/ui (input, button, card, textarea, label, ...)
```

## 10. Giao diện (shadcn/ui)

- Cài shadcn/ui; dùng Input, Textarea, Button, Card, Label, (Sonner cho toast).
- Nâng cấp trang login/register/dashboard Phase 1 sang shadcn cho đồng nhất (nhẹ, không bắt buộc; làm nếu không phát sinh rủi ro).
- Trang sửa CV: mỗi mục một `Card`; mục nhiều dòng có nút "Thêm dòng" / "Xóa" từng dòng; cuối trang có nút **Lưu** và **Xuất PDF**.

## 11. Thứ tự triển khai (dự kiến, plan sẽ chi tiết hóa)

1. Prisma: thêm 6 model + quan hệ, `db push`.
2. shadcn/ui: cài đặt + các component cơ bản.
3. `cvSchema` + `normalize` (TDD).
4. Server Actions: createCv / deleteCv + danh sách CV trên dashboard.
5. Trang sửa CV `/cv/[id]` + saveCv (lưu cả CV).
6. Xuất PDF (CvDocument + route).
7. (Tùy chọn) nâng cấp UI Phase 1 sang shadcn.
