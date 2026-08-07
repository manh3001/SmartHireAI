# UI Overhaul Vòng 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng giao diện dự án lên tầm sàn tuyển dụng thật (chàm-tím hiện đại kiểu Glints): chuẩn hóa design system, redesign trang chủ và danh sách/chi tiết việc làm theo layout master-detail, thêm duyệt theo ngành nghề.

**Architecture:** Dự án đã có token shadcn (primary hue ~263) nhưng code hardcode `blue-*`/`slate-*`. Kế hoạch: (1) chuẩn hóa token + tiện ích gradient, (2) dựng lớp component dùng chung (CompanyAvatar, JobCard, Badge), (3) thêm field `category` + hằng ngành, (4) redesign Navbar/Footer/Landing, (5) danh sách + chi tiết việc làm master-detail. Logic thuần viết theo TDD; component/route/DB không unit-test.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Tailwind v4, shadcn/ui, `@base-ui/react`, lucide-react, Prisma 6 (Neon), Zod, Vitest.

## Global Constraints

- Prisma **pinned v6** — không nâng v7. Đồng bộ schema bằng `npm run db:push` (không viết migration tay).
- Mọi lệnh chạm DB đặt `NODE_OPTIONS=--dns-result-order=ipv4first` (đã có sẵn trong các script npm).
- Test bằng **Vitest**: chỉ unit-test **logic thuần**; không test component React / route / truy vấn DB.
- Không đổi hành vi auth, phân quyền theo vai trò (CANDIDATE/RECRUITER/ADMIN), realtime polling, server actions hiện có.
- Giữ trang chi tiết `/jobs/[id]` hoạt động độc lập (chia sẻ link + mobile).
- Nội dung tiếng Việt. Thương hiệu: **SmartHire**.
- Chạy trên Windows: dùng `npm test`, `npm run lint`, `npm run build`, `npm run db:push`.

---

## File Structure

**Tạo mới:**
- `lib/ui/avatar-color.ts` — hàm thuần sinh màu + chữ cái đầu từ tên công ty.
- `lib/ui/__tests__/avatar-color.test.ts`
- `lib/jobs/job-categories.ts` — hằng ngành nghề + validator.
- `lib/jobs/__tests__/job-categories.test.ts`
- `components/CompanyAvatar.tsx`
- `components/ui/badge.tsx`
- `components/JobCard.tsx`
- `components/Footer.tsx` (nếu chưa có — kiểm tra; hiện `app/page.tsx` import `@/components/Footer`)
- `components/jobs/JobFilters.tsx` — form lọc (sidebar desktop).
- `components/jobs/JobsBrowser.tsx` — client component master-detail cho `/jobs`.
- `components/jobs/JobDetail.tsx` — thân chi tiết dùng chung cho pane phải + trang `/jobs/[id]`.
- `app/page/HomeSearch.tsx` (hoặc `components/home/HomeSearch.tsx`) — thanh tìm việc hero.

**Sửa:**
- `app/globals.css` — token + tiện ích gradient.
- `components/Navbar.tsx`, `components/JobMeta.tsx`.
- `prisma/schema.prisma` — thêm `category`.
- `lib/jobs/schema.ts`, `lib/jobs/job-query.ts`, `lib/jobs/actions.ts`.
- `app/jobs/new/page.tsx` — thêm ô chọn ngành.
- `app/page.tsx` — landing mới.
- `app/jobs/page.tsx`, `app/jobs/[id]/page.tsx` — layout mới.

---

### Task 1: Design tokens, gradient thương hiệu & container

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Produces: biến CSS `--brand-from`, `--brand-to`; class tiện ích `.bg-brand-gradient`, `.text-brand-gradient`. Token `--primary` chàm-tím dùng cho toàn app.

- [ ] **Step 1: Điều chỉnh token `--primary` và thêm biến gradient (light)**

Trong `:root` của `app/globals.css`, đổi/ thêm (giữ các dòng khác nguyên vẹn):

```css
  --primary: oklch(0.55 0.22 275);          /* indigo 600 */
  --primary-foreground: oklch(0.985 0 0);
  --ring: oklch(0.55 0.22 275);
  --brand-from: oklch(0.55 0.22 275);        /* indigo */
  --brand-to: oklch(0.62 0.23 305);          /* violet */
```

Trong `.dark`, thêm:

```css
  --brand-from: oklch(0.62 0.20 275);
  --brand-to: oklch(0.68 0.21 305);
```

- [ ] **Step 2: Thêm tiện ích gradient vào `@layer base`**

Cuối `app/globals.css`, thêm:

```css
@layer utilities {
  .bg-brand-gradient {
    background-image: linear-gradient(135deg, var(--brand-from), var(--brand-to));
  }
  .text-brand-gradient {
    background-image: linear-gradient(135deg, var(--brand-from), var(--brand-to));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
}
```

- [ ] **Step 3: Verify build không lỗi**

