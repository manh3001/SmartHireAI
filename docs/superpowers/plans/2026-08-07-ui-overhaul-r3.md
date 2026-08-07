# UI Overhaul Vòng 3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Token hóa + trau chuốt toàn bộ trang còn lại trong `app/jobs/` (luồng nhà tuyển dụng + job-flow ứng viên còn sót), tái dùng component vòng 1, giữ nguyên nghiệp vụ/AI.

**Architecture:** Đổi `blue-*/slate-*` sang design token vòng 1; tái dùng `CompanyAvatar`, `Badge`, `JobCard`; thêm một component nhỏ dùng chung `ScoreBadge` (bọc `scoreColor` sẵn có) cho điểm phù hợp — giữ màu ngữ nghĩa đỏ/vàng/xanh. Không đụng logic drag-drop, server actions, hay AI.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Tailwind v4 (design tokens), shadcn/ui, Vitest.

## Global Constraints

- Prisma **pinned v6**; KHÔNG đổi schema, KHÔNG `db:push`.
- Vitest: chỉ unit-test logic thuần; không test component/route/DB. Vòng này chủ yếu trình bày → không thêm test trừ khi phát sinh hàm thuần mới.
- **Không đổi**: logic auth, phân quyền vai trò, realtime, server actions, AI, output PDF.
- Dùng token vòng 1 (`primary`, `foreground`, `muted-foreground`, `border`, `input`, `background`, `card`, `bg-muted/*`, `bg-primary/10`, `hover:text-destructive`), KHÔNG hardcode `blue-*/slate-*`. Ngoại lệ hợp lệ: **màu ngữ nghĩa** điểm số/shortlist (đỏ/vàng/xanh) và `text-white` trên nút gradient.
- Mọi `className` dùng **dấu nháy thẳng ASCII** (`"`), không dấu ngoặc cong (sự cố tooling Windows ở vòng 2).
- Nội dung tiếng Việt; thương hiệu **SmartHire**.
- Windows: `npm test`, `npm run lint`, `npm run build`.

---

## File Structure

**Tạo mới:**
- `components/ScoreBadge.tsx` — badge điểm phù hợp nhỏ, màu ngữ nghĩa qua `scoreColor`.

**Sửa (token hóa, dùng lại component):**
- `app/jobs/[id]/applicants/ApplicantsBoard.tsx`
- `app/jobs/[id]/applicants/page.tsx`, `app/jobs/[id]/applicants/[appId]/page.tsx`
- `app/jobs/[id]/screening/ScreeningClient.tsx`, `app/jobs/[id]/screening/page.tsx`
- `app/jobs/[id]/apply/ApplyForm.tsx`, `app/jobs/[id]/apply/page.tsx`
- `app/jobs/recommendations/RecommendClient.tsx`, `app/jobs/recommendations/page.tsx`
- `app/jobs/saved/page.tsx`
- `app/jobs/SaveJobButton.tsx`
- `app/jobs/[id]/EvaluateFromJob.tsx`

---

### Task 1: `ScoreBadge` + token hóa ApplicantsBoard (kanban)

**Files:**
- Create: `components/ScoreBadge.tsx`
- Modify: `app/jobs/[id]/applicants/ApplicantsBoard.tsx`

**Interfaces:**
- Consumes: `scoreColor` (`@/lib/ai/score`), `cn` (`@/lib/utils`), `CompanyAvatar` (`@/components/CompanyAvatar`).
- Produces: `export default function ScoreBadge({ score, className }: { score: number; className?: string })`.

- [ ] **Step 1: Tạo ScoreBadge**

`components/ScoreBadge.tsx`:

```tsx
import { scoreColor } from "@/lib/ai/score";
import { cn } from "@/lib/utils";

// Màu ngữ nghĩa (đỏ/vàng/xanh) theo điểm — CỐ Ý không dùng token brand.
const TONE: Record<"red" | "yellow" | "green", string> = {
  red: "bg-red-50 text-red-700",
  yellow: "bg-amber-50 text-amber-700",
  green: "bg-emerald-50 text-emerald-700",
};

export default function ScoreBadge({ score, className }: { score: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        TONE[scoreColor(score)],
        className,
      )}
    >
      {score}/100
    </span>
  );
}
```

