# Nền tảng CV thông minh (CV AI Platform)

Sàn tuyển dụng 2 chiều tích hợp **AI**: ứng viên tạo CV có cấu trúc, xuất PDF và được AI đánh giá độ phù hợp với mô tả công việc (JD); nhà tuyển dụng đăng tin, được AI sàng lọc hồ sơ và trao đổi trực tiếp với ứng viên.

> Dự án portfolio cá nhân — ưu tiên một demo chạy được đầu-cuối.

---

## Tính năng

**Tài khoản & phân quyền**
- 🔐 Đăng ký / đăng nhập (Auth.js v5, mật khẩu băm bcrypt)
- 👥 3 vai trò: **Ứng viên**, **Nhà tuyển dụng**, **Quản trị viên** — mỗi vai trò có bảng điều khiển riêng
- 🛠️ Trang quản trị: quản lý người dùng, tin tuyển dụng, thống kê toàn sàn

**Ứng viên**
- 📝 CV Builder: tạo nhiều CV với 5 mục (thông tin cá nhân, kinh nghiệm, học vấn, kỹ năng, dự án)
- 📄 Xuất CV ra PDF (hỗ trợ tiếng Việt) và 📥 nhập CV từ PDF có sẵn
- ⭐ AI đánh giá CV theo JD: điểm số, điểm mạnh/yếu, kỹ năng còn thiếu
- 💬 Chatbot tư vấn nghề nghiệp có ngữ cảnh CV
- 🔎 Khám phá việc làm, 🎯 gợi ý việc phù hợp, 💾 lưu tin
- 📨 Ứng tuyển và theo dõi trạng thái đơn

**Nhà tuyển dụng**
- 🧾 Đăng tin tuyển dụng có cấu trúc (mức lương, loại hình, cấp bậc…)
- 🏢 Hồ sơ công ty
- 🤖 AI sàng lọc ứng viên theo JD
- 📊 Quản lý đơn ứng tuyển theo từng trạng thái

**Chung**
- 💬 Nhắn tin trực tiếp giữa ứng viên và nhà tuyển dụng trong từng đơn
- 🔔 Thông báo + **cập nhật realtime** (badge, danh sách thông báo, tin nhắn tự làm mới, toast — bằng polling nhẹ, phù hợp serverless)
- 🔒 Bảo vệ route tập trung (`proxy.ts`), security headers (CSP/HSTS…), rate-limit đăng nhập/đăng ký/AI, yêu cầu độ mạnh mật khẩu

---

## Công nghệ

| Lớp | Công nghệ |
|-----|-----------|
| Framework | Next.js 16 (App Router, Server Actions, Turbopack), TypeScript |
| UI | Tailwind CSS v4, shadcn/ui, sonner (toast), lucide-react |
| Database | PostgreSQL (Neon) + Prisma 6 |
| Auth | Auth.js v5 (NextAuth), bcryptjs |
| AI | Gemini 2.5 Flash qua endpoint tương thích OpenAI (SDK `openai`) |
| PDF | @react-pdf/renderer (xuất) · unpdf (nhập) |
| Validation | Zod (dùng chung client + server) |
| Test | Vitest (TDD cho logic cốt lõi) |

---

## Yêu cầu trước khi chạy

