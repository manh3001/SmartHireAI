# Nền tảng CV thông minh (CV AI Platform)

Nền tảng tìm việc kết hợp **AI đánh giá & tạo CV**. Ứng viên tạo CV có cấu trúc, xuất PDF, và (đang phát triển) được AI đánh giá độ phù hợp theo mô tả công việc (JD).

> Dự án portfolio cá nhân — tập trung vào một demo chạy được, dùng công nghệ hiện đại mà nhà tuyển dụng nhận ra.

## Tính năng

**Đã có (Phase 1 & 2):**
- 🔐 Đăng ký / đăng nhập (Auth.js v5, mật khẩu băm bcrypt)
- 📝 CV Builder: tạo nhiều CV với 5 mục (thông tin cá nhân, kinh nghiệm, học vấn, kỹ năng, dự án)
- 💾 Lưu vào PostgreSQL qua Server Actions
- 📄 Xuất CV ra PDF (hỗ trợ tiếng Việt)

**Đang phát triển (Phase 3+):**
- ⭐ AI đánh giá CV theo JD (điểm số, điểm mạnh/yếu, kỹ năng còn thiếu)
- 💬 Chatbot tư vấn nghề nghiệp có ngữ cảnh CV

## Công nghệ

| Lớp | Công nghệ |
|-----|-----------|
| Framework | Next.js 16 (App Router), TypeScript |
| UI | Tailwind CSS v4, shadcn/ui |
| Database | PostgreSQL (Neon) + Prisma |
| Auth | Auth.js v5 (NextAuth) |
| PDF | @react-pdf/renderer |
| Validation | Zod (dùng chung client + server) |
| Test | Vitest (TDD cho logic cốt lõi) |

## Chạy dự án

```bash
# 1. Cài dependencies
npm install

# 2. Tạo file .env (xem .env.example)
#    DATABASE_URL="postgresql://..."   (Neon hoặc PostgreSQL bất kỳ)
#    AUTH_SECRET="..."                 (sinh bằng: npx auth secret)

# 3. Đẩy schema lên database
npm run db:push

# 4. Chạy dev server
npm run dev
```

Mở http://localhost:3000.

## Kiểm thử

```bash
npm test
```

## Cấu trúc chính

```
app/            Trang & API route (App Router)
  cv/[id]/      Trình sửa CV
  api/cv/[id]/pdf   Xuất PDF
lib/
  auth/         Validate + băm mật khẩu
  cv/           Schema, chuẩn hóa, Server Actions
  pdf/          Layout PDF (react-pdf)
  db/           Prisma client
prisma/         schema.prisma
```

## Tài liệu thiết kế

Bản thiết kế & kế hoạch triển khai từng giai đoạn nằm trong `docs/superpowers/`.