- [ ] **Step 2: Token hóa ApplicantsBoard + thêm avatar + ScoreBadge**

Trong `app/jobs/[id]/applicants/ApplicantsBoard.tsx` (giữ nguyên `onDrop`/`setCards`/`setDragId`/`changeStatus` và mọi handler):
- Thêm import: `import CompanyAvatar from "@/components/CompanyAvatar";` và `import ScoreBadge from "@/components/ScoreBadge";`
- Cột: `className="rounded-lg border border-slate-200 bg-white p-2"` → `border-border bg-card`
- Nhãn cột `text-blue-700` → `text-foreground`; count `text-slate-400` → `text-muted-foreground`
- Thẻ card: `border border-slate-200 bg-slate-50` → `border-border bg-muted/40`
- Tên ứng viên: thay `<p className="font-medium text-slate-800">{c.candidateName}</p>` bằng hàng có avatar:
  ```tsx
  <div className="flex items-center gap-2">
    <CompanyAvatar name={c.candidateName} className="h-7 w-7 rounded-lg text-[10px]" />
    <p className="font-medium text-foreground">{c.candidateName}</p>
  </div>
  ```
- Điểm: thay `<p className="text-xs text-blue-600">Điểm phù hợp: {c.score}/100</p>` bằng
  `<div className="mt-1"><ScoreBadge score={c.score} /></div>`
- coverLetter `text-slate-500` → `text-muted-foreground`
- Link "Xem chi tiết →" `text-blue-600` → `text-primary`
- Khối "Đã rút": `border-slate-200 bg-white` → `border-border bg-card`; `text-slate-500` (2 chỗ) → `text-muted-foreground`; link `text-blue-600` → `text-primary`

- [ ] **Step 3: Verify build**

Run: `npm run lint` rồi `npm run build`
Expected: thành công, không lỗi type.

- [ ] **Step 4: Commit**

```bash
git add components/ScoreBadge.tsx app/jobs/[id]/applicants/ApplicantsBoard.tsx
git commit -m "feat(applicants): ScoreBadge + tokenize kanban board with candidate avatars"
```

---

### Task 2: Token hóa applicants page + applicant detail

**Files:**
- Modify: `app/jobs/[id]/applicants/page.tsx`, `app/jobs/[id]/applicants/[appId]/page.tsx`

**Interfaces:**
- Consumes: `ScoreBadge` (Task 1), `CompanyAvatar`, `Badge` (`@/components/ui/badge`).

- [ ] **Step 1: Token hóa `applicants/page.tsx`**

- `bg-slate-50` → `bg-muted/20`
- Link "← Về tin tuyển dụng" `text-blue-600` → `text-primary`
- H1 `text-blue-700` → `text-foreground`
- Mô tả `text-slate-500` → `text-muted-foreground`
- Link "🔎 Sàng lọc AI" `text-blue-600` → `text-primary`
- Empty `text-slate-500` → `text-muted-foreground`

- [ ] **Step 2: Token hóa `applicants/[appId]/page.tsx` + avatar + Badge + ScoreBadge**

- Thêm imports: `import CompanyAvatar from "@/components/CompanyAvatar";`, `import ScoreBadge from "@/components/ScoreBadge";`, `import { Badge } from "@/components/ui/badge";`
- `bg-slate-50` → `bg-muted/20`
- Link `text-blue-600` → `text-primary`
- Hàng tiêu đề: thêm avatar cạnh tên. Thay `<h1 className="text-xl font-semibold text-blue-700">{app.candidate.name}</h1>` bằng:
  ```tsx
  <div className="flex items-center gap-2">
    <CompanyAvatar name={app.candidate.name} className="h-9 w-9 text-xs" />
    <h1 className="text-xl font-semibold text-foreground">{app.candidate.name}</h1>
  </div>
  ```
