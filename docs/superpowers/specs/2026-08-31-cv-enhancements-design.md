# CV Enhancements — Vòng 1 Design Spec

**Ngày:** 2026-08-31  
**Tính năng:** Nhiều phiên bản CV · Link CV công khai · Tab Phân tích AI  
**Trạng thái:** Approved, chờ implementation plan

---

## 1. Bối cảnh

Hiện tại mỗi tài khoản ứng viên chỉ có 1 CV. Ba tính năng vòng 1 bổ sung:

1. **Nhiều phiên bản CV** — tối đa 3 CV/ứng viên (freemium), quản lý từ dashboard
2. **Link CV công khai** — chia sẻ CV qua URL không cần đăng nhập, kèm trang hồ sơ đầy đủ
3. **Tab Phân tích AI** — tab thứ 3 trong CvEditor, phân tích on-demand trả về score + gợi ý cụ thể theo từng mục

---

## 2. Schema Changes

### Model `CV` — thêm 2 cột

```prisma
model CV {
  // ... các cột hiện có giữ nguyên ...
  isDefault   Boolean  @default(false)
  shareToken  String?  @unique
}
```

- `title` (đã có) dùng làm tên CV phân biệt — không thêm cột mới
- `isDefault`: CV được chọn mặc định khi ứng tuyển. Mỗi user chỉ có 1 CV `isDefault = true`; server action `setDefaultCv` dùng transaction để unset cũ rồi set mới
- `shareToken`: `null` = chưa chia sẻ; có giá trị (nanoid 12 ký tự) = public. Tắt chia sẻ → set `null` (link cũ hỏng ngay). Bật lại → sinh token mới

### Không thêm model mới

Thông tin public page lấy từ `Profile` (liên kết qua `CV`), không cần model riêng.

---

## 3. Nhiều phiên bản CV

### Giới hạn

- CANDIDATE: tối đa 3 CV. Kiểm tra trong server action `createCv` (guard code, không dùng DB constraint để dễ nới sau)
- RECRUITER/ADMIN: không có CV — không áp dụng

### Trang quản lý CV — `/dashboard` (section CV)

Thêm section "CV của tôi" phía trên dashboard stats hiện có. Hiển thị dạng card grid:

```
┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────┐
│ [Classic] CV chính  │  │ [Modern] CV IT       │  │      +       │
│ Sửa 2 ngày trước   │  │ Sửa hôm nay         │  │  Tạo CV mới  │
│ ★ Mặc định          │  │                     │  │  (còn 1/3)   │
│ [Sửa][Chia sẻ][⋮] │  │ [Sửa][Chia sẻ][⋮] │  └──────────────┘
└─────────────────────┘  └─────────────────────┘
```

Mỗi card hiển thị: tên CV (`title`), template badge, thời gian sửa cuối, badge "★ Mặc định" nếu `isDefault = true`.

**Menu ⋮ mỗi card:**
- Đổi tên → inline edit `title`
- Đặt làm mặc định → gọi `setDefaultCv(id)`
- Xóa → xác nhận modal

**Ràng buộc xóa:**
- Không xóa CV `isDefault` nếu còn CV khác (hiện thông báo "Hãy đặt CV khác làm mặc định trước")
- Nếu CV đang dùng trong Application active (`SUBMITTED`/`SCREENING`/`INTERVIEW`/`OFFER`) → warn nhưng không block

**Tạo CV mới:**
- Bấm "+ Tạo CV mới" → modal hỏi tên + chọn template → tạo CV trống (dùng `emptyCv()`) → redirect vào `/cv/[id]`
- Đã có 3 CV → modal báo giới hạn, không cho tạo

### Server actions mới

| Action | Mô tả |
|---|---|
| `createCv(name, template)` | Guard ≤3, tạo CV trống, set `isDefault` nếu là CV đầu tiên |
| `renameCv(id, title)` | Cập nhật `title`, verify ownership |
| `setDefaultCv(id)` | Transaction: unset `isDefault` tất cả CV cùng user, set `id` |
| `deleteCv(id)` | Guard isDefault + active applications, xóa cascade |

### Form ứng tuyển — cập nhật

`/jobs/[id]/apply/ApplyForm.tsx` hiện lấy CV đầu tiên tìm được. Thay bằng:
- Nếu user có >1 CV → hiện dropdown chọn CV (mặc định chọn `isDefault`)
- Nếu chỉ có 1 CV → giữ như cũ (không hiện dropdown)

---

## 4. Link CV công khai

### Route công khai

`GET /cv/share/[token]` — Server Component, không cần auth

**Luồng server:**
1. Lookup CV theo `shareToken`
2. Nếu không tìm thấy (token sai hoặc đã tắt) → `notFound()`
3. Render trang hồ sơ + preview

### Layout trang

```
┌─────────────────────────────────────────┐
│  [Avatar chữ cái]  Nguyễn Văn A        │
│  Frontend Developer                     │
│  📧 email@gmail.com  📞 0912...        │
│  🔗 linkedin.com/in/...                 │
│                          [Tải PDF ↓]   │
├─────────────────────────────────────────┤
│         CV Preview (HTML)               │
│      (dùng lại CvPreview hiện có)      │
└─────────────────────────────────────────┘
```

