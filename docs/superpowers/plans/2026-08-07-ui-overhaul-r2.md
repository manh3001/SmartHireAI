# UI Overhaul Vòng 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign toàn bộ luồng ứng viên theo design system vòng 1 (token chàm-tím), với điểm nhấn là CV builder có xem trước trực tiếp (2 cột), giữ nguyên nghiệp vụ/AI/PDF.

**Architecture:** Tách logic format CV dùng chung (`lib/cv/cv-format.ts`) cho cả PDF và một component preview HTML mới (`CvPreview`). `CvEditor` (client, đã có state) thêm cột preview sống + thanh dính. Các trang còn lại (auth, dashboard, applications, evaluate, chat) token hóa màu. Không đổi schema, auth, AI, realtime, hay output PDF.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Tailwind v4 (token design-system), shadcn/ui, `@react-pdf/renderer`, Vitest.

## Global Constraints

- Prisma **pinned v6**; KHÔNG đổi schema, KHÔNG `db:push` ở vòng này.
- Test bằng **Vitest**: chỉ unit-test logic thuần; không test component/route/DB.
- **Không đổi**: logic auth, phân quyền vai trò (CANDIDATE/RECRUITER/ADMIN), realtime polling, server actions, và **output PDF** (`CvDocument` chỉ refactor nội bộ; `lib/pdf/__tests__/CvDocument.test.tsx` phải vẫn xanh).
- Dùng **token màu** vòng 1 (`primary`, `foreground`, `muted-foreground`, `border`, `input`, `background`, `.bg-brand-gradient`, `.text-brand-gradient`, `Badge`), KHÔNG hardcode `blue-*/slate-*`. Ngoại lệ hợp lệ: nền "giấy" CV trong `CvPreview` cố ý `bg-white`; `text-white` trên nút/badge gradient; **màu ngữ nghĩa điểm số** đỏ/vàng/xanh trong Evaluate (giữ nguyên).
- Nội dung tiếng Việt; thương hiệu **SmartHire**.
- Windows: `npm test`, `npm run lint`, `npm run build`.

---

## File Structure

**Tạo mới:**
- `lib/cv/cv-format.ts` — hàm thuần format CV (dateRange, contactLine, eduSubLine).
- `lib/cv/__tests__/cv-format.test.ts`
- `components/cv/CvPreview.tsx` — bản xem trước HTML soi theo `CvDocument`.

**Sửa:**
- `lib/pdf/CvDocument.tsx` — dùng helper từ `cv-format.ts` (không đổi output).
- `app/cv/[id]/CvEditor.tsx` — 2 cột + preview sống + thanh dính + token.
- `app/login/page.tsx`, `app/register/page.tsx` — token.
- `app/dashboard/page.tsx`, `app/dashboard/CandidateStats.tsx`, `app/dashboard/RecruiterStats.tsx`, `app/dashboard/ImportCvButton.tsx`, `components/StatCard.tsx` — token.
- `app/applications/page.tsx` — token + badge trạng thái.
- `app/cv/[id]/evaluate/EvaluateClient.tsx`, `app/cv/[id]/chat/ChatClient.tsx` — token.

---

### Task 1: Tách helper format CV dùng chung (TDD) + refactor CvDocument

**Files:**
- Create: `lib/cv/cv-format.ts`
- Test: `lib/cv/__tests__/cv-format.test.ts`
- Modify: `lib/pdf/CvDocument.tsx`

**Interfaces:**
- Produces:
  - `dateRange(a: string, b: string): string`
  - `contactLine(email: string, phone: string): string`
  - `eduSubLine(major: string, range: string): string`

- [ ] **Step 1: Viết test thất bại**