- Badge trạng thái: thay `<span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">{...}</span>` → `<Badge>{STATUS_LABELS[app.status as ApplicationStatus]}</Badge>`
- Link "Nhắn tin" `text-blue-600` → `text-primary`
- 4 `CardTitle text-blue-700` → `text-foreground`
- Nội dung Card `text-slate-700` (2 chỗ) → `text-foreground`
- Điểm phù hợp: thay `<p className="font-semibold">{app.evaluation.overallScore}/100</p>` → `<ScoreBadge score={app.evaluation.overallScore} />`
- Lịch sử trạng thái `text-slate-500` → `text-muted-foreground`

- [ ] **Step 3: Verify build**

Run: `npm run lint` rồi `npm run build`
Expected: thành công.

- [ ] **Step 4: Commit**

```bash
git add app/jobs/[id]/applicants/page.tsx app/jobs/[id]/applicants/[appId]/page.tsx
git commit -m "feat(applicants): tokenize applicants list + detail (avatar, Badge, ScoreBadge)"
```

---

### Task 3: Token hóa Screening (client + page)

**Files:**
- Modify: `app/jobs/[id]/screening/ScreeningClient.tsx`, `app/jobs/[id]/screening/page.tsx`

**Interfaces:**
- Consumes: `ScoreBadge` (Task 1).

- [ ] **Step 1: Token hóa `ScreeningClient.tsx`**

Giữ nguyên `onRun`/`onMove`/`screenApplicants`/`changeStatus`.
- Thêm import `import ScoreBadge from "@/components/ScoreBadge";`
- Empty `text-slate-500` → `text-muted-foreground`
- Khối nhận xét: `border-blue-100 bg-blue-50 ... text-slate-700` → `border-border bg-muted/40 ... text-foreground`; nhãn `text-blue-700` → `text-foreground`
- Thẻ kết quả: `border-slate-200 bg-white` → `border-border bg-card`
- Tên `text-slate-800` → `text-foreground`
- Badge "Shortlist" `bg-green-100 text-green-700` → GIỮ (màu ngữ nghĩa shortlist)
- Dòng điểm: thay `<p className="text-xs text-blue-600">{r.score !== null ? ... : "Chưa xếp hạng"}</p>` bằng:
  ```tsx
  <p className="text-xs">
    {r.score !== null ? <ScoreBadge score={r.score} /> : <span className="text-muted-foreground">Chưa xếp hạng</span>}
  </p>
  ```
- Lý do `text-slate-700` → `text-foreground`

- [ ] **Step 2: Token hóa `screening/page.tsx`**

- `bg-slate-50` → `bg-muted/20`
- Link `text-blue-600` → `text-primary`
- H1 `text-blue-700` → `text-foreground`
- Mô tả `text-slate-500` → `text-muted-foreground`

- [ ] **Step 3: Verify build**

Run: `npm run lint` rồi `npm run build`
Expected: thành công.

- [ ] **Step 4: Commit**

```bash
git add app/jobs/[id]/screening/ScreeningClient.tsx app/jobs/[id]/screening/page.tsx
git commit -m "feat(screening): tokenize AI screening (keep semantic score/shortlist colors)"
```

---

### Task 4: Token hóa Apply (form + page)

**Files:**
- Modify: `app/jobs/[id]/apply/ApplyForm.tsx`, `app/jobs/[id]/apply/page.tsx`

**Interfaces:**
- Consumes: `ScoreBadge` (Task 1).

- [ ] **Step 1: Token hóa `ApplyForm.tsx`**

Giữ nguyên `onPreview`/`onSubmit`/`previewMatch`/`submitApplication`.
- Thêm import `import ScoreBadge from "@/components/ScoreBadge";`
- Empty `text-slate-500` → `text-muted-foreground`
- `CardTitle text-blue-700` → `text-foreground`
- 2 label `text-slate-700` → `text-foreground`
- 2 `<select>`/`<textarea>`: `border-slate-200 bg-white` → `border-input bg-background`
- Khối match: `border-blue-100 bg-blue-50` → `border-border bg-muted/40`; thay dòng điểm `<p className="font-semibold text-blue-700">Điểm phù hợp: {match.score}/100</p>` bằng:
  ```tsx
  <p className="font-semibold text-foreground">Điểm phù hợp: <ScoreBadge score={match.score} /></p>
  ```