- Avatar: dùng `CompanyAvatar` kiểu chữ cái (đã có, không cần upload ảnh)
- Thông tin lấy từ `Profile` của CV: `fullName`, `headline`, `email`, `phone`, `linkedin`
- Nút "Tải PDF" → gọi `/api/cv/share/[token]/pdf` (route mới, verify token thay vì session)

### Toggle chia sẻ trong CvEditor

Thêm nút "Chia sẻ" trong thanh header CvEditor:
- Tắt → nút "Bật chia sẻ" → gọi `enableShare(id)` → sinh `nanoid(12)` → lưu token → hiện URL + nút copy
- Bật → hiện URL + nút copy + nút "Tắt chia sẻ" → gọi `disableShare(id)` → set `shareToken = null`

### PDF qua token

`GET /api/cv/share/[token]/pdf` — không cần session, verify bằng token:
```
1. Lookup CV by shareToken
2. notFound() nếu không có
3. Render PDF (tái dùng logic /api/cv/[id]/pdf hiện tại)
```

### Server actions

| Action | Mô tả |
|---|---|
| `enableShare(id)` | Verify ownership, sinh `nanoid(12)`, lưu `shareToken` |
| `disableShare(id)` | Verify ownership, set `shareToken = null` |

---

## 5. Tab Phân tích AI

### Vị trí trong CvEditor

Thêm tab "Phân tích" vào tab switcher mobile (hiện có "Chỉnh sửa" / "Xem trước"). Trên desktop: panel thứ 3 hoặc sidebar có thể toggle.

### UX

```
┌──────────────────────────────────────────┐
│  [Chỉnh sửa]  [Xem trước]  [Phân tích] │
├──────────────────────────────────────────┤
│  ✦ Điểm tổng thể: 72/100               │
│                                          │
│  ✅ Thông tin liên hệ — Đầy đủ          │
│  ⚠️  Kinh nghiệm — Thiếu số liệu cụ thể │
│     "Thêm con số: tăng 30% doanh thu..." │
│  ❌ Kỹ năng — Quá chung chung            │
│     "Liệt kê công cụ cụ thể: React,..." │
│  ⚠️  Học vấn — Thiếu GPA hoặc dự án     │
│                                          │
│         [Phân tích lại]                  │
└──────────────────────────────────────────┘
```

- Vào tab lần đầu → tự động gọi analyze (spinner)
- Sau khi sửa CV → hiện nút "Phân tích lại" (không tự động, tránh spam AI)
- Kết quả **không lưu DB** — tính lại mỗi lần

### API endpoint

`POST /api/cv/[id]/analyze` — auth required, verify ownership

**Response schema (Zod):**
```typescript
const analyzeResponseSchema = z.object({
  score: z.number().int().min(0).max(100),
  sections: z.array(z.object({
    name: z.string(),          // "Kinh nghiệm", "Kỹ năng", ...
    status: z.enum(["ok", "warning", "error"]),
    tip: z.string(),           // gợi ý cụ thể, rỗng nếu status = "ok"
  })),
});
```

**5 mục phân tích:**
1. Thông tin liên hệ — có đủ email, phone, headline không
2. Kinh nghiệm — có mô tả, số liệu cụ thể không
3. Học vấn — có đủ trường, GPA/dự án không
4. Kỹ năng — cụ thể hay chung chung
5. Tổng thể — độ dài phù hợp, có tóm tắt không

**AI prompt:** Dùng Gemini (như các tính năng AI hiện có), system prompt tiếng Việt, trả về JSON, parse qua Zod. Nếu parse lỗi → trả 500 (không fallback partial data).

### Component mới

`components/cv/CvAnalysis.tsx` — Client Component, nhận `cvId`, tự gọi endpoint khi mount, hiện spinner → kết quả.

---

## 6. Error Handling

| Tình huống | Xử lý |
|---|---|
| Tạo CV khi đã có 3 | Action trả lỗi, UI hiện toast "Đã đạt giới hạn 3 CV" |
| Xóa CV isDefault còn CV khác | Action trả lỗi, UI hiện modal hướng dẫn |
| Token share không tồn tại | `notFound()` → trang 404 |
| AI analyze lỗi / timeout | UI hiện "Phân tích thất bại, thử lại" + nút retry |
| PDF qua token thất bại | Trả 404 nếu token sai, 500 nếu render lỗi |

---

## 7. Testing

**Unit tests (vitest):**
- `createCv` guard: không tạo được CV thứ 4
- `setDefaultCv`: chỉ 1 CV có `isDefault = true` sau khi gọi
- `deleteCv`: không xóa được `isDefault` nếu còn CV khác
- `enableShare` / `disableShare`: token sinh/xóa đúng
- `analyzeResponseSchema`: parse JSON hợp lệ / reject JSON thiếu field

**Integration (manual):**
- Tạo 3 CV → thử tạo CV thứ 4 → thấy thông báo giới hạn
- Bật share → mở link ẩn danh → thấy trang hồ sơ + PDF tải được
- Tắt share → mở link cũ → thấy 404
- Tab Phân tích → sửa CV → bấm "Phân tích lại" → thấy kết quả mới

---

## 8. Phạm vi không làm (YAGNI)

- Không upload avatar ứng viên (dùng chữ cái)
- Không email notification khi CV được xem
- Không đếm lượt xem link public
- Không cho RECRUITER/ADMIN tạo CV
- Không tự động phân tích khi sửa xong (chỉ on-demand)
- Không lưu lịch sử kết quả phân tích AI