`lib/cv/__tests__/cv-format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { dateRange, contactLine, eduSubLine } from "../cv-format";

describe("cv-format", () => {
  it("dateRange: đủ hai -> 'a - b'", () => {
    expect(dateRange("2023-01", "2024-06")).toBe("2023-01 - 2024-06");
  });
  it("dateRange: một rỗng -> phần còn lại", () => {
    expect(dateRange("2023", "")).toBe("2023");
    expect(dateRange("", "2024")).toBe("2024");
  });
  it("dateRange: cả hai rỗng -> ''", () => {
    expect(dateRange("", "")).toBe("");
  });
  it("contactLine: ghép bằng '  •  '", () => {
    expect(contactLine("a@b.com", "0900")).toBe("a@b.com  •  0900");
  });
  it("contactLine: một rỗng -> phần còn lại; cả hai rỗng -> ''", () => {
    expect(contactLine("a@b.com", "")).toBe("a@b.com");
    expect(contactLine("", "")).toBe("");
  });
  it("eduSubLine: ghép major + range bằng '  •  '", () => {
    expect(eduSubLine("CNTT", "2019 - 2023")).toBe("CNTT  •  2019 - 2023");
    expect(eduSubLine("", "2019")).toBe("2019");
    expect(eduSubLine("CNTT", "")).toBe("CNTT");
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn fail**

Run: `npm test -- cv-format`
Expected: FAIL ("Cannot find module '../cv-format'").

- [ ] **Step 3: Cài đặt**

`lib/cv/cv-format.ts`:

```ts
const SEP = "  •  ";

export function dateRange(a: string, b: string): string {
  return [a, b].filter(Boolean).join(" - ");
}

export function contactLine(email: string, phone: string): string {
  return [email, phone].filter(Boolean).join(SEP);
}

export function eduSubLine(major: string, range: string): string {
  return [major, range].filter(Boolean).join(SEP);
}
```

- [ ] **Step 4: Chạy test để chắc chắn pass**

Run: `npm test -- cv-format`
Expected: PASS.

- [ ] **Step 5: Refactor CvDocument dùng helper (không đổi output)**

Trong `lib/pdf/CvDocument.tsx`:
- Thêm import: `import { dateRange, contactLine, eduSubLine } from "@/lib/cv/cv-format";`
- Xóa hàm `dateRange` nội bộ (dòng `function dateRange(...) { ... }`).
- Dòng contact: đổi `const contact = [p.email, p.phone].filter(Boolean).join("  •  ");` → `const contact = contactLine(p.email, p.phone);`
- Mục Học vấn: đổi
  `{[e.major, dateRange(e.startDate, e.endDate)].filter(Boolean).join("  •  ")}`
  →
  `{eduSubLine(e.major, dateRange(e.startDate, e.endDate))}`
- Các chỗ gọi `dateRange(...)` khác giữ nguyên (giờ dùng hàm import).

- [ ] **Step 6: Chạy test PDF + cv-format (regression)**

Run: `npm test -- CvDocument cv-format`
Expected: PASS cả hai (PDF vẫn render `%PDF-`, >2000 bytes).

- [ ] **Step 7: Commit**

```bash
git add lib/cv/cv-format.ts lib/cv/__tests__/cv-format.test.ts lib/pdf/CvDocument.tsx
git commit -m "refactor(cv): shared cv-format helpers reused by PDF (+ tests)"
```

---

### Task 2: Component `CvPreview` (HTML soi theo PDF)

**Files:**
- Create: `components/cv/CvPreview.tsx`

**Interfaces:**
- Consumes: `dateRange`, `contactLine`, `eduSubLine` (Task 1); `CvInput` từ `@/lib/cv/types`.
- Produces: `export default function CvPreview({ cv }: { cv: CvInput })`.

- [ ] **Step 1: Tạo component**

`components/cv/CvPreview.tsx`:

```tsx
import type { CvInput } from "@/lib/cv/types";
import { dateRange, contactLine, eduSubLine } from "@/lib/cv/cv-format";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-4 mb-1.5 border-b border-slate-300 pb-1 text-[13px] font-bold text-slate-800">
      {children}
    </h2>
  );
}

