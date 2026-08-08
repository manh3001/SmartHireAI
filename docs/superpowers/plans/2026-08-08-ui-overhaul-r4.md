# UI Overhaul Vòng 4 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Token hóa nốt cụm UI cuối (nhắn tin, thông báo, công ty, admin), tái dùng component + thêm avatar công ty, giữ nguyên nghiệp vụ/realtime/guard admin.

**Architecture:** Đổi `blue-*/slate-*` sang design token vòng 1; tái dùng `Badge`, `CompanyAvatar`, `JobCard`, `StatCard`; DRY admin bằng cách thay `Stat` cục bộ bằng `StatCard`. Không đụng logic, auth, realtime, AI, schema.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Tailwind v4 (design tokens), shadcn/ui, Vitest.

## Global Constraints

- Prisma **pinned v6**; KHÔNG đổi schema, KHÔNG `db:push`.
- Vitest: chỉ unit-test logic thuần; vòng này thuần trình bày → KHÔNG thêm test.
- **Không đổi**: logic auth, phân quyền (đặc biệt `requireAdmin`), realtime polling, server actions, AI.
- Dùng token vòng 1, KHÔNG hardcode `blue-*/slate-*`. Ngoại lệ hợp lệ: `text-primary-foreground`/`text-white` trên nền màu; **màu ngữ nghĩa** (badge "Công khai" xanh, link xóa `text-destructive`).
- `className` dùng **dấu nháy thẳng ASCII** (`"`), không dấu ngoặc cong (sự cố tooling Windows các vòng trước).
- Nội dung tiếng Việt; thương hiệu **SmartHire**.
- Windows: `npm test`, `npm run lint`, `npm run build`.

---

## File Structure

**Sửa (token hóa, tái dùng component):**
- `app/messages/[applicationId]/page.tsx`, `app/messages/[applicationId]/MessageComposer.tsx`
- `app/notifications/page.tsx`, `app/notifications/NotificationItem.tsx`
- `app/companies/[id]/page.tsx` (+ CompanyAvatar + JobCard), `app/company/edit/page.tsx`
- `app/admin/page.tsx` (StatCard DRY), `app/admin/layout.tsx`, `app/admin/users/page.tsx`, `app/admin/jobs/page.tsx`

Không tạo file mới.

---

### Task 1: Token hóa Messaging (page + composer)

**Files:**
- Modify: `app/messages/[applicationId]/page.tsx`, `app/messages/[applicationId]/MessageComposer.tsx`

**Interfaces:**
- Consumes: `Badge` (`@/components/ui/badge`), `CompanyAvatar` (`@/components/CompanyAvatar`).

- [ ] **Step 1: Token hóa `page.tsx` (khung, header, bong bóng)**

Giữ nguyên `isThreadParticipant`, truy vấn, `iAmCandidate`/`otherName`/`backHref`. Thêm imports:
```tsx
import { Badge } from "@/components/ui/badge";
import CompanyAvatar from "@/components/CompanyAvatar";
```
Áp thay thế:
- `bg-slate-50` → `bg-muted/20`
- Back link `text-blue-600` → `text-primary`
- Thay khối header trái (h1 + p) bằng hàng có avatar:
  ```tsx
          <div className="flex items-center gap-2">
            <CompanyAvatar name={otherName} className="h-9 w-9 text-xs" />
            <div>
              <h1 className="text-lg font-semibold text-foreground">{otherName}</h1>
              <p className="text-sm text-muted-foreground">{app.job.title || "(chưa có tiêu đề)"}</p>
            </div>
          </div>
  ```
- Badge trạng thái: thay `<span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">{STATUS_LABELS[...]}</span>` → `<Badge>{STATUS_LABELS[app.status as ApplicationStatus]}</Badge>`
- Empty `text-slate-400` → `text-muted-foreground`
- Bong bóng: đổi biểu thức class:
  - mine: `bg-blue-600 text-white` → `bg-primary text-primary-foreground`
  - other: `border border-slate-200 bg-white text-slate-700` → `border border-border bg-card text-foreground`
  - timestamp mine: `text-blue-100` → `text-primary-foreground/70`; other: `text-slate-400` → `text-muted-foreground`

- [ ] **Step 2: Token hóa `MessageComposer.tsx`**

Giữ nguyên `sendMessage`/state. Đổi textarea `border border-slate-200 bg-white` → `border border-input bg-background`.

- [ ] **Step 3: Verify build**

Run: `npm run lint` rồi `npm run build`
Expected: thành công.

- [ ] **Step 4: Commit**

```bash
git add app/messages/[applicationId]/page.tsx app/messages/[applicationId]/MessageComposer.tsx
git commit -m "feat(messages): tokenize thread + composer (bubbles, avatar, Badge)"
```

---

### Task 2: Token hóa Notifications (page + item)

**Files:**
- Modify: `app/notifications/page.tsx`, `app/notifications/NotificationItem.tsx`

- [ ] **Step 1: Token hóa `page.tsx`**

Giữ truy vấn + `MarkAllButton`.
- `bg-slate-50` → `bg-muted/20`
- H1 `text-blue-700` → `text-foreground`
- Empty `text-slate-500` → `text-muted-foreground`