- Summary `text-slate-700` → `text-foreground`; ghi chú `text-slate-400` → `text-muted-foreground`

- [ ] **Step 2: Token hóa `apply/page.tsx`**

- `bg-slate-50` → `bg-muted/20`
- Link `text-blue-600` → `text-primary`
- `CardTitle text-blue-700` → `text-foreground`
- 2 `text-slate-500` → `text-muted-foreground`

- [ ] **Step 3: Verify build**

Run: `npm run lint` rồi `npm run build`
Expected: thành công.

- [ ] **Step 4: Commit**

```bash
git add app/jobs/[id]/apply/ApplyForm.tsx app/jobs/[id]/apply/page.tsx
git commit -m "feat(apply): tokenize apply form + page (ScoreBadge for match)"
```

---

### Task 5: Token hóa Recommendations + Saved + SaveJobButton

**Files:**
- Modify: `app/jobs/recommendations/RecommendClient.tsx`, `app/jobs/recommendations/page.tsx`, `app/jobs/saved/page.tsx`, `app/jobs/SaveJobButton.tsx`

**Interfaces:**
- Consumes: `ScoreBadge` (Task 1), `JobCard` (`@/components/JobCard`).

- [ ] **Step 1: Token hóa `SaveJobButton.tsx`**

Giữ nguyên logic (`toggleSaveJob`, state, toast, icon Bookmark/BookmarkCheck).
- Nút: `className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-50"` → `text-muted-foreground hover:bg-muted hover:text-primary`
- Icon đã lưu `text-blue-600` → `text-primary`

- [ ] **Step 2: Token hóa `RecommendClient.tsx` + ScoreBadge**

Giữ nguyên `onRecommend`/`recommendJobs`.
- Thêm import `import ScoreBadge from "@/components/ScoreBadge";`
- Empty (2 chỗ) `text-slate-500` → `text-muted-foreground`
- `<select>` `border-slate-200 bg-white` → `border-input bg-background`
- Khối nhận xét: `border-blue-100 bg-blue-50 ... text-slate-700` → `border-border bg-muted/40 ... text-foreground`; nhãn `text-blue-700` → `text-foreground`
- Thẻ item: `border-slate-200 bg-white` → `border-border bg-card`
- Tên `text-slate-800` → `text-foreground`; link tiêu đề `text-blue-700` → `text-primary`; company `text-slate-400` → `text-muted-foreground`
- Dòng điểm: thay `<p className="text-xs text-blue-600">Điểm phù hợp: {it.score}/100</p>` → `<div className="mt-0.5"><ScoreBadge score={it.score} /></div>`
- Lý do `text-slate-700` → `text-foreground`

- [ ] **Step 3: Token hóa `recommendations/page.tsx`**

- `bg-slate-50` → `bg-muted/20`
- Link `text-blue-600` → `text-primary`
- H1 `text-slate-900` → `text-foreground`
- Mô tả `text-slate-500` → `text-muted-foreground`

- [ ] **Step 4: Token hóa `saved/page.tsx` — tái dùng JobCard**

Thay việc dựng Card thủ công bằng `JobCard` (đồng bộ với `/jobs`):
- Đổi imports: bỏ `Briefcase`, `Card`, `CardContent`; thêm `import JobCard from "@/components/JobCard";`
- `bg-slate-50` → `bg-muted/20`; Link `text-blue-600` → `text-primary`; H1 `text-slate-900` → `text-foreground`
- Empty: thay Card bằng:
  ```tsx
  <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">Bạn chưa lưu tin nào.</div>
  ```
- Danh sách: thay toàn bộ khối `.map` bằng:
  ```tsx
  {saved.map(({ job: j }) => (
    <JobCard
      key={j.id}
      job={j}
      href={`/jobs/${j.id}`}
      saveSlot={<SaveJobButton jobId={j.id} initialSaved={true} />}
    />
  ))}
  ```
  (Shape `{ id, title, company, rawText }` khớp `JobCardData`; `JobCard` tự render `CompanyAvatar` + tiêu đề + công ty. Giữ `SaveJobButton` import.)