// Bản xem trước dạng "tờ giấy" CV — mô phỏng layout của lib/pdf/CvDocument.tsx.
// Nền giấy cố ý dùng bg-white/slate (không token) để giống trang in.
export default function CvPreview({ cv }: { cv: CvInput }) {
  const p = cv.profile;
  const contact = contactLine(p.email, p.phone);
  return (
    <div className="mx-auto w-full max-w-[210mm] rounded-lg border border-slate-200 bg-white p-8 text-[11px] leading-relaxed text-slate-900 shadow-sm">
      <div className="text-[22px] font-bold">{p.fullName || "Chưa có tên"}</div>
      {p.headline && <div className="text-[12px] text-slate-500">{p.headline}</div>}
      {contact && <div className="mb-2 text-[10px] text-slate-500">{contact}</div>}
      {p.summary && <p className="mb-1">{p.summary}</p>}

      {cv.experiences.length > 0 && (
        <section>
          <SectionTitle>Kinh nghiệm làm việc</SectionTitle>
          {cv.experiences.map((e, i) => (
            <div key={i} className="mb-1.5">
              <div className="font-bold">{e.position} — {e.company}</div>
              {dateRange(e.startDate, e.endDate) && (
                <div className="text-[10px] text-slate-500">{dateRange(e.startDate, e.endDate)}</div>
              )}
              {e.description && <p>{e.description}</p>}
            </div>
          ))}
        </section>
      )}

      {cv.educations.length > 0 && (
        <section>
          <SectionTitle>Học vấn</SectionTitle>
          {cv.educations.map((e, i) => (
            <div key={i} className="mb-1.5">
              <div className="font-bold">{e.school}</div>
              <div className="text-[10px] text-slate-500">
                {eduSubLine(e.major, dateRange(e.startDate, e.endDate))}
              </div>
            </div>
          ))}
        </section>
      )}

      {cv.skills.length > 0 && (
        <section>
          <SectionTitle>Kỹ năng</SectionTitle>
          {cv.skills.map((sk, i) => (
            <div key={i}>• {sk.name}{sk.level ? ` (${sk.level})` : ""}</div>
          ))}
        </section>
      )}

      {cv.projects.length > 0 && (
        <section>
          <SectionTitle>Dự án</SectionTitle>
          {cv.projects.map((pr, i) => (
            <div key={i} className="mb-1.5">
              <div className="font-bold">{pr.name}</div>
              {pr.tech && <div className="text-[10px] text-slate-500">{pr.tech}</div>}
              {pr.description && <p>{pr.description}</p>}
              {pr.link && <div className="text-[10px] text-slate-500">{pr.link}</div>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
```

> Lưu ý: `CvPreview` là "tờ giấy" nên dùng `slate/white` cố ý (giống bản in), KHÔNG áp token brand — đây là ngoại lệ đã nêu trong Global Constraints.

- [ ] **Step 2: Verify build/type**

Run: `npm run lint`
Expected: không lỗi mới.

- [ ] **Step 3: Commit**

```bash
git add components/cv/CvPreview.tsx
git commit -m "feat(cv): CvPreview — live HTML preview mirroring the PDF layout"
```

---

### Task 3: CvEditor 2 cột + xem trước sống + thanh dính + token

**Files:**
- Modify: `app/cv/[id]/CvEditor.tsx`

**Interfaces:**
- Consumes: `CvPreview` (Task 2).
- Produces: (không có interface mới cho task sau).

**Bối cảnh:** file hiện tại giữ toàn bộ state `cv` qua `useState` và các hàm `setProfile/addRow/removeRow/setRow/onSave`. **Giữ nguyên toàn bộ các hàm này và 5 Card mục.** Chỉ đổi: (a) khung ngoài `<main>` → layout 2 cột + thanh dính + tab mobile; (b) token hóa màu.

- [ ] **Step 1: Thêm state tab mobile + import CvPreview**

Đầu component (sau `const [pending, startTransition] = useTransition();`) thêm:

```tsx
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
```

Và import: `import CvPreview from "@/components/cv/CvPreview";`

- [ ] **Step 2: Thay khung `<main>` và thanh hành động**

Thay từ `return (` tới hết phần thanh hành động + Input tiêu đề. Cấu trúc mới: `<main>` bg token, **thanh hành động dính** trên cùng, rồi grid 2 cột. Cột trái bọc tab "Chỉnh sửa" (các Card), cột phải là preview (tab "Xem trước" trên mobile, cột dính trên desktop).

Thay đoạn đầu `return (...)` (từ dòng `<main ...>` đến ngay trước `{/* Profile */}`) bằng:

```tsx
  return (
    <main className="min-h-full bg-muted/20">
      {/* Thanh hành động dính */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5">
          <Link href="/dashboard" className="text-sm text-primary hover:underline">← Về dashboard</Link>
          <div className="flex flex-wrap gap-2">
            <Link href={`/cv/${cvId}/chat`} className={buttonVariants({ variant: "outline", size: "sm" })}>Chat tư vấn</Link>
            <Link href={`/cv/${cvId}/evaluate`} className={buttonVariants({ variant: "outline", size: "sm" })}>Đánh giá theo JD</Link>
            <a href={`/api/cv/${cvId}/pdf`} className={buttonVariants({ variant: "outline", size: "sm" })}>Xuất PDF</a>
            <Button size="sm" onClick={onSave} disabled={pending}>{pending ? "Đang lưu..." : "Lưu"}</Button>
          </div>
        </div>
      </div>

      {/* Tab chỉ hiện trên mobile */}
      <div className="mx-auto flex max-w-6xl gap-2 px-4 pt-4 lg:hidden">
        <Button variant={mobileTab === "edit" ? "default" : "outline"} size="sm" onClick={() => setMobileTab("edit")}>Chỉnh sửa</Button>
        <Button variant={mobileTab === "preview" ? "default" : "outline"} size="sm" onClick={() => setMobileTab("preview")}>Xem trước</Button>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 p-4 lg:grid-cols-2 lg:p-6">
        {/* Cột trái: form (ẩn trên mobile khi đang xem preview) */}
        <div className={mobileTab === "preview" ? "hidden lg:block" : "block"}>
          <Input
            className="mb-4 text-lg font-semibold"
            value={cv.title}
            onChange={(e) => setCv((c) => ({ ...c, title: e.target.value }))}
            placeholder="Tên CV"
          />
```

- [ ] **Step 3: Token hóa 5 CardTitle**

Trong toàn bộ 5 mục, đổi `<CardTitle className="text-blue-700">` → `<CardTitle className="text-foreground">` (5 chỗ: Thông tin cá nhân, Kinh nghiệm, Học vấn, Kỹ năng, Dự án).

- [ ] **Step 4: Đóng cột trái + thêm cột phải preview + đóng main**

Sau `</Card>` cuối cùng (mục Dự án), thay phần đóng `</main>` hiện tại bằng: đóng cột trái, thêm cột phải preview (dính desktop; ẩn trên mobile khi đang ở tab edit), rồi đóng grid + main:

```tsx
        </div>{/* hết cột trái */}

        {/* Cột phải: xem trước sống */}
        <div className={mobileTab === "edit" ? "hidden lg:block" : "block"}>
          <div className="lg:sticky lg:top-20">
            <CvPreview cv={cv} />
          </div>
        </div>
      </div>
    </main>
  );
```

> Kết quả: cột trái chứa Input tiêu đề + 5 Card; cột phải chứa `CvPreview`. Đảm bảo thẻ mở/đóng khớp (Input tiêu đề đã chuyển vào trong cột trái ở Step 2).

- [ ] **Step 5: Verify build**

Run: `npm run lint` rồi `npm run build`
Expected: build thành công, không lỗi JSX/type (chú ý cân bằng thẻ đóng).

- [ ] **Step 6: Commit**

```bash
git add app/cv/[id]/CvEditor.tsx
git commit -m "feat(cv): CV builder 2-column with live preview, sticky action bar, mobile tabs"
```

---

### Task 4: Token hóa trang Auth (login + register)

**Files:**
- Modify: `app/login/page.tsx`, `app/register/page.tsx`

**Bối cảnh:** hai file gần giống nhau, đều hardcode màu. Giữ nguyên toàn bộ logic (`signIn`/fetch `/api/register`, state error/loading).

- [ ] **Step 1: Token hóa `app/login/page.tsx`**

Áp các thay thế class (chỉ đổi className, không đổi logic):
- Nền: `bg-gradient-to-b from-blue-50 to-white` → `bg-gradient-to-b from-primary/5 to-background`
- Logo: `text-blue-600` → `text-brand-gradient` (giữ icon `Sparkles`)
- Card: `border-slate-200 bg-white` → `border-border bg-card`
- Tiêu đề `text-slate-900` → `text-foreground`
- Dòng "Chưa có tài khoản?" `text-slate-600` → `text-muted-foreground`
- Link "Đăng ký" `text-blue-600` → `text-primary`
- (Giữ `text-red-600` cho thông báo lỗi.)

- [ ] **Step 2: Token hóa `app/register/page.tsx`**

Áp thay thế tương tự Step 1, và thêm cho `<select role>`:
- Nền, logo, card, tiêu đề, dòng "Đã có tài khoản?", link "Đăng nhập" — như Step 1.
- `<select className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">` → `border-input bg-background`.

- [ ] **Step 3: Verify build**

Run: `npm run lint`
Expected: không lỗi mới.

- [ ] **Step 4: Commit**

```bash
git add app/login/page.tsx app/register/page.tsx
git commit -m "feat(auth): tokenize login & register pages"
```

---

### Task 5: Token hóa Dashboard (+ stats + import + StatCard)

**Files:**
- Modify: `app/dashboard/page.tsx`, `components/StatCard.tsx`, `app/dashboard/CandidateStats.tsx`, `app/dashboard/RecruiterStats.tsx`, `app/dashboard/ImportCvButton.tsx`

**Bối cảnh:** `dashboard/page.tsx` phục vụ cả 2 vai. Giữ nguyên toàn bộ truy vấn + server actions (`createCv`/`deleteCv`/`deleteJobDescription`) + `ImportCvButton`.

- [ ] **Step 1: Token hóa `components/StatCard.tsx`**

```tsx
import { Card, CardContent } from "@/components/ui/card";

export default function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="border-border">
      <CardContent className="py-4">
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Token hóa `app/dashboard/page.tsx`**

Áp thay thế class trong CẢ nhánh recruiter và candidate (không đổi logic/JSX cấu trúc):
- `bg-slate-50` (2 chỗ `<div ...flex min-h-full...>`) → `bg-muted/20`
- Tiêu đề `text-slate-900` → `text-foreground`
- Phụ đề `text-slate-500` → `text-muted-foreground`
- Ô icon `bg-blue-100 text-blue-600` (2 chỗ) → `bg-primary/10 text-primary`
- Tên item `text-slate-900` → `text-foreground`; hover `hover:text-blue-600` → `hover:text-primary`
- Ngày `text-slate-400` → `text-muted-foreground`
- Card list `border-slate-200` → `border-border`; hover `hover:border-blue-300 hover:bg-blue-50/40` → `hover:border-primary/40 hover:bg-muted/40`
- Card rỗng `text-slate-500` (2 chỗ) → `text-muted-foreground`
- Nút Xóa `text-slate-500 hover:text-red-600` → `text-muted-foreground hover:text-destructive`

- [ ] **Step 3: Token hóa `CandidateStats.tsx`, `RecruiterStats.tsx`, `ImportCvButton.tsx`**

Đọc từng file; đổi mọi `text-slate-*`/`text-blue-*`/`bg-blue-*`/`bg-slate-*`/`border-slate-*` sang token tương ứng (`text-foreground`/`text-muted-foreground`/`text-primary`/`bg-primary/10`/`bg-muted`/`border-border`). Giữ nguyên logic và các màu ngữ nghĩa nếu có (ví dụ màu trạng thái). Nếu file không có màu hardcode nào, để nguyên.

- [ ] **Step 4: Verify build**

Run: `npm run lint` rồi `npm run build`
Expected: thành công.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/page.tsx components/StatCard.tsx app/dashboard/CandidateStats.tsx app/dashboard/RecruiterStats.tsx app/dashboard/ImportCvButton.tsx
git commit -m "feat(dashboard): tokenize dashboard, stats cards, import button"
```

---

### Task 6: Token hóa trang Applications + badge trạng thái

**Files:**
- Modify: `app/applications/page.tsx`

**Bối cảnh:** giữ nguyên truy vấn + `WithdrawButton` + logic trạng thái (`STATUS_LABELS`, `canWithdraw`).

- [ ] **Step 1: Token hóa + dùng Badge**

Áp thay thế class:
- `bg-slate-50` → `bg-muted/20`
- Tiêu đề `text-blue-700` → `text-foreground`
- Đoạn rỗng `text-slate-500` → `text-muted-foreground`; link `text-blue-600` → `text-primary`
- `CardTitle text-blue-700` → `text-foreground`
- Công ty `text-slate-500` → `text-muted-foreground`
- Badge trạng thái: đổi `<span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">{...}</span>` → dùng component Badge:
  thêm import `import { Badge } from "@/components/ui/badge";` và thay bằng `<Badge>{STATUS_LABELS[a.status as ApplicationStatus]}</Badge>`
- Nội dung `text-slate-700` → `text-foreground`
- Timeline `text-slate-500` → `text-muted-foreground`
- Link "Nhắn tin" `text-blue-600` → `text-primary`

- [ ] **Step 2: Verify build**

Run: `npm run lint`
Expected: không lỗi mới.

- [ ] **Step 3: Commit**

```bash
git add app/applications/page.tsx
git commit -m "feat(applications): tokenize my-applications list + status Badge"
```

---

### Task 7: Token hóa Evaluate + Chat

**Files:**
- Modify: `app/cv/[id]/evaluate/EvaluateClient.tsx`, `app/cv/[id]/chat/ChatClient.tsx`

**Bối cảnh:** giữ nguyên toàn bộ gọi AI/stream, state, và **màu ngữ nghĩa điểm số** (đỏ/vàng/xanh: `colorClass`, `ringClass`, `scoreColor`).

- [ ] **Step 1: Token hóa `EvaluateClient.tsx`**

Giữ nguyên `colorClass`/`ringClass` (điểm số) và các heading điểm mạnh/yếu (`text-green-700`/`text-red-700` — màu ngữ nghĩa, GIỮ). Đổi phần còn lại:
- `<main ... bg-slate-50 ...>` → `bg-muted/20`
- Khối điểm `bg-blue-50/50` → `bg-muted/40`
- `/100` `text-slate-400` → `text-muted-foreground`
- Summary `text-slate-600` → `text-muted-foreground`
- Nhãn "Từ khóa khớp/còn thiếu" `text-slate-700` → `text-foreground`
- Chip khớp `bg-blue-100 text-blue-700` → dùng `Badge` (import `{ Badge }`) `<Badge>{k}</Badge>`
- Chip thiếu `bg-slate-200 text-slate-600` → `<Badge variant="muted">{k}</Badge>`
- Dấu `—` `text-slate-400` → `text-muted-foreground`
- SkillGaps `text-gray-600` → `text-muted-foreground` (2 chỗ); lịch sử `text-gray-*` → `text-muted-foreground`; viền `border` giữ (đã là token qua base).

- [ ] **Step 2: Token hóa `ChatClient.tsx`**

- `<main ... bg-slate-50 ...>` → `bg-muted/20`
- Link "← Về CV" `text-blue-600` → `text-primary`
- Tiêu đề `text-slate-900` → `text-foreground`
- Khung chat `border-slate-200 bg-white` → `border-border bg-card`
- Placeholder trống `text-slate-400` → `text-muted-foreground`
- Bong bóng user `bg-blue-600 ... text-white` → `bg-primary ... text-primary-foreground`
- Bong bóng bot `border-slate-200 bg-white ... text-slate-800` → `border-border bg-background ... text-foreground`

- [ ] **Step 3: Verify build**

Run: `npm run lint` rồi `npm run build`
Expected: thành công.

- [ ] **Step 4: Commit**

```bash
git add app/cv/[id]/evaluate/EvaluateClient.tsx app/cv/[id]/chat/ChatClient.tsx
git commit -m "feat(cv): tokenize evaluate & chat (keep semantic score colors)"
```

---

### Task 8: Rà soát cuối & kiểm thử tổng

**Files:** (rà soát)

- [ ] **Step 1: Grep hardcode màu còn sót trong phạm vi vòng 2**

Dùng Grep tool tìm `blue-[0-9]|text-slate-|bg-slate-|border-slate-` trong: `app/login/page.tsx`, `app/register/page.tsx`, `app/dashboard/`, `app/applications/page.tsx`, `app/cv/[id]/CvEditor.tsx`, `app/cv/[id]/evaluate/EvaluateClient.tsx`, `app/cv/[id]/chat/ChatClient.tsx`.
Expected: không còn (ngoại lệ hợp lệ: `CvPreview.tsx` cố ý dùng slate/white — nằm ngoài danh sách grep này; màu ngữ nghĩa điểm số/điểm mạnh-yếu trong Evaluate GIỮ). Sửa nốt nếu sót.

- [ ] **Step 2: Chạy toàn bộ test**

Run: `npm test`
Expected: PASS toàn bộ (bao gồm `cv-format` mới và `CvDocument` regression).

- [ ] **Step 3: Build production**

Run: `npm run build`
Expected: thành công, không lỗi type/lint.

- [ ] **Step 4: Chạy thử thủ công (khuyến nghị)**

Run: `npm run dev`, mở `http://localhost:3000` — kiểm tra: login/register, dashboard (ứng viên + NTD), CV builder (2 cột desktop + tab mobile, preview cập nhật khi gõ, thanh dính), đánh giá JD, chat, danh sách đơn.

- [ ] **Step 5: Commit dọn dẹp nếu có**

```bash
git add -A
git commit -m "chore(ui): finalize round-2 token cleanup"
```

---

## Self-Review (đã thực hiện khi viết plan)

- **Spec coverage:** (1) tách cv-format + refactor PDF → Task 1; (2) CvPreview → Task 2; (3) CvEditor 2 cột → Task 3; (4) auth/dashboard/applications/evaluate/chat token hóa → Task 4–7; (5) kiểm thử TDD cv-format + PDF regression → Task 1, Task 8. ✅
- **Placeholder scan:** không có TODO/TBD; các task token hóa liệt kê ánh xạ class cụ thể (old→new). Task 5 Step 3 và Task 3 (JSX cân bằng) yêu cầu "đọc file trước khi sửa" vì phụ thuộc nội dung động — cố ý, không phải placeholder.
- **Type consistency:** `dateRange`/`contactLine`/`eduSubLine` (Task 1) khớp cách dùng ở `CvPreview` (Task 2) và refactor `CvDocument` (Task 1). `CvPreview({ cv })` khớp cách dùng ở `CvEditor` (Task 3).
- **Ràng buộc then chốt:** output PDF không đổi — chốt bằng test `CvDocument` (Task 1 Step 6, Task 8 Step 2). Màu ngữ nghĩa điểm số trong Evaluate được giữ có chủ đích.