- **Node.js 20 trở lên** và npm
- Một **cơ sở dữ liệu PostgreSQL** — khuyến nghị [Neon](https://neon.tech) (miễn phí)
- Một **Gemini API key** (miễn phí) tại [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — cần cho các tính năng AI (đánh giá, chatbot, sàng lọc, nhập CV)

---

## Chạy dự án

```bash
# 1. Cài dependencies
npm install

# 2. Tạo file .env ở thư mục gốc (tham khảo .env.example)
cp .env.example .env
#    rồi điền 3 biến bên dưới

# 3. Đẩy schema Prisma lên database
npm run db:push

# 4. Chạy dev server
npm run dev
```

Mở **http://localhost:3000**.

### Biến môi trường (`.env`)

| Biến | Bắt buộc | Mô tả |
|------|:---:|-------|
| `DATABASE_URL` | ✅ | Chuỗi kết nối PostgreSQL, ví dụ `postgresql://user:pass@host/db?sslmode=require` |
| `AUTH_SECRET` | ✅ | Khóa bí mật cho Auth.js — sinh bằng `npx auth secret` |
| `GEMINI_API_KEY` | ✅* | API key Gemini. *Bắt buộc để các tính năng AI hoạt động; phần còn lại của app vẫn chạy nếu thiếu |
| `RESEND_API_KEY` | ❌ | API key Resend để gửi email thông báo; bỏ trống thì chỉ in log, không gửi thật |
| `EMAIL_FROM` | ❌ | Địa chỉ gửi email (mặc định `SmartHire <onboarding@resend.dev>`) |
| `UPSTASH_REDIS_REST_URL` | ❌ | URL Upstash Redis cho rate-limit dùng chung; bỏ trống → fallback in-memory (hợp dev/test, không đúng với nhiều instance) |
| `UPSTASH_REDIS_REST_TOKEN` | ❌ | Token xác thực Upstash Redis; bỏ trống → fallback in-memory (chỉ đúng trong 1 instance / hợp dev-test, không đúng với nhiều instance) |

### Cấp quyền quản trị

Đăng ký một tài khoản qua giao diện, sau đó nâng lên ADMIN:

```bash
npm run make-admin -- your@email.com
```

---

## Các lệnh npm

| Lệnh | Tác dụng |
|------|----------|
| `npm run dev` | Chạy dev server (Turbopack) |
| `npm run build` | Build production |
| `npm start` | Chạy bản production đã build |
| `npm run db:push` | Đồng bộ schema Prisma lên database |
| `npm run make-admin -- <email>` | Cấp quyền ADMIN cho một tài khoản |
| `npm test` | Chạy toàn bộ test (Vitest) |
| `npm run test:watch` | Chạy test ở chế độ watch |
| `npm run lint` | Kiểm tra ESLint |

> Các lệnh gọi tới database đều đặt `NODE_OPTIONS=--dns-result-order=ipv4first` để tránh lỗi kết nối IPv6 với Neon (xem mục Xử lý sự cố).

---

## Kiểm thử

```bash
npm test
```

Test tập trung vào **logic thuần** (schema, chuẩn hóa dữ liệu, tính điểm, quyết định realtime…) theo hướng TDD. Các hàm chạm database / route / component React không unit-test.

---

## Cấu trúc chính

```
app/                       Trang & API route (App Router)
  cv/[id]/                 Trình sửa CV
  jobs/                    Danh sách, chi tiết, đăng tin, gợi ý, tin đã lưu
  applications/            Đơn ứng tuyển của ứng viên
  messages/[applicationId] Nhắn tin trong một đơn
  notifications/           Thông báo
  dashboard/               Bảng điều khiển theo vai trò
  admin/                   Quản trị (người dùng, tin, thống kê)
  companies/ · company/    Hồ sơ công ty (xem / chỉnh sửa)
  api/
    realtime/              Endpoint polling cho cập nhật realtime
    cv/[id]/pdf            Xuất PDF
    cv/import              Nhập CV từ PDF
    register/ · auth/      Đăng ký & Auth.js
lib/
  auth/                    Validate + băm mật khẩu
  cv/                      Schema, chuẩn hóa, Server Actions
  ai/                      Client Gemini, đánh giá, chatbot, sàng lọc, gợi ý
  applications/            Trạng thái & vòng đời đơn ứng tuyển
  messages/ · notifications/  Nhắn tin & thông báo (+ realtime polling)
  jobs/ · companies/ · admin/ Nghiệp vụ tương ứng
  pdf/                     Layout PDF (react-pdf)
  db/                      Prisma client
prisma/                    schema.prisma
scripts/                   Tiện ích (make-admin…)
docs/superpowers/          Bản thiết kế & kế hoạch triển khai từng phase
```

---

## Xử lý sự cố

- **Prisma báo `P1001` / không kết nối được Neon:** thường do IPv6 hỏng trên máy. Các script trong dự án đã ép IPv4 sẵn (`--dns-result-order=ipv4first`); nếu chạy lệnh Prisma thủ công, thêm `NODE_OPTIONS=--dns-result-order=ipv4first` phía trước.
- **Tính năng AI báo `Chưa cấu hình GEMINI_API_KEY`:** thiếu `GEMINI_API_KEY` trong `.env`.
- **Đăng nhập lỗi sau khi đổi `.env`:** khởi động lại dev server để nạp lại biến môi trường.

---

## Tài liệu thiết kế

Bản thiết kế (spec) và kế hoạch triển khai từng giai đoạn nằm trong `docs/superpowers/specs/` và `docs/superpowers/plans/`.