- [ ] **Step 5: Verify build**

Run: `npm run lint` rồi `npm run build`
Expected: thành công (chú ý bỏ import không dùng ở saved/page).

- [ ] **Step 6: Commit**

```bash
git add app/jobs/recommendations/RecommendClient.tsx app/jobs/recommendations/page.tsx app/jobs/saved/page.tsx app/jobs/SaveJobButton.tsx
git commit -m "feat(jobs): tokenize recommendations + saved (JobCard reuse) + SaveJobButton"
```

---

### Task 6: Token hóa EvaluateFromJob

**Files:**
- Modify: `app/jobs/[id]/EvaluateFromJob.tsx`

- [ ] **Step 1: Token hóa**

Giữ nguyên `onEvaluate`/gọi API.
- `CardTitle text-blue-700` → `text-foreground`
- Empty `text-slate-500` → `text-muted-foreground`
- `<select>` `border-slate-200 bg-white` → `border-input bg-background`

- [ ] **Step 2: Verify build**

Run: `npm run lint`
Expected: không lỗi mới.

- [ ] **Step 3: Commit**

```bash
git add app/jobs/[id]/EvaluateFromJob.tsx
git commit -m "feat(jobs): tokenize EvaluateFromJob card"
```

---

### Task 7: Rà soát cuối & kiểm thử tổng

**Files:** (rà soát)

- [ ] **Step 1: Grep màu hardcode còn sót trong phạm vi**

Dùng Grep tool tìm `blue-[0-9]|text-slate-|bg-slate-|border-slate-` trong toàn bộ file thuộc phạm vi (mục File Structure).
Expected: không còn (ngoại lệ hợp lệ: `ScoreBadge` dùng red/amber/emerald ngữ nghĩa — nằm trong component riêng, không phải blue/slate; badge "Shortlist" green ngữ nghĩa trong ScreeningClient). Sửa nốt nếu sót.

- [ ] **Step 2: Grep dấu ngoặc cong trong className**

Kiểm tra không có ký tự `"`/`"` (U+201C/U+201D) bên trong `className` ở các file đã sửa.

- [ ] **Step 3: Chạy toàn bộ test**

Run: `npm test`
Expected: PASS toàn bộ (không có test mới; đảm bảo không hồi quy).

- [ ] **Step 4: Build production**

Run: `npm run build`
Expected: thành công, không lỗi type/lint.

- [ ] **Step 5: Chạy thử thủ công (khuyến nghị)**

Run: `npm run dev` — kiểm tra với tài khoản NTD: applicants board (kéo-thả vẫn hoạt động), chi tiết ứng viên, sàng lọc AI; với ứng viên: apply, recommendations, saved.

- [ ] **Step 6: Commit dọn dẹp nếu có**

```bash
git add -A
git commit -m "chore(ui): finalize round-3 token cleanup"
```

---

## Self-Review (đã thực hiện khi viết plan)

- **Spec coverage:** applicants board → Task 1; applicants list+detail → Task 2; screening → Task 3; apply → Task 4; recommendations+saved+SaveJobButton → Task 5; EvaluateFromJob → Task 6; rà soát+build → Task 7. ✅ Toàn bộ file trong Phạm vi spec đều có task.
- **Placeholder scan:** không có TODO/TBD; mỗi bước liệt kê ánh xạ class cụ thể (old→new) và code chèn ScoreBadge/avatar/JobCard.
- **Type consistency:** `ScoreBadge({ score, className })` (Task 1) khớp mọi nơi dùng (Task 2–5). `JobCard`/`JobCardData` (đã có từ vòng 1) khớp shape saved job `{id,title,company,rawText}`. `CompanyAvatar({ name, className })` dùng nhất quán.
- **Ràng buộc:** màu ngữ nghĩa điểm số/shortlist được giữ có chủ đích trong `ScoreBadge`/ScreeningClient; drag-drop và mọi server action/AI không đổi.