Run: `npm run lint`
Expected: không có lỗi mới liên quan `globals.css`.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat(ui): brand indigo-violet tokens + gradient utilities"
```

---

### Task 2: Hằng ngành nghề + validator (logic thuần, TDD)

**Files:**
- Create: `lib/jobs/job-categories.ts`
- Test: `lib/jobs/__tests__/job-categories.test.ts`

**Interfaces:**
- Produces:
  - `type JobCategory` (union slug).
  - `JOB_CATEGORIES: readonly { slug: JobCategory; label: string; icon: string }[]` (`icon` = tên icon lucide).
  - `JOB_CATEGORY_LABELS: Record<JobCategory, string>`.
  - `isJobCategory(v: unknown): v is JobCategory`.
  - `normalizeCategory(v: unknown): JobCategory | null` (giá trị hợp lệ → slug, còn lại → null).

- [ ] **Step 1: Viết test thất bại**

`lib/jobs/__tests__/job-categories.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  JOB_CATEGORIES,
  JOB_CATEGORY_LABELS,
  isJobCategory,
  normalizeCategory,
} from "../job-categories";

describe("job-categories", () => {
  it("có ít nhất 6 ngành, slug duy nhất", () => {
    const slugs = JOB_CATEGORIES.map((c) => c.slug);
    expect(slugs.length).toBeGreaterThanOrEqual(6);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("mỗi ngành có label khớp JOB_CATEGORY_LABELS", () => {
    for (const c of JOB_CATEGORIES) {
      expect(JOB_CATEGORY_LABELS[c.slug]).toBe(c.label);
    }
  });

  it("isJobCategory nhận slug hợp lệ, từ chối giá trị lạ", () => {
    expect(isJobCategory("it")).toBe(true);
    expect(isJobCategory("khong-ton-tai")).toBe(false);
    expect(isJobCategory(null)).toBe(false);
    expect(isJobCategory(123)).toBe(false);
  });

  it("normalizeCategory: hợp lệ -> slug, lạ/empty -> null", () => {
    expect(normalizeCategory("design")).toBe("design");
    expect(normalizeCategory("")).toBeNull();
    expect(normalizeCategory("xxx")).toBeNull();
    expect(normalizeCategory(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn fail**

Run: `npm test -- job-categories`
Expected: FAIL ("Cannot find module '../job-categories'").

- [ ] **Step 3: Cài đặt tối thiểu**

`lib/jobs/job-categories.ts`:

```ts
export type JobCategory =
  | "it"
  | "marketing-sales"
  | "finance"
  | "design"
  | "hr"
  | "operations"
  | "other";

// icon = tên component lucide-react (map ở phía UI).
export const JOB_CATEGORIES = [
  { slug: "it", label: "Công nghệ thông tin", icon: "Code" },
  { slug: "marketing-sales", label: "Marketing / Kinh doanh", icon: "Megaphone" },
  { slug: "finance", label: "Kế toán / Tài chính", icon: "Calculator" },
  { slug: "design", label: "Thiết kế", icon: "Palette" },
  { slug: "hr", label: "Nhân sự", icon: "Users" },
  { slug: "operations", label: "Vận hành", icon: "Settings" },
  { slug: "other", label: "Khác", icon: "Briefcase" },
] as const satisfies readonly { slug: JobCategory; label: string; icon: string }[];

export const JOB_CATEGORY_LABELS = Object.fromEntries(
  JOB_CATEGORIES.map((c) => [c.slug, c.label]),
) as Record<JobCategory, string>;

const SLUGS = new Set<string>(JOB_CATEGORIES.map((c) => c.slug));

export function isJobCategory(v: unknown): v is JobCategory {
  return typeof v === "string" && SLUGS.has(v);
}

export function normalizeCategory(v: unknown): JobCategory | null {
  return isJobCategory(v) ? v : null;
}
```

- [ ] **Step 4: Chạy test để chắc chắn pass**

Run: `npm test -- job-categories`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/jobs/job-categories.ts lib/jobs/__tests__/job-categories.test.ts
git commit -m "feat(jobs): job category taxonomy + validators"
```

---

### Task 3: `buildJobsWhere` lọc theo `category` (TDD)

**Files:**
- Modify: `lib/jobs/job-query.ts`
- Test: `lib/jobs/__tests__/job-query.test.ts`

**Interfaces:**
- Consumes: `JobCategory` từ Task 2.
- Produces: `JobsFilter` thêm `category?: JobCategory`; khi có, `buildJobsWhere` thêm khóa cấp cao `category`.

- [ ] **Step 1: Thêm test thất bại**

Thêm vào `lib/jobs/__tests__/job-query.test.ts` (trong `describe`):

```ts
  it("category passed -> appears as top-level key", () => {
    const result = buildJobsWhere({ category: "it" });
    expect(result.category).toBe("it");
    expect(result.isPublic).toBe(true);
  });

  it("no category -> no category key", () => {
    const result = buildJobsWhere({ term: "react" });
    expect(result).not.toHaveProperty("category");
  });
```

- [ ] **Step 2: Chạy test để chắc chắn fail**

Run: `npm test -- job-query`
Expected: FAIL (`result.category` undefined).

- [ ] **Step 3: Cài đặt**

Sửa `lib/jobs/job-query.ts`:

```ts
import { salaryWhere } from "./salary";
import type { EmploymentType, ExperienceLevel } from "./job-fields";
import type { JobCategory } from "./job-categories";

export type JobsFilter = {
  term?: string;
  employmentType?: EmploymentType;
  experienceLevel?: ExperienceLevel;
  salaryMillions?: number | null;
  category?: JobCategory;
};
```

Trong `return` của `buildJobsWhere`, thêm dòng `category`:

```ts
  return {
    isPublic: true,
    ...(f.employmentType ? { employmentType: f.employmentType } : {}),
    ...(f.experienceLevel ? { experienceLevel: f.experienceLevel } : {}),
    ...(f.category ? { category: f.category } : {}),
    ...(and.length > 0 ? { AND: and } : {}),
  };
```

- [ ] **Step 4: Chạy test để chắc chắn pass**

Run: `npm test -- job-query`
Expected: PASS (toàn bộ test cũ + mới).

- [ ] **Step 5: Commit**

```bash
git add lib/jobs/job-query.ts lib/jobs/__tests__/job-query.test.ts
git commit -m "feat(jobs): filter jobs by category"
```

---

### Task 4: Schema `category` + Zod + action + ô chọn ngành trong form đăng tin

**Files:**
- Modify: `prisma/schema.prisma`, `lib/jobs/schema.ts`, `lib/jobs/actions.ts`, `app/jobs/new/page.tsx`
- Test: `lib/jobs/__tests__/schema.test.ts`

**Interfaces:**
- Consumes: `normalizeCategory`, `JOB_CATEGORIES` từ Task 2.
- Produces: `JobDescription.category String?` trong DB; `jobSchema` chấp nhận `category`.

- [ ] **Step 1: Thêm cột vào Prisma schema**

Trong `prisma/schema.prisma`, `model JobDescription`, thêm sau dòng `skills`:

```prisma
  category        String?
```

- [ ] **Step 2: Đồng bộ DB**

Run: `npm run db:push`
Expected: "Your database is now in sync" (thêm cột nullable, an toàn).

- [ ] **Step 3: Thêm test schema thất bại**

Thêm vào `lib/jobs/__tests__/schema.test.ts`:

```ts
  it("chấp nhận category null và slug hợp lệ", () => {
    const base = {
      title: "Dev", company: "ACME", rawText: "JD", location: "HN", skills: "React",
      employmentType: "", experienceLevel: "",
      salaryMin: null, salaryMax: null, salaryNegotiable: false,
    };
    expect(jobSchema.safeParse({ ...base, category: null }).success).toBe(true);
    expect(jobSchema.safeParse({ ...base, category: "it" }).success).toBe(true);
    const parsedBad = jobSchema.safeParse({ ...base, category: "xxx" });
    expect(parsedBad.success).toBe(true);
    if (parsedBad.success) expect(parsedBad.data.category).toBeNull();
  });
```

(Đảm bảo file test đã `import { jobSchema } from "../schema";` — nếu chưa, thêm.)

- [ ] **Step 4: Chạy test để chắc chắn fail**

Run: `npm test -- schema`
Expected: FAIL (`category` chưa có trong schema).

- [ ] **Step 5: Thêm `category` vào Zod schema**

Trong `lib/jobs/schema.ts`, thêm import và field. Đầu file:

```ts
import { normalizeCategory } from "./job-categories";
```

Trong `z.object({ ... })`, thêm:

```ts
    category: z.preprocess((v) => normalizeCategory(v), z.string().nullable()),
```

- [ ] **Step 6: Chạy test để chắc chắn pass**

Run: `npm test -- schema`
Expected: PASS.

- [ ] **Step 7: Thread `category` qua action**

Trong `lib/jobs/actions.ts`, `createJobDescription`, thêm vào object `safeParse`:

```ts
    category: String(formData.get("category") ?? ""),
```

và vào `prisma.jobDescription.create({ data: { ... } })`:

```ts
      category: parsed.data.category,
```

- [ ] **Step 8: Thêm ô chọn ngành vào form đăng tin**

Trong `app/jobs/new/page.tsx`: thêm import

```ts
import { JOB_CATEGORIES } from "@/lib/jobs/job-categories";
```

Thêm khối sau ô "Loại hình làm việc":

```tsx
              <div><Label>Ngành nghề</Label>
                <select name="category" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">— Chọn —</option>
                  {JOB_CATEGORIES.map((c) => (
                    <option key={c.slug} value={c.slug}>{c.label}</option>
                  ))}
                </select></div>
```

- [ ] **Step 9: Verify build**

Run: `npm run lint`
Expected: không lỗi mới.

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma lib/jobs/schema.ts lib/jobs/actions.ts app/jobs/new/page.tsx lib/jobs/__tests__/schema.test.ts
git commit -m "feat(jobs): persist category on job + picker in post form"
```

---

### Task 5: Avatar màu (logic thuần, TDD) + component CompanyAvatar + Badge

**Files:**
- Create: `lib/ui/avatar-color.ts`, `components/CompanyAvatar.tsx`, `components/ui/badge.tsx`
- Test: `lib/ui/__tests__/avatar-color.test.ts`

**Interfaces:**
- Produces:
  - `avatarStyle(name: string): { from: string; to: string }` — cặp màu hex gradient ổn định theo tên.
  - `initials(name: string): string` — tối đa 2 ký tự viết hoa.
  - `<CompanyAvatar name={string} className? />`.
  - `<Badge variant? className? />` với `variant`: `default | muted | salary | skill`.

- [ ] **Step 1: Viết test thất bại**

`lib/ui/__tests__/avatar-color.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { avatarStyle, initials } from "../avatar-color";

describe("avatar-color", () => {
  it("cùng tên -> cùng màu (ổn định)", () => {
    expect(avatarStyle("FPT Software")).toEqual(avatarStyle("FPT Software"));
  });

  it("trả về cặp hex hợp lệ", () => {
    const s = avatarStyle("ACME");
    expect(s.from).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(s.to).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("tên khác nhau có thể ra màu khác (không phải luôn cùng 1 màu)", () => {
    const colors = new Set(
      ["A", "B", "C", "D", "E", "F", "G", "H"].map((n) => avatarStyle(n).from),
    );
    expect(colors.size).toBeGreaterThan(1);
  });

  it("initials: 2 từ -> 2 ký tự hoa", () => {
    expect(initials("FPT Software")).toBe("FS");
  });

  it("initials: 1 từ -> tối đa 2 ký tự đầu hoa", () => {
    expect(initials("acme")).toBe("AC");
  });

  it("initials: rỗng -> '?'", () => {
    expect(initials("   ")).toBe("?");
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn fail**

Run: `npm test -- avatar-color`
Expected: FAIL ("Cannot find module '../avatar-color'").

- [ ] **Step 3: Cài đặt**

`lib/ui/avatar-color.ts`:

```ts
// Bảng gradient chàm-tím-hồng hợp tông thương hiệu.
const PALETTE: { from: string; to: string }[] = [
  { from: "#6366f1", to: "#a855f7" },
  { from: "#8b5cf6", to: "#ec4899" },
  { from: "#4f46e5", to: "#7c3aed" },
  { from: "#7c3aed", to: "#db2777" },
  { from: "#4338ca", to: "#6d28d9" },
  { from: "#9333ea", to: "#c026d3" },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function avatarStyle(name: string): { from: string; to: string } {
  const key = (name || "").trim().toLowerCase() || "?";
  return PALETTE[hash(key) % PALETTE.length];
}

export function initials(name: string): string {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
```

- [ ] **Step 4: Chạy test để chắc chắn pass**

Run: `npm test -- avatar-color`
Expected: PASS.

- [ ] **Step 5: Tạo CompanyAvatar**

`components/CompanyAvatar.tsx`:

```tsx
import { avatarStyle, initials } from "@/lib/ui/avatar-color";
import { cn } from "@/lib/utils";

export default function CompanyAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const { from, to } = avatarStyle(name);
  return (
    <span
      className={cn(
        "flex h-11 w-11 flex-none items-center justify-center rounded-xl text-sm font-bold text-white",
        className,
      )}
      style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
```

- [ ] **Step 6: Tạo Badge**

`components/ui/badge.tsx`:

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary",
        muted: "bg-muted text-muted-foreground",
        salary: "bg-amber-50 text-amber-700",
        skill: "bg-emerald-50 text-emerald-700",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
```

- [ ] **Step 7: Verify build**

Run: `npm run lint`
Expected: không lỗi mới.

- [ ] **Step 8: Commit**

```bash
git add lib/ui/avatar-color.ts lib/ui/__tests__/avatar-color.test.ts components/CompanyAvatar.tsx components/ui/badge.tsx
git commit -m "feat(ui): CompanyAvatar (stable color) + Badge variants"
```

---

### Task 6: Refactor JobMeta sang token + Badge, và JobCard

**Files:**
- Modify: `components/JobMeta.tsx`
- Create: `components/JobCard.tsx`

**Interfaces:**
- Consumes: `Badge` (Task 5), `CompanyAvatar` (Task 5), `formatSalary`, nhãn từ `job-fields`, `JOB_CATEGORY_LABELS`.
- Produces:
  - `<JobMeta ... />` (giữ props cũ) dùng Badge + token.
  - `<JobCard job={JobCardData} saveSlot? selected? href? />`.
  - `type JobCardData = { id; title; company; location?; employmentType?; experienceLevel?; skills?; salaryMin?; salaryMax?; salaryNegotiable?; category?; rawText? }`.

- [ ] **Step 1: Refactor JobMeta (thay hardcode màu bằng Badge/token)**

Thay phần `return (...)` của `components/JobMeta.tsx`:

```tsx
  return (
    <div className="flex flex-wrap gap-1.5">
      {salary && <Badge variant="salary">💰 {salary}</Badge>}
      {location?.trim() && <Badge variant="muted">📍 {location.trim()}</Badge>}
      {employmentType && <Badge variant="default">{EMPLOYMENT_TYPE_LABELS[employmentType]}</Badge>}
      {experienceLevel && <Badge variant="default">{EXPERIENCE_LEVEL_LABELS[experienceLevel]}</Badge>}
      {skillList.map((s) => (
        <Badge key={s} variant="skill">{s}</Badge>
      ))}
    </div>
  );
```

Thêm import đầu file: `import { Badge } from "@/components/ui/badge";`

- [ ] **Step 2: Tạo JobCard**

`components/JobCard.tsx`:

```tsx
import Link from "next/link";
import CompanyAvatar from "@/components/CompanyAvatar";
import JobMeta from "@/components/JobMeta";
import type { EmploymentType, ExperienceLevel } from "@/lib/jobs/job-fields";
import { cn } from "@/lib/utils";

export type JobCardData = {
  id: string;
  title: string;
  company: string;
  location?: string | null;
  employmentType?: EmploymentType | null;
  experienceLevel?: ExperienceLevel | null;
  skills?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryNegotiable?: boolean | null;
  rawText?: string | null;
};

export default function JobCard({
  job,
  href,
  selected = false,
  saveSlot,
}: {
  job: JobCardData;
  href?: string;
  selected?: boolean;
  saveSlot?: React.ReactNode;
}) {
  const inner = (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-sm transition-colors",
        selected ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-primary/40",
      )}
    >
      <div className="flex items-start gap-3 pr-8">
        <CompanyAvatar name={job.company || job.title} />
        <div className="min-w-0">
          <div className="truncate font-semibold text-foreground">{job.title || "(chưa có tiêu đề)"}</div>
          <div className="truncate text-sm text-muted-foreground">{job.company || "—"}</div>
          <div className="mt-2">
            <JobMeta
              location={job.location}
              employmentType={job.employmentType}
              experienceLevel={job.experienceLevel}
              skills={job.skills}
              salaryMin={job.salaryMin}
              salaryMax={job.salaryMax}
              salaryNegotiable={job.salaryNegotiable}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative">
      {href ? <Link href={href}>{inner}</Link> : inner}
      {saveSlot && <div className="absolute right-3 top-3">{saveSlot}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Chạy test toàn bộ (đảm bảo không vỡ)**

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 4: Verify build**

Run: `npm run lint`
Expected: không lỗi mới.

- [ ] **Step 5: Commit**

```bash
git add components/JobMeta.tsx components/JobCard.tsx
git commit -m "feat(ui): tokenized JobMeta + reusable JobCard"
```

---

### Task 7: Navbar & Footer refresh (token + gradient + mobile menu)

**Files:**
- Modify: `components/Navbar.tsx`
- Create/Modify: `components/Footer.tsx`

**Interfaces:**
- Consumes: tiện ích `.bg-brand-gradient`, `.text-brand-gradient` (Task 1).
- Produces: Navbar dùng token + logo gradient + menu mobile; Footer nhiều cột.

- [ ] **Step 1: Đổi hardcode màu trong Navbar sang token + logo gradient**

Trong `components/Navbar.tsx`:
- Logo: đổi `text-blue-600` → `text-brand-gradient`, giữ icon `Sparkles`.
- Container: `max-w-5xl` → `max-w-6xl`.
- Các link menu: `text-slate-600 hover:text-blue-600` → `text-muted-foreground hover:text-foreground`.
- Badge vai trò: `bg-blue-100 text-blue-700` → `bg-primary/10 text-primary`.
- Header viền: `border-slate-200` → `border-border`.
- Bọc menu desktop hiện tại trong `<div className="hidden items-center gap-2 sm:flex"> ... </div>` và thêm nút mobile:

```tsx
              <Link href="/jobs" className="text-sm font-medium text-muted-foreground hover:text-foreground sm:hidden">
                Việc làm
              </Link>
```

(Giữ nguyên toàn bộ logic `auth`, `signOut`, `RealtimeProvider`, chuông thông báo.)

- [ ] **Step 2: Tạo/refresh Footer**

`components/Footer.tsx` (nếu đã tồn tại thì thay nội dung):

```tsx
import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-1.5 text-lg font-bold text-brand-gradient">
            <Sparkles className="h-5 w-5 text-primary" />
            SmartHire
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Nền tảng CV thông minh, kết nối ứng viên và nhà tuyển dụng bằng AI.
          </p>
        </div>
        <div>
          <div className="mb-2 text-sm font-semibold text-foreground">Ứng viên</div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li><Link href="/jobs" className="hover:text-foreground">Việc làm</Link></li>
            <li><Link href="/dashboard" className="hover:text-foreground">Bảng điều khiển</Link></li>
          </ul>
        </div>
        <div>
          <div className="mb-2 text-sm font-semibold text-foreground">Nhà tuyển dụng</div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li><Link href="/jobs/new" className="hover:text-foreground">Đăng tin</Link></li>
          </ul>
        </div>
        <div>
          <div className="mb-2 text-sm font-semibold text-foreground">Tài khoản</div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li><Link href="/login" className="hover:text-foreground">Đăng nhập</Link></li>
            <li><Link href="/register" className="hover:text-foreground">Đăng ký</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} SmartHire. Dự án portfolio.
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run lint`
Expected: không lỗi mới.

- [ ] **Step 4: Commit**

```bash
git add components/Navbar.tsx components/Footer.tsx
git commit -m "feat(ui): tokenized Navbar with gradient logo + richer Footer"
```

---

### Task 8: Trang chủ (landing) mới

**Files:**
- Modify: `app/page.tsx`
- Create: `components/home/HomeSearch.tsx`

**Interfaces:**
- Consumes: `JobCard` (Task 6), `JOB_CATEGORIES` (Task 2), `buildJobsWhere`, Prisma, lucide icons.
- Produces: landing công khai với hero+search, lưới ngành, việc mới, số liệu.

- [ ] **Step 1: Tạo HomeSearch (thanh tìm việc hero)**

`components/home/HomeSearch.tsx`:

```tsx
import { Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function HomeSearch() {
  return (
    <form
      action="/jobs"
      method="get"
      className="mx-auto mt-8 flex max-w-2xl flex-col gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm sm:flex-row"
    >
      <div className="flex flex-1 items-center gap-2 px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          name="q"
          placeholder="Vị trí, công ty, kỹ năng..."
          className="w-full bg-transparent py-2 text-sm outline-none"
        />
      </div>
      <button type="submit" className={buttonVariants({ size: "lg", className: "bg-brand-gradient" })}>
        Tìm việc
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Viết lại `app/page.tsx`**

Thay toàn bộ `app/page.tsx` (giữ `export const dynamic = "force-dynamic"`). Điểm chính: hero + HomeSearch, lưới ngành, việc mới từ DB, số liệu. Dùng đúng import icon lucide theo `JOB_CATEGORIES[].icon`:

```tsx
import Link from "next/link";
import * as Icons from "lucide-react";
import { auth } from "@/auth";
export const dynamic = "force-dynamic";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import HomeSearch from "@/components/home/HomeSearch";
import JobCard from "@/components/JobCard";
import { buttonVariants } from "@/components/ui/button";
import { JOB_CATEGORIES } from "@/lib/jobs/job-categories";

const steps = [
  { n: "1", title: "Tạo hoặc nhập CV", desc: "Điền form hoặc tải PDF cũ để AI đọc giúp." },
  { n: "2", title: "AI đánh giá theo JD", desc: "Dán mô tả công việc, nhận điểm và phân tích chi tiết." },
  { n: "3", title: "Cải thiện & ứng tuyển", desc: "Hỏi chatbot, sửa CV và ứng tuyển tin phù hợp." },
];

export default async function Home() {
  const session = await auth();
  const loggedIn = !!session?.user;

  const [latestJobs, jobCount, companyGroups, cvCount] = await Promise.all([
    prisma.jobDescription.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true, title: true, company: true, location: true, rawText: true,
        employmentType: true, experienceLevel: true, skills: true,
        salaryMin: true, salaryMax: true, salaryNegotiable: true,
      },
    }),
    prisma.jobDescription.count({ where: { isPublic: true } }),
    prisma.jobDescription.findMany({ where: { isPublic: true }, distinct: ["company"], select: { company: true } }),
    prisma.cV.count(),
  ]);
  const companyCount = companyGroups.filter((c) => c.company.trim()).length;

  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-b from-primary/5 to-background">
          <div className="mx-auto max-w-3xl px-4 py-20 text-center">
            <p className="mb-3 text-sm font-medium text-primary">Miễn phí · AI · Tiếng Việt</p>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Tìm việc thông minh cùng <span className="text-brand-gradient">SmartHire</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Tạo CV, để AI đánh giá độ phù hợp với công việc và kết nối nhà tuyển dụng — tất cả trong một nơi.
            </p>
            <HomeSearch />
            {!loggedIn && (
              <div className="mt-4">
                <Link href="/register" className={buttonVariants({ variant: "ghost" })}>Tạo tài khoản miễn phí →</Link>
              </div>
            )}
          </div>
        </section>

        {/* Ngành nghề */}
        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="mb-6 text-center text-2xl font-bold text-foreground">Khám phá theo ngành nghề</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {JOB_CATEGORIES.map((c) => {
              const Icon = (Icons[c.icon as keyof typeof Icons] ?? Icons.Briefcase) as Icons.LucideIcon;
              return (
                <Link
                  key={c.slug}
                  href={`/jobs?category=${c.slug}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
                >
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-medium text-foreground">{c.label}</span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Việc mới */}
        {latestJobs.length > 0 && (
          <section className="bg-muted/30">
            <div className="mx-auto max-w-6xl px-4 py-14">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-foreground">Việc làm mới nhất</h2>
                <Link href="/jobs" className="text-sm font-medium text-primary hover:underline">Xem tất cả →</Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {latestJobs.map((j) => (
                  <JobCard key={j.id} job={j} href={loggedIn ? `/jobs/${j.id}` : "/login"} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Số liệu */}
        <section className="mx-auto max-w-6xl px-4 py-14">
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { n: jobCount, label: "Tin tuyển dụng" },
              { n: companyCount, label: "Công ty" },
              { n: cvCount, label: "CV đã tạo" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-border bg-card p-6">
                <div className="text-3xl font-bold text-brand-gradient">{s.n}</div>
                <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 3 bước */}
        <section className="bg-muted/30">
          <div className="mx-auto max-w-5xl px-4 py-14">
            <h2 className="mb-8 text-center text-2xl font-bold text-foreground">Cách hoạt động</h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {steps.map((s) => (
                <div key={s.n} className="text-center">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-gradient text-lg font-bold text-white">
                    {s.n}
                  </div>
                  <h3 className="font-semibold text-foreground">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
```

> Lưu ý model CV: kiểm tra tên Prisma model (`prisma.cV` hay `prisma.cv`). Mở `prisma/schema.prisma` xác nhận tên model CV rồi dùng cho `count()`. Nếu khác, chỉnh lại `cvCount`.

- [ ] **Step 3: Verify build + chạy dev thử**

Run: `npm run lint` rồi `npm run build`
Expected: build thành công, không lỗi type.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx components/home/HomeSearch.tsx
git commit -m "feat(home): rich landing — hero search, categories, latest jobs, stats"
```

---

### Task 9: Danh sách việc làm master-detail + chi tiết redesign

**Files:**
- Modify: `app/jobs/page.tsx`, `app/jobs/[id]/page.tsx`
- Create: `components/jobs/JobFilters.tsx`, `components/jobs/JobsBrowser.tsx`, `components/jobs/JobDetail.tsx`

**Interfaces:**
- Consumes: `JobCard`, `JobMeta`, `CompanyAvatar`, `buildJobsWhere` (+category), `JOB_CATEGORIES`, `EMPLOYMENT_TYPE_LABELS`, `EXPERIENCE_LEVEL_LABELS`, `formatSalary`.
- Produces:
  - `<JobFilters defaults={...} />` — form GET lọc (sidebar).
  - `<JobDetail job={FullJob} />` — thân chi tiết dùng chung.
  - `<JobsBrowser jobs selectedId savedIds isCandidate />` — client master-detail.

- [ ] **Step 1: Tạo JobFilters (server component, form GET)**

`components/jobs/JobFilters.tsx`:

```tsx
import {
  EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LEVELS, EXPERIENCE_LEVEL_LABELS,
} from "@/lib/jobs/job-fields";
import { SALARY_FILTER_STEPS } from "@/lib/jobs/salary";
import { JOB_CATEGORIES } from "@/lib/jobs/job-categories";

type Defaults = { q?: string; type?: string; level?: string; salary?: string; category?: string };

export default function JobFilters({ defaults }: { defaults: Defaults }) {
  const sel = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  return (
    <form method="get" className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <input type="text" name="q" defaultValue={defaults.q ?? ""} placeholder="Từ khóa..." className={sel} />
      <select name="category" defaultValue={defaults.category ?? ""} className={sel}>
        <option value="">Mọi ngành</option>
        {JOB_CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
      </select>
      <select name="type" defaultValue={defaults.type ?? ""} className={sel}>
        <option value="">Mọi loại hình</option>
        {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{EMPLOYMENT_TYPE_LABELS[t]}</option>)}
      </select>
      <select name="level" defaultValue={defaults.level ?? ""} className={sel}>
        <option value="">Mọi cấp bậc</option>
        {EXPERIENCE_LEVELS.map((l) => <option key={l} value={l}>{EXPERIENCE_LEVEL_LABELS[l]}</option>)}
      </select>
      <select name="salary" defaultValue={defaults.salary ?? ""} className={sel}>
        <option value="">Mọi mức lương</option>
        {SALARY_FILTER_STEPS.map((s) => <option key={s} value={s}>Từ {s} triệu</option>)}
      </select>
      <button type="submit" className="w-full rounded-md bg-brand-gradient px-4 py-2 text-sm font-medium text-white">
        Áp dụng bộ lọc
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Tạo JobDetail (thân chi tiết dùng chung)**

`components/jobs/JobDetail.tsx`:

```tsx
import CompanyAvatar from "@/components/CompanyAvatar";
import JobMeta from "@/components/JobMeta";
import type { JobCardData } from "@/components/JobCard";

export type JobDetailData = JobCardData;

export default function JobDetail({ job, action }: { job: JobDetailData; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start gap-4">
        <CompanyAvatar name={job.company || job.title} className="h-14 w-14 text-lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-foreground">{job.title || "(chưa có tiêu đề)"}</h1>
          <div className="text-sm text-muted-foreground">{job.company || "—"}</div>
          <div className="mt-3">
            <JobMeta
              location={job.location}
              employmentType={job.employmentType}
              experienceLevel={job.experienceLevel}
              skills={job.skills}
              salaryMin={job.salaryMin}
              salaryMax={job.salaryMax}
              salaryNegotiable={job.salaryNegotiable}
            />
          </div>
        </div>
      </div>
      {action && <div className="mt-4">{action}</div>}
      <div className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{job.rawText}</div>
    </div>
  );
}
```

- [ ] **Step 3: Tạo JobsBrowser (client master-detail)**

`components/jobs/JobsBrowser.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import JobCard, { type JobCardData } from "@/components/JobCard";
import JobDetail from "@/components/jobs/JobDetail";

export default function JobsBrowser({ jobs }: { jobs: JobCardData[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(jobs[0]?.id ?? null);
  const selected = jobs.find((j) => j.id === selectedId) ?? jobs[0] ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
      {/* Danh sách: mobile bấm -> điều hướng trang; desktop chọn pane */}
      <div className="space-y-3">
        {jobs.map((j) => (
          <div key={j.id}>
            {/* Mobile: link trang chi tiết */}
            <div className="lg:hidden">
              <JobCard job={j} href={`/jobs/${j.id}`} />
            </div>
            {/* Desktop: chọn để xem pane phải */}
            <button type="button" onClick={() => setSelectedId(j.id)} className="hidden w-full text-left lg:block">
              <JobCard job={j} selected={j.id === selectedId} />
            </button>
          </div>
        ))}
      </div>
      {/* Pane chi tiết (chỉ desktop) */}
      <div className="hidden lg:block">
        {selected ? (
          <div className="sticky top-20">
            <JobDetail
              job={selected}
              action={
                <button
                  type="button"
                  onClick={() => router.push(`/jobs/${selected.id}`)}
                  className="rounded-md bg-brand-gradient px-4 py-2 text-sm font-medium text-white"
                >
                  Xem chi tiết & ứng tuyển →
                </button>
              }
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            Chọn một tin để xem chi tiết.
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Viết lại `app/jobs/page.tsx` (layout 2 cột lọc + browser)**

Thay `return (...)`; giữ toàn bộ logic auth/query, bổ sung đọc `category` và truyền vào `buildJobsWhere`, `select` thêm `rawText` (đã có) — không cần `category` trong select trừ khi hiển thị. Phần đầu file thêm đọc category:

```tsx
  const { q, type, level, salary, category } = await searchParams;
```

(cập nhật type của `searchParams` thêm `category?: string`), rồi:

```tsx
  const categoryFilter = isJobCategory(category) ? category : undefined;
```

(thêm `import { isJobCategory } from "@/lib/jobs/job-categories";`) và truyền `category: categoryFilter` vào `buildJobsWhere`.

Thay khối JSX chính bằng:

```tsx
  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
        <h1 className="mb-4 text-2xl font-bold text-foreground">Tin tuyển dụng</h1>
        {isCandidate && (
          <div className="mb-4 flex gap-4 text-sm">
            <Link href="/jobs/saved" className="text-primary hover:underline">Tin đã lưu</Link>
            <Link href="/jobs/recommendations" className="text-primary hover:underline">Gợi ý việc cho tôi</Link>
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,16rem)_1fr]">
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <JobFilters defaults={{ q: term, type: typeFilter, level: levelFilter, salary: salary ?? "", category: categoryFilter }} />
          </aside>
          <div>
            {jobs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
                {term || typeFilter || levelFilter || salaryFilter || categoryFilter
                  ? "Không tìm thấy tin nào khớp bộ lọc."
                  : "Chưa có tin tuyển dụng nào."}
              </div>
            ) : (
              <JobsBrowser jobs={jobs} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
```

Thêm import: `JobFilters`, `JobsBrowser`. Bỏ import không dùng nữa (`Card`, `CardContent`, `Briefcase`, `SaveJobButton`, `JobMeta`, các nhãn EMPLOYMENT/EXPERIENCE nếu chỉ dùng trong form cũ). Giữ `SALARY_FILTER_STEPS` nếu còn dùng để validate `salaryFilter`.

> Ghi chú save: ở vòng này SaveJobButton chuyển về trang chi tiết `/jobs/[id]` (mobile) và pane không kèm nút lưu để giữ đơn giản; nút lưu vẫn còn ở trang chi tiết. (Có thể thêm lại `saveSlot` cho `JobCard` ở vòng sau.)

- [ ] **Step 5: Redesign trang chi tiết `app/jobs/[id]/page.tsx` dùng JobDetail**

Mở `app/jobs/[id]/page.tsx`, giữ nguyên toàn bộ logic tải dữ liệu/quyền/nút ứng tuyển-lưu hiện có; chỉ thay phần hiển thị tiêu đề + meta + rawText bằng `<JobDetail job={job} action={<...nút ứng tuyển/lưu hiện có...>} />`. Bọc trong `max-w-3xl`. Đổi các hardcode `blue-*`/`slate-*` còn lại sang token. (Đọc file trước khi sửa để giữ đúng các nút/hành động sẵn có.)

- [ ] **Step 6: Chạy test + build**

Run: `npm test` rồi `npm run build`
Expected: test PASS, build thành công.

- [ ] **Step 7: Commit**

```bash
git add app/jobs/page.tsx app/jobs/[id]/page.tsx components/jobs/
git commit -m "feat(jobs): master-detail browser + filters sidebar + redesigned detail"
```

---

### Task 10: Rà soát cuối & kiểm thử tổng

**Files:** (rà soát, không cố định)

- [ ] **Step 1: Grep hardcode màu còn sót trong phạm vi vòng 1**

Run (Grep tool): tìm `blue-600|text-slate-|bg-slate-` trong `app/page.tsx`, `app/jobs/page.tsx`, `app/jobs/[id]/page.tsx`, `app/jobs/new/page.tsx`, `components/Navbar.tsx`, `components/JobMeta.tsx`.
Expected: không còn (trừ ngoài phạm vi). Sửa nốt nếu sót.

- [ ] **Step 2: Chạy toàn bộ test**

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 3: Build production**

Run: `npm run build`
Expected: thành công, không lỗi type/lint.

- [ ] **Step 4: Chạy thử thủ công (khuyến nghị)**

Run: `npm run dev`, mở `http://localhost:3000` — kiểm tra: landing (khách chưa đăng nhập xem được, tìm việc, click ngành), `/jobs` (lọc + master-detail desktop, list→trang trên mobile), đăng tin có ô ngành, chi tiết việc.

- [ ] **Step 5: Commit dọn dẹp nếu có**

```bash
git add -A
git commit -m "chore(ui): finalize round-1 token cleanup"
```

---

## Self-Review (đã thực hiện khi viết plan)

- **Spec coverage:** (1) tokens/gradient → Task 1; (2) component dùng chung → Task 5,6,7; (3) landing 4 khối → Task 8; (4) master-detail + filters → Task 9; (5) ngành nghề (schema+query+form+landing) → Task 2,3,4,8; (6) TDD logic thuần → Task 2,3,5. ✅
- **Placeholder scan:** không có TODO/TBD; mọi bước có code hoặc lệnh cụ thể. Task 9 Step 5 yêu cầu "đọc file trước khi sửa" vì trang chi tiết chứa nút ứng tuyển/lưu động — cố ý giữ nguyên hành vi, không phải placeholder.
- **Type consistency:** `JobCardData` định nghĩa ở Task 6, tái dùng ở Task 9 (`JobDetailData = JobCardData`). `JobsFilter.category` (Task 3) khớp `normalizeCategory`/`isJobCategory` (Task 2). `avatarStyle`/`initials` khớp giữa Task 5 test và dùng ở CompanyAvatar.
- **Lưu ý xác minh khi triển khai:** tên Prisma model CV (`prisma.cV`) ở Task 8 Step 2 cần xác nhận với `schema.prisma`.