- [ ] **Step 2: Token hóa `NotificationItem.tsx`**

Giữ `markNotificationRead`/điều hướng. Đổi biểu thức class:
- read: `border-slate-200 bg-white` → `border-border bg-card`
- unread: `border-blue-200 bg-blue-50` → `border-primary/30 bg-primary/5`
- hover: `hover:border-blue-300` → `hover:border-primary/40`
- text read: `text-slate-600` → `text-muted-foreground`; unread: `font-medium text-slate-800` → `font-medium text-foreground`
- time `text-slate-400` → `text-muted-foreground`

- [ ] **Step 3: Verify build**

Run: `npm run lint`
Expected: không lỗi mới.

- [ ] **Step 4: Commit**

```bash
git add app/notifications/page.tsx app/notifications/NotificationItem.tsx
git commit -m "feat(notifications): tokenize list + item (read/unread tones)"
```

---

### Task 3: Token hóa Company (xem + sửa) — CompanyAvatar + JobCard

**Files:**
- Modify: `app/companies/[id]/page.tsx`, `app/company/edit/page.tsx`

**Interfaces:**
- Consumes: `CompanyAvatar` (`@/components/CompanyAvatar`), `JobCard` (`@/components/JobCard`).

- [ ] **Step 1: Token hóa `companies/[id]/page.tsx` + CompanyAvatar + JobCard**

Giữ truy vấn `companyProfile`/`jobs`.
- Imports: bỏ `Briefcase` và `JobMeta` (không còn dùng); thêm `import CompanyAvatar from "@/components/CompanyAvatar";` và `import JobCard from "@/components/JobCard";`. Giữ `Card, CardContent, CardHeader, CardTitle` (còn dùng cho card công ty + empty state).
- `bg-slate-50` → `bg-muted/20`; back link `text-blue-600` → `text-primary`
- Logo fallback: thay nhánh `else` `<span className="... bg-blue-100 text-blue-600"><Briefcase .../></span>` bằng `<CompanyAvatar name={company.name} className="h-14 w-14 text-lg" />` (giữ nhánh `img` khi có `logoUrl`).
- `CardTitle text-blue-700` → `text-foreground`; location `text-slate-500` → `text-muted-foreground`; website `text-blue-600` → `text-primary`; description `text-slate-700` → `text-foreground`
- H2 `text-slate-900` → `text-foreground`; empty `text-slate-500` → `text-muted-foreground`
- Danh sách tin: thay toàn bộ khối `.map` (Link + Card + JobMeta) bằng:
  ```tsx
  {jobs.map((j) => (
    <JobCard key={j.id} job={j} href={`/jobs/${j.id}`} />
  ))}
  ```
  (Shape `jobs` đã gồm đủ trường JobMeta → khớp `JobCardData`.)

- [ ] **Step 2: Token hóa `company/edit/page.tsx`**

Giữ `upsertCompanyProfile` + form.
- `bg-slate-50` → `bg-muted/20`
- Back link `text-blue-600` → `text-primary`
- `CardTitle text-blue-700` → `text-foreground`

- [ ] **Step 3: Verify build**

Run: `npm run lint` rồi `npm run build`
Expected: thành công (chú ý đã bỏ import `Briefcase`/`JobMeta` không dùng).

- [ ] **Step 4: Commit**

```bash
git add app/companies/[id]/page.tsx app/company/edit/page.tsx
git commit -m "feat(company): tokenize profile + edit (CompanyAvatar, JobCard reuse)"
```

---

### Task 4: Token hóa Admin (page + layout + users + jobs) — DRY StatCard

**Files:**
- Modify: `app/admin/page.tsx`, `app/admin/layout.tsx`, `app/admin/users/page.tsx`, `app/admin/jobs/page.tsx`

**Interfaces:**
- Consumes: `StatCard` (`@/components/StatCard`, props `{ label, value }`).

- [ ] **Step 1: Token hóa `layout.tsx`**

Giữ `requireAdmin`.
- `bg-slate-50` → `bg-muted/20`
- Nav `border-slate-200` → `border-border`
- 3 link `text-slate-600 hover:text-blue-600` → `text-muted-foreground hover:text-foreground`

- [ ] **Step 2: `admin/page.tsx` — thay `Stat` bằng `StatCard` (DRY) + token**

- Xóa hàm `Stat` cục bộ (dòng `function Stat(...) { ... }`) và import `Card, CardContent` (không còn dùng). Thêm `import StatCard from "@/components/StatCard";`
- Thay mọi `<Stat ... />` → `<StatCard ... />` (props `label`/`value` giữ nguyên).
- H1 `text-slate-900` → `text-foreground`
- 4 section `<h2 ... text-slate-500>` → `text-muted-foreground`
- Bar trạng thái: nhãn `text-slate-600` → `text-muted-foreground`; nền `bg-slate-100` → `bg-muted`; fill `bg-blue-500` → `bg-primary`; count `text-slate-700` → `text-foreground`

- [ ] **Step 3: Token hóa `admin/users/page.tsx` (bảng)**

