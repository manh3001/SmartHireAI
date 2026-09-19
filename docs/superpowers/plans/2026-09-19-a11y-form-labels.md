# Liên kết nhãn↔input trong form (a11y) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gắn `htmlFor`/`id` cho mọi `<Label>` chưa liên kết ở 6 file form (24 nhãn), để screen reader đọc đúng nhãn và click nhãn focus input — refactor markup, không đổi hành vi.

**Architecture:** Quét cơ học theo quy tắc: mỗi `<Label>…</Label>` đi kèm một input (Input/Textarea/select) → `<Label htmlFor="X">` + input `id="X"`, với `X` = `name` sẵn có của input. Chia 6 file thành 2 nhóm để review gọn. Bằng chứng không đổi hành vi: 535 test giữ xanh + tsc/lint/build sạch.

**Tech Stack:** Next.js 16 (App Router), React 19, shadcn `Input`/`Textarea`/`Label`, TypeScript.

## Global Constraints

- Refactor a11y attributes CHỈ (`htmlFor`, `id`, và `aria-label` nếu gặp control chỉ-icon thiếu nhãn trong 6 file). KHÔNG đổi `name`, handler, layout, class, logic.
- `id` = `name` sẵn có của input (duy nhất trong 1 form). Input không có `name` → `id` mô tả + `htmlFor` khớp.
- `<Label>` không kèm một input cụ thể (nhãn nhóm/tiêu đề) → giữ nguyên, ghi chú.
- Không đổi hành vi: toàn bộ 535 test giữ xanh.
- Copy tiếng Việt (giữ nguyên text nhãn hiện có). Commit tiếng Việt, prefix `refactor(a11y):`.
- Kết thúc: `npx tsc --noEmit` 0, `npm run lint` 0 error (2 warning tồn đọng chấp nhận), `npm test` 535 xanh, `npm run build` PASS.

**Quy tắc chuẩn (áp cho mọi cặp):**
```tsx
// TRƯỚC (Label và input là anh-em, không liên kết):
<div><Label>Tiêu đề vị trí</Label>
  <Input name="title" placeholder="..." required /></div>
// SAU:
<div><Label htmlFor="title">Tiêu đề vị trí</Label>
  <Input id="title" name="title" placeholder="..." required /></div>
```

---

### Task 1: Nhóm A — `CvEditor`, `NewJobForm`, `EvaluateClient`

**Files:**
- Modify: `app/cv/[id]/CvEditor.tsx`
- Modify: `app/jobs/new/NewJobForm.tsx`
- Modify: `app/cv/[id]/evaluate/EvaluateClient.tsx`

**Interfaces:** (không có API mới — chỉ thêm a11y attributes)

- [ ] **Step 1: Áp quy tắc cho từng file**

Với MỖI file, READ file, tìm từng `<Label>…</Label>` chưa có `htmlFor` đi kèm một input (Input/Textarea/select) trong cùng khối:
- Thêm `htmlFor="<X>"` vào `<Label>` và `id="<X>"` vào input, `X` = `name` của input đó.
- Nếu input không có `name`: đặt `id` mô tả (vd trong `NewJobForm` ô brief AI: `id="jd-brief"`) và `htmlFor` khớp; nếu ô đó chưa có `<Label>` bao thì bỏ qua (không tạo nhãn mới).
- Giữ nguyên mọi thuộc tính/handler/text khác.

Áp dụng đúng "Quy tắc chuẩn" ở trên cho toàn bộ cặp Label↔input trong 3 file này.

- [ ] **Step 2: Kiểm tra không còn Label rời trong 3 file (trừ nhãn nhóm)**

Run: `grep -n "<Label>" app/cv/[id]/CvEditor.tsx "app/jobs/new/NewJobForm.tsx" app/cv/[id]/evaluate/EvaluateClient.tsx`
Expected: chỉ còn (nếu có) các `<Label>` KHÔNG kèm input cụ thể (nhãn nhóm) — ghi chú; các `<Label>` kèm input đã chuyển thành `<Label htmlFor=...>`.

- [ ] **Step 3: Kiểm tra type + build**

Run: `npx tsc --noEmit && npm run build`
Expected: 0 lỗi type; build PASS (3 file vẫn build).

- [ ] **Step 4: Commit**

```bash
git add "app/cv/[id]/CvEditor.tsx" "app/jobs/new/NewJobForm.tsx" "app/cv/[id]/evaluate/EvaluateClient.tsx"
git commit -m "refactor(a11y): liên kết nhãn↔input (CvEditor, NewJobForm, EvaluateClient)"
```

---

### Task 2: Nhóm B — `company/edit`, `ProfileForm`, `InterviewModal` + kiểm tra tổng thể

**Files:**
- Modify: `app/company/edit/page.tsx`
- Modify: `app/settings/profile/ProfileForm.tsx`
- Modify: `components/InterviewModal.tsx`

**Interfaces:** (không có API mới)

- [ ] **Step 1: Áp quy tắc cho từng file**

Như Task 1: READ mỗi file, gắn `htmlFor`/`id` (`id` = `name`) cho từng cặp `<Label>`↔input (Input/Textarea/select). Input không có `name` → `id` mô tả + `htmlFor` khớp. Giữ nguyên mọi thứ khác.

- [ ] **Step 2: Kiểm tra không còn Label rời trong 3 file (trừ nhãn nhóm)**

Run: `grep -n "<Label>" app/company/edit/page.tsx app/settings/profile/ProfileForm.tsx components/InterviewModal.tsx`
Expected: chỉ còn (nếu có) nhãn nhóm không kèm input — ghi chú.

- [ ] **Step 3: Kiểm tra tổng thể (bằng chứng không đổi hành vi)**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: tsc 0; lint 0 error (2 warning tồn đọng chấp nhận); toàn bộ **535 test XANH** (không đổi hành vi); build PASS.

- [ ] **Step 4: Commit**

```bash
git add app/company/edit/page.tsx app/settings/profile/ProfileForm.tsx components/InterviewModal.tsx
git commit -m "refactor(a11y): liên kết nhãn↔input (company edit, ProfileForm, InterviewModal)"
```

---

## Việc người dùng phải tự làm sau khi merge
Không có (refactor markup). Kiểm tay: axe DevTools / screen reader trên các form — click nhãn phải
focus vào input tương ứng; screen reader đọc nhãn khi focus input.

## Để dành vòng sau
Skip-to-content + landmark `id` cho `<main>`; focus-visible; ARIA roles cho dialog/bảng; a11y trang công khai.