Giữ truy vấn + `deleteUserAsAdmin` + `ConfirmSubmit`.
- H1 `text-slate-900` → `text-foreground`
- Bảng `border-slate-200 bg-white` → `border-border bg-card`
- thead `bg-slate-50 text-slate-500` → `bg-muted text-muted-foreground`
- rows `border-slate-100` → `border-border`
- cells: email/tên `text-slate-700` → `text-foreground`; vai `text-slate-600` → `text-muted-foreground`; đếm `text-slate-500` → `text-muted-foreground`; ngày `text-slate-400` → `text-muted-foreground`
- Nút xóa: `text-red-600` → `text-destructive` (giữ ngữ nghĩa)

- [ ] **Step 4: Token hóa `admin/jobs/page.tsx` (bảng)**

Giữ truy vấn + `setJobPublicAsAdmin`/`deleteJobAsAdmin` + `ConfirmSubmit`.
- H1 `text-slate-900` → `text-foreground`
- Bảng/thead/rows như Step 3
- cells: tiêu đề `text-slate-700` → `text-foreground`; công ty `text-slate-600` → `text-muted-foreground`; email `text-slate-500` → `text-muted-foreground`; ngày `text-slate-400` → `text-muted-foreground`
- Badge trạng thái: "Công khai" `bg-green-50 text-green-700` → GIỮ (ngữ nghĩa); "Ẩn" `bg-slate-100 text-slate-500` → `bg-muted text-muted-foreground`
- Nút "Gỡ/Công khai" `text-blue-600` → `text-primary`; nút xóa `text-red-600` → `text-destructive`

- [ ] **Step 5: Verify build**

Run: `npm run lint` rồi `npm run build`
Expected: thành công (chú ý bỏ `Stat`/`Card`/`CardContent` không dùng ở `admin/page.tsx`).

- [ ] **Step 6: Commit**

```bash
git add app/admin/page.tsx app/admin/layout.tsx app/admin/users/page.tsx app/admin/jobs/page.tsx
git commit -m "feat(admin): tokenize dashboard/layout/tables + StatCard DRY"
```

---

### Task 5: Rà soát cuối & kiểm thử tổng

**Files:** (rà soát)

- [ ] **Step 1: Grep màu hardcode còn sót trong phạm vi**

Dùng Grep tool tìm `blue-[0-9]|text-slate-|bg-slate-|border-slate-` trong toàn bộ file thuộc phạm vi (mục File Structure).
Expected: không còn (ngoại lệ hợp lệ: badge "Công khai" green ngữ nghĩa; `text-destructive` cho xóa). Sửa nốt nếu sót.

- [ ] **Step 2: Grep dấu ngoặc cong trong className**

Kiểm tra không có ký tự `“`/`”` (U+201C/U+201D) bên trong `className` ở các file đã sửa.

- [ ] **Step 3: Chạy toàn bộ test**

Run: `npm test`
Expected: PASS toàn bộ (không có test mới; đảm bảo không hồi quy).

- [ ] **Step 4: Build production**

Run: `npm run build`
Expected: thành công.

- [ ] **Step 5: (Khuyến nghị) Grep toàn repo màu hardcode còn sót ngoài phạm vi**

Grep `blue-[0-9]|text-slate-|bg-slate-|border-slate-` toàn `app/` + `components/`. Kỳ vọng chỉ còn ngoại lệ cố ý (`components/cv/CvPreview.tsx` nền giấy; `app/jobs/[id]/applicants/ApplicantsBoard.tsx` thứ tự class vô hại; màu ngữ nghĩa). Ghi lại các kết quả còn sót (không sửa ngoài phạm vi) để tham khảo vòng sau.

- [ ] **Step 6: Chạy thử thủ công (khuyến nghị)**

Run: `npm run dev` — kiểm tra nhắn tin (bong bóng), thông báo, trang công ty (avatar + list tin), admin (thống kê, bảng users/jobs).

- [ ] **Step 7: Commit dọn dẹp nếu có**

```bash
git add -A
git commit -m "chore(ui): finalize round-4 token cleanup"
```

---

## Self-Review (đã thực hiện khi viết plan)

- **Spec coverage:** messaging → Task 1; notifications → Task 2; company (xem+sửa, +avatar) → Task 3; admin (4 trang, +StatCard DRY) → Task 4; rà soát+build → Task 5. ✅ Toàn bộ file trong Phạm vi spec đều có task; avatar công ty được thêm ở Task 3 Step 1.
- **Placeholder scan:** không có TODO/TBD; mỗi bước liệt kê ánh xạ class cụ thể + code chèn (CompanyAvatar/JobCard/StatCard/Badge).
- **Type consistency:** `StatCard({ label, value })` khớp cách dùng `Stat` cũ; `JobCard`/`JobCardData` khớp shape `jobs` ở company page (đủ trường JobMeta); `CompanyAvatar({ name, className })` dùng nhất quán; `Badge` child là nhãn trạng thái.
- **Ràng buộc:** guard admin, realtime, server actions, truy vấn không đổi; badge "Công khai" green và link xóa `text-destructive` là ngoại lệ ngữ nghĩa có chủ đích.
