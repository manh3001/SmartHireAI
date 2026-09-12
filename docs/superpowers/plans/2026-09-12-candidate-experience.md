# Trải nghiệm hồ sơ & ứng tuyển (Gói B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng trải nghiệm ứng viên: timeline ứng tuyển trực quan, thanh % hoàn thiện hồ sơ, và trạng thái "Đang tìm việc" (ứng viên bật + recruiter thấy/lọc).

**Architecture:** Logic thuần (dựng timeline, tính % hoàn thiện, lọc open) tách khỏi UI/IO để unit-test bằng vitest; các trang server component đọc Prisma rồi truyền xuống component/helper thuần. Một thay đổi schema duy nhất: cột `openToWork` trên `CandidateProfile`, áp bằng `prisma db push` + `prisma generate`.

**Tech Stack:** Next.js App Router (ĐỌC guide trong `node_modules/next/dist/docs/` trước khi viết), React server components, Prisma 6, Tailwind, lucide-react, vitest.

## Global Constraints

- Prisma v6 — KHÔNG nâng v7. Chỉ thêm 1 cột `openToWork Boolean @default(false)` (additive, an toàn ngược) trên `CandidateProfile`; áp bằng `npm run db:push` rồi `npx prisma generate`. Cột này ghi vào DB Neon dùng chung — additive nên không phá dữ liệu cũ.
- Tiếng Việt cho mọi văn bản UI; Tailwind tokens; prisma default import `@/lib/db/prisma`.
- ApplicationStatus = SUBMITTED|SCREENING|INTERVIEW|OFFER|HIRED|REJECTED|WITHDRAWN; nhãn lấy từ `STATUS_LABELS` (`lib/applications/status.ts`).
- Baseline 388 tests phải giữ xanh. Chạy test: `npx vitest run <path>`. Typecheck: `npx tsc --noEmit`.
- Không đụng match % trên `/jobs` (ngoài phạm vi).

---

### Task 1: Schema `openToWork` + db push + generate

**Files:**
- Modify: `prisma/schema.prisma` (model `CandidateProfile`)

- [ ] **Step 1: Thêm cột vào schema**

Trong `prisma/schema.prisma`, model `CandidateProfile`, thêm dòng sau ngay dưới `website   String   @default("")`:
```prisma
  openToWork Boolean  @default(false)
```

- [ ] **Step 2: Áp schema vào DB**

Run: `npm run db:push`
Expected: kết thúc với "Your database is now in sync with your Prisma schema" (hoặc tương đương). Nếu lỗi kết nối DB, DỪNG và báo NEEDS_CONTEXT (không tự sửa DB).

- [ ] **Step 3: Sinh lại Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client".

- [ ] **Step 4: Xác nhận typecheck vẫn sạch**

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(candidate): thêm cột openToWork vào CandidateProfile"
```

---

### Task 2: Timeline ứng tuyển

**Files:**
- Create: `lib/applications/timeline.ts`
- Create: `lib/applications/__tests__/timeline.test.ts`
- Create: `components/applications/ApplicationTimeline.tsx`
- Modify: `app/applications/page.tsx`

**Interfaces:**
- Consumes: `STATUS_LABELS`, `ApplicationStatus` từ `@/lib/applications/status`
- Produces:
  - `export type TimelineStep = { status: ApplicationStatus; label: string; date: Date; isCurrent: boolean }`
  - `export function buildApplicationTimeline(app: { createdAt: Date; status: ApplicationStatus; events: { toStatus: ApplicationStatus; createdAt: Date }[] }): TimelineStep[]`

- [ ] **Step 1: Viết test thất bại**

`lib/applications/__tests__/timeline.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildApplicationTimeline } from "../timeline";

const d = (s: string) => new Date(s);

describe("buildApplicationTimeline", () => {
  it("chỉ mới nộp -> 1 bước Đã nộp, isCurrent", () => {
    const steps = buildApplicationTimeline({
      createdAt: d("2026-09-01T09:00:00Z"),
      status: "SUBMITTED",
      events: [],
    });
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ status: "SUBMITTED", label: "Đã nộp", isCurrent: true });
  });

  it("nộp + sàng lọc + phỏng vấn -> 3 bước, bước cuối current", () => {
    const steps = buildApplicationTimeline({
      createdAt: d("2026-09-01T09:00:00Z"),
      status: "INTERVIEW",
      events: [
        { toStatus: "SCREENING", createdAt: d("2026-09-02T09:00:00Z") },
        { toStatus: "INTERVIEW", createdAt: d("2026-09-03T09:00:00Z") },
      ],
    });
    expect(steps.map((s) => s.status)).toEqual(["SUBMITTED", "SCREENING", "INTERVIEW"]);
    expect(steps[2].isCurrent).toBe(true);
    expect(steps[0].isCurrent).toBe(false);
  });

  it("không nhân đôi khi event đầu đã là SUBMITTED", () => {
    const steps = buildApplicationTimeline({
      createdAt: d("2026-09-01T09:00:00Z"),
      status: "SCREENING",
      events: [
        { toStatus: "SUBMITTED", createdAt: d("2026-09-01T09:00:00Z") },
        { toStatus: "SCREENING", createdAt: d("2026-09-02T09:00:00Z") },
      ],
    });
    expect(steps.map((s) => s.status)).toEqual(["SUBMITTED", "SCREENING"]);
    expect(steps[1].isCurrent).toBe(true);
  });

  it("REJECTED là bước cuối current", () => {
    const steps = buildApplicationTimeline({
      createdAt: d("2026-09-01T09:00:00Z"),
      status: "REJECTED",
      events: [
        { toStatus: "SCREENING", createdAt: d("2026-09-02T09:00:00Z") },
        { toStatus: "REJECTED", createdAt: d("2026-09-03T09:00:00Z") },
      ],
    });
    expect(steps[steps.length - 1]).toMatchObject({ status: "REJECTED", isCurrent: true });
  });
});
```

- [ ] **Step 2: Chạy test — phải fail**

Run: `npx vitest run lib/applications/__tests__/timeline.test.ts`
Expected: FAIL (`Cannot find module '../timeline'`).

- [ ] **Step 3: Viết implementation**

`lib/applications/timeline.ts`:
```ts
import { STATUS_LABELS, type ApplicationStatus } from "./status";

export type TimelineStep = {
  status: ApplicationStatus;
  label: string;
  date: Date;
  isCurrent: boolean;
};

// events phải được sắp xếp tăng dần theo createdAt (trang applications đã orderBy asc).
export function buildApplicationTimeline(app: {
  createdAt: Date;
  status: ApplicationStatus;
  events: { toStatus: ApplicationStatus; createdAt: Date }[];
}): TimelineStep[] {
  const raw: { status: ApplicationStatus; date: Date }[] = [];
  const hasSubmitted = app.events.some((e) => e.toStatus === "SUBMITTED");
  if (!hasSubmitted) raw.push({ status: "SUBMITTED", date: app.createdAt });
  for (const e of app.events) raw.push({ status: e.toStatus, date: e.createdAt });

  let currentIdx = -1;
  for (let i = raw.length - 1; i >= 0; i--) {
    if (raw[i].status === app.status) { currentIdx = i; break; }
  }

  return raw.map((s, i) => ({
    status: s.status,
    label: STATUS_LABELS[s.status],
    date: s.date,
    isCurrent: i === currentIdx,
  }));
}
```

- [ ] **Step 4: Chạy test — phải pass**

Run: `npx vitest run lib/applications/__tests__/timeline.test.ts`
Expected: PASS (4 test).

- [ ] **Step 5: Tạo component `ApplicationTimeline`**

`components/applications/ApplicationTimeline.tsx`:
```tsx
import { buildApplicationTimeline } from "@/lib/applications/timeline";
import type { ApplicationStatus } from "@/lib/applications/status";
import { cn } from "@/lib/utils";

export default function ApplicationTimeline({
  app,
}: {
  app: {
    createdAt: Date;
    status: ApplicationStatus;
    events: { toStatus: ApplicationStatus; createdAt: Date }[];
  };
}) {
  const steps = buildApplicationTimeline(app);
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => (
        <li key={i} className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full border-2",
              s.isCurrent ? "border-primary bg-primary" : "border-muted-foreground/40 bg-background",
            )}
            aria-hidden
          />
          <div className="min-w-0">
            <div className={cn("text-sm font-medium", s.isCurrent ? "text-primary" : "text-foreground")}>
              {s.label}
            </div>
            <div className="text-xs text-muted-foreground">
              {s.date.toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" })}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 6: Dùng component trong `app/applications/page.tsx`**

Thêm import (cùng nhóm import trên đầu file):
```ts
import ApplicationTimeline from "@/components/applications/ApplicationTimeline";
```
Thay khối flow thô:
```tsx
                  <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                    {a.events.map((e, i) => (
                      <span key={i}>
                        {STATUS_LABELS[e.toStatus as ApplicationStatus]}
                        {i < a.events.length - 1 ? " → " : ""}
                      </span>
                    ))}
                  </div>
```
bằng:
```tsx
                  <ApplicationTimeline app={a} />
```
Lưu ý: query hiện đã select `status`, `createdAt`, và `events { toStatus, createdAt }` — đủ cho component. Nếu sau khi thay `STATUS_LABELS`/`ApplicationStatus` không còn dùng ở file, gỡ import thừa để lint sạch.

- [ ] **Step 7: Typecheck + test toàn bộ**

Run: `npx tsc --noEmit` → Expected: không lỗi.
Run: `npx vitest run` → Expected: toàn bộ PASS (388 + 4 = 392).

- [ ] **Step 8: Commit**

```bash
git add lib/applications/timeline.ts lib/applications/__tests__/timeline.test.ts components/applications/ApplicationTimeline.tsx app/applications/page.tsx
git commit -m "feat(applications): timeline ứng tuyển trực quan có mốc thời gian"
```

---

### Task 3: % hoàn thiện hồ sơ

**Files:**
- Create: `lib/candidates/completeness.ts`
- Create: `lib/candidates/__tests__/completeness.test.ts`
- Create: `components/candidates/ProfileCompleteness.tsx`
- Modify: `app/settings/profile/page.tsx`
- Modify: `app/dashboard/page.tsx` (nhánh CANDIDATE)

**Interfaces:**
- Produces:
  - `export type CompletenessInput = { hasCV: boolean; bio: string; github: string; linkedin: string; website: string }`
  - `export type CompletenessItem = { key: string; label: string; href: string }`
  - `export type CompletenessResult = { percent: number; missing: CompletenessItem[] }`
  - `export function profileCompleteness(input: CompletenessInput): CompletenessResult`

- [ ] **Step 1: Viết test thất bại**

`lib/candidates/__tests__/completeness.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { profileCompleteness } from "../completeness";

const empty = { hasCV: false, bio: "", github: "", linkedin: "", website: "" };
const full = { hasCV: true, bio: "Xin chào", github: "g", linkedin: "l", website: "w" };

describe("profileCompleteness", () => {
  it("rỗng hết -> 0%, thiếu 5 mục", () => {
    const r = profileCompleteness(empty);
    expect(r.percent).toBe(0);
    expect(r.missing).toHaveLength(5);
    expect(r.missing[0].key).toBe("hasCV");
  });

  it("đủ 5 -> 100%, không thiếu", () => {
    const r = profileCompleteness(full);
    expect(r.percent).toBe(100);
    expect(r.missing).toEqual([]);
  });

  it("có CV + bio -> 40%, thiếu theo thứ tự github/linkedin/website", () => {
    const r = profileCompleteness({ ...empty, hasCV: true, bio: "hi" });
    expect(r.percent).toBe(40);
    expect(r.missing.map((m) => m.key)).toEqual(["github", "linkedin", "website"]);
  });

  it("bio chỉ khoảng trắng coi như trống", () => {
    const r = profileCompleteness({ ...full, bio: "   " });
    expect(r.missing.map((m) => m.key)).toEqual(["bio"]);
  });
});
```

- [ ] **Step 2: Chạy test — phải fail**

Run: `npx vitest run lib/candidates/__tests__/completeness.test.ts`
Expected: FAIL (`Cannot find module '../completeness'`).

- [ ] **Step 3: Viết implementation**

`lib/candidates/completeness.ts`:
```ts
export type CompletenessInput = {
  hasCV: boolean;
  bio: string;
  github: string;
  linkedin: string;
  website: string;
};

export type CompletenessItem = { key: string; label: string; href: string };
export type CompletenessResult = { percent: number; missing: CompletenessItem[] };

const ITEMS: { key: keyof CompletenessInput; label: string; href: string }[] = [
  { key: "hasCV", label: "Tạo CV", href: "/cv" },
  { key: "bio", label: "Viết giới thiệu bản thân", href: "/settings/profile" },
  { key: "github", label: "Thêm GitHub", href: "/settings/profile" },
  { key: "linkedin", label: "Thêm LinkedIn", href: "/settings/profile" },
  { key: "website", label: "Thêm website", href: "/settings/profile" },
];

function isFilled(input: CompletenessInput, key: keyof CompletenessInput): boolean {
  const v = input[key];
  return typeof v === "boolean" ? v : v.trim().length > 0;
}

export function profileCompleteness(input: CompletenessInput): CompletenessResult {
  const filledCount = ITEMS.filter((it) => isFilled(input, it.key)).length;
  const missing = ITEMS.filter((it) => !isFilled(input, it.key)).map(
    ({ key, label, href }) => ({ key, label, href }),
  );
  const percent = Math.round((filledCount / ITEMS.length) * 100);
  return { percent, missing };
}
```

- [ ] **Step 4: Chạy test — phải pass**

Run: `npx vitest run lib/candidates/__tests__/completeness.test.ts`
Expected: PASS (4 test).

- [ ] **Step 5: Tạo component `ProfileCompleteness`**

`components/candidates/ProfileCompleteness.tsx`:
```tsx
import Link from "next/link";
import type { CompletenessResult } from "@/lib/candidates/completeness";

export default function ProfileCompleteness({
  result,
  compact = false,
}: {
  result: CompletenessResult;
  compact?: boolean;
}) {
  const { percent, missing } = result;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Hoàn thiện hồ sơ</span>
        <span className="text-sm font-semibold text-primary">{percent}%</span>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-muted">
        <div className="h-2 rounded-full bg-brand-gradient" style={{ width: `${percent}%` }} />
      </div>
      {missing.length > 0 && (
        <ul className={compact ? "mt-2 flex flex-wrap gap-2" : "mt-3 flex flex-col gap-1"}>
          {missing.map((m) => (
            <li key={m.key}>
              <Link href={m.href} className="text-xs font-medium text-primary hover:underline">
                + {m.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Hiện meter trên `app/settings/profile/page.tsx`**

Trong query `prisma.candidateProfile.findUnique`, KHÔNG cần đổi (dùng bio/github/linkedin/website đã select). Sau khi lấy `profile`, thêm đếm CV và tính completeness. Thêm import:
```ts
import { profileCompleteness } from "@/lib/candidates/completeness";
import ProfileCompleteness from "@/components/candidates/ProfileCompleteness";
```
Sau khối `const profile = await prisma.candidateProfile.findUnique({...})`, thêm:
```ts
  const cvCount = await prisma.cV.count({ where: { userId } });
  const completeness = profileCompleteness({
    hasCV: cvCount > 0,
    bio: profile?.bio ?? "",
    github: profile?.github ?? "",
    linkedin: profile?.linkedin ?? "",
    website: profile?.website ?? "",
  });
```
Trong JSX, ngay dưới `<h1 ...>Hồ sơ cá nhân</h1>`, chèn:
```tsx
        <div className="mb-6">
          <ProfileCompleteness result={completeness} />
        </div>
```

- [ ] **Step 7: Thẻ nhắc trên dashboard ứng viên**

Trong `app/dashboard/page.tsx` (nhánh CANDIDATE — phần sau `const cvs = await prisma.cV.findMany(...)`), thêm import (đầu file, cùng nhóm):
```ts
import { profileCompleteness } from "@/lib/candidates/completeness";
import ProfileCompleteness from "@/components/candidates/ProfileCompleteness";
```
Sau `const cvCount = cvs.length;` (nhánh candidate), thêm:
```ts
  const candidateProfile = await prisma.candidateProfile.findUnique({
    where: { userId: session.user.id },
    select: { bio: true, github: true, linkedin: true, website: true },
  });
  const completeness = profileCompleteness({
    hasCV: cvCount > 0,
    bio: candidateProfile?.bio ?? "",
    github: candidateProfile?.github ?? "",
    linkedin: candidateProfile?.linkedin ?? "",
    website: candidateProfile?.website ?? "",
  });
```
Trong JSX nhánh candidate, ngay trước `<CandidateStats userId={session.user.id} />`, chèn (chỉ hiện khi <100%):
```tsx
        {completeness.percent < 100 && (
          <div className="mb-6">
            <ProfileCompleteness result={completeness} compact />
          </div>
        )}
```

- [ ] **Step 8: Typecheck + test toàn bộ**

Run: `npx tsc --noEmit` → Expected: không lỗi.
Run: `npx vitest run` → Expected: toàn bộ PASS (392 + 4 = 396).

- [ ] **Step 9: Commit**

```bash
git add lib/candidates/completeness.ts lib/candidates/__tests__/completeness.test.ts components/candidates/ProfileCompleteness.tsx app/settings/profile/page.tsx app/dashboard/page.tsx
git commit -m "feat(candidate): thanh % hoàn thiện hồ sơ (settings + dashboard)"
```

---

### Task 4: Trạng thái "Đang tìm việc" — phía ứng viên

**Files:**
- Modify: `lib/candidates/profile-logic.ts` (thêm `openToWork` vào `ProfileInput`)
- Modify: `lib/candidates/__tests__/profile.test.ts` (cập nhật fixture + test passthrough)
- Modify: `app/settings/profile/ProfileForm.tsx` (toggle)
- Modify: `app/settings/profile/page.tsx` (select + initial `openToWork`)

**Interfaces:**
- Consumes: `runUpsertProfile`, `ProfileInput` (`lib/candidates/profile-logic.ts`)
- Produces: `ProfileInput` có thêm `openToWork: boolean`

- [ ] **Step 1: Cập nhật test (RED)**

Trong `lib/candidates/__tests__/profile.test.ts`, thêm `openToWork: false` vào `validInput`:
```ts
const validInput = {
  username: "nguyena",
  bio: "Hello",
  github: "github.com/nguyena",
  linkedin: "",
  twitter: "",
  website: "",
  openToWork: false,
};
```
Và thêm test mới trong describe:
```ts
  it("truyền openToWork xuống upsert", async () => {
    const deps = makeDeps();
    const result = await runUpsertProfile("user1", { ...validInput, openToWork: true }, deps);
    expect(result).toEqual({ ok: true });
    expect(deps.upsertProfile).toHaveBeenCalledWith(
      "user1",
      expect.objectContaining({ openToWork: true }),
    );
  });
```

- [ ] **Step 2: Chạy test — phải fail**

Run: `npx vitest run lib/candidates/__tests__/profile.test.ts`
Expected: FAIL (TS: `openToWork` không có trên `ProfileInput`).

- [ ] **Step 3: Thêm `openToWork` vào `ProfileInput`**

Trong `lib/candidates/profile-logic.ts`, sửa type:
```ts
export type ProfileInput = {
  username: string;
  bio: string;
  github: string;
  linkedin: string;
  twitter: string;
  website: string;
  openToWork: boolean;
};
```
Không cần đổi thân `runUpsertProfile` — nó đã gọi `deps.upsertProfile(userId, { ...data, username })`, nên `openToWork` tự truyền qua.

- [ ] **Step 4: Chạy test — phải pass**

Run: `npx vitest run lib/candidates/__tests__/profile.test.ts`
Expected: PASS (test cũ + test passthrough mới).

- [ ] **Step 5: Toggle trong `ProfileForm.tsx`**

Trong `app/settings/profile/ProfileForm.tsx`, thêm handler boolean (sau `handleChange`):
```tsx
  function handleToggle(value: boolean) {
    setForm((f) => ({ ...f, openToWork: value }));
    setSaved(false);
    setError(null);
  }
```
Ngay trước khối `{error && ...}`, chèn toggle:
```tsx
      <label className="flex items-center gap-3 rounded-md border border-border bg-card p-3">
        <input
          type="checkbox"
          checked={form.openToWork}
          onChange={(e) => handleToggle(e.target.checked)}
          className="h-4 w-4"
        />
        <span className="text-sm text-foreground">
          Đang tìm việc — cho nhà tuyển dụng biết bạn sẵn sàng
        </span>
      </label>
```

- [ ] **Step 6: `page.tsx` select + initial `openToWork`**

Trong `app/settings/profile/page.tsx`, thêm `openToWork: true` vào `select` của `findUnique`, và `openToWork: profile?.openToWork ?? false` vào object `initial`.

- [ ] **Step 7: Typecheck + test toàn bộ**

Run: `npx tsc --noEmit` → Expected: không lỗi (Prisma client đã có `openToWork` từ Task 1).
Run: `npx vitest run` → Expected: toàn bộ PASS (396 + 1 = 397).

- [ ] **Step 8: Commit**

```bash
git add lib/candidates/profile-logic.ts lib/candidates/__tests__/profile.test.ts app/settings/profile/ProfileForm.tsx app/settings/profile/page.tsx
git commit -m "feat(candidate): toggle Đang tìm việc trên hồ sơ ứng viên"
```

---

### Task 5: Trạng thái "Đang tìm việc" — phía recruiter (badge + lọc)

**Files:**
- Modify: `lib/candidates/search.ts` (`CandidateCard`, `RawRow`, query, map, `applyOpenFilter`, `searchCandidates`)
- Modify: `lib/candidates/__tests__/search.test.ts` (cập nhật `RawRow` fixture + test `applyOpenFilter`)
- Modify: `app/candidates/page.tsx` (đọc `open`)
- Modify: `app/candidates/CandidateSearch.tsx` (checkbox + badge)

**Interfaces:**
- Consumes: `searchCandidates`, `CandidateCard` (`lib/candidates/search.ts`)
- Produces:
  - `CandidateCard` có thêm `openToWork: boolean`
  - `export function applyOpenFilter(rows: RawRow[], open: string | undefined): RawRow[]`
  - `searchCandidates(params: { q?: string; exp?: string; open?: string })`

- [ ] **Step 1: Cập nhật test (RED)**

Trong `lib/candidates/__tests__/search.test.ts`, sửa type `RawRow` cục bộ trong file để thêm `openToWork` và cập nhật hàm `row(...)`:
```ts
type RawRow = {
  id: string;
  shareToken: string | null;
  profile: { fullName: string; headline: string; location: string } | null;
  skills: { name: string }[];
  _count: { experiences: number };
  openToWork: boolean;
};

function row(experienceCount: number, id = `cv_${experienceCount}`, openToWork = false): RawRow {
  return {
    id,
    shareToken: `tok_${id}`,
    profile: { fullName: `Ứng viên ${id}`, headline: "Developer", location: "HCM" },
    skills: [{ name: "React" }, { name: "TypeScript" }],
    _count: { experiences: experienceCount },
    openToWork,
  };
}
```
Thêm import `applyOpenFilter` và block test:
```ts
import { applyExpFilter, mapToCandidateCards, applyOpenFilter } from "../search";
```
```ts
describe("applyOpenFilter", () => {
  it("open '1' -> chỉ giữ openToWork=true", () => {
    const rows = [row(1, "a", true), row(1, "b", false)];
    const result = applyOpenFilter(rows, "1");
    expect(result.map((r) => r.id)).toEqual(["a"]);
  });

  it("open undefined -> giữ nguyên", () => {
    const rows = [row(1, "a", true), row(1, "b", false)];
    expect(applyOpenFilter(rows, undefined)).toHaveLength(2);
  });
});
```
Trong test `mapToCandidateCards` nếu có assert cấu trúc card, thêm kỳ vọng `openToWork` (nếu test hiện assert bằng `toEqual` object đầy đủ; nếu chỉ dùng `row()` helper thì đã có sẵn field).

- [ ] **Step 2: Chạy test — phải fail**

Run: `npx vitest run lib/candidates/__tests__/search.test.ts`
Expected: FAIL (`applyOpenFilter` chưa export; và `mapToCandidateCards` chưa gán `openToWork`).

- [ ] **Step 3: Sửa `lib/candidates/search.ts`**

Thêm `openToWork` vào `CandidateCard`:
```ts
export type CandidateCard = {
  cvId: string;
  shareToken: string;
  fullName: string;
  headline: string;
  location: string;
  skills: string[];
  openToWork: boolean;
};
```
Thêm `openToWork` vào `RawRow`:
```ts
type RawRow = {
  id: string;
  shareToken: string | null;
  profile: { fullName: string; headline: string; location: string } | null;
  skills: { name: string }[];
  _count: { experiences: number };
  openToWork: boolean;
};
```
Thêm helper thuần (sau `applyExpFilter`):
```ts
export function applyOpenFilter(rows: RawRow[], open: string | undefined): RawRow[] {
  if (open !== "1") return rows;
  return rows.filter((r) => r.openToWork);
}
```
Trong `mapToCandidateCards`, thêm `openToWork: r.openToWork,` vào object trả về.
Trong `searchCandidates`: đổi chữ ký params thành `{ q?: string; exp?: string; open?: string }`; trong `prisma.cV.findMany` select thêm:
```ts
      user: { select: { candidateProfile: { select: { openToWork: true } } } },
```
Sau `const rows = await prisma.cV.findMany({...})`, vì `rows` từ Prisma có `user.candidateProfile.openToWork` (nested) chứ không phẳng, ánh xạ về `RawRow` phẳng trước khi lọc:
```ts
  const flat: RawRow[] = rows.map((r) => ({
    id: r.id,
    shareToken: r.shareToken,
    profile: r.profile,
    skills: r.skills,
    _count: r._count,
    openToWork: r.user?.candidateProfile?.openToWork ?? false,
  }));
  const byExp = applyExpFilter(flat, params.exp);
  const byOpen = applyOpenFilter(byExp, params.open);
  return mapToCandidateCards(byOpen.slice(0, 50));
```
(Xóa 2 dòng cũ `const filtered = applyExpFilter(rows, params.exp); return mapToCandidateCards(filtered.slice(0, 50));`.)

- [ ] **Step 4: Chạy test — phải pass**

Run: `npx vitest run lib/candidates/__tests__/search.test.ts`
Expected: PASS (test cũ + applyOpenFilter).

- [ ] **Step 5: `app/candidates/page.tsx` đọc `open`**

Sửa kiểu `searchParams`:
```ts
  searchParams: Promise<{ q?: string; exp?: string; open?: string }>;
```
Sửa destructure + gọi:
```ts
  const { q, exp, open } = await searchParams;
  const candidates = await searchCandidates({ q, exp, open });
```
Truyền xuống component:
```tsx
        <CandidateSearch
          initialCandidates={candidates}
          initialQ={q ?? ""}
          initialExp={exp ?? ""}
          initialOpen={open === "1"}
        />
```

- [ ] **Step 6: `CandidateSearch.tsx` checkbox + badge**

Thêm prop `initialOpen: boolean` vào chữ ký + state:
```tsx
export default function CandidateSearch({
  initialCandidates,
  initialQ,
  initialExp,
  initialOpen,
}: {
  initialCandidates: CandidateCard[];
  initialQ: string;
  initialExp: string;
  initialOpen: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [exp, setExp] = useState(initialExp);
  const [open, setOpen] = useState(initialOpen);
```
Trong `handleSearch`, trước `const qs = params.toString();`, thêm:
```tsx
    if (open) params.set("open", "1");
```
Trong `<form>`, sau `<select ...>...</select>` và trước `<Button type="submit" ...>`, thêm checkbox:
```tsx
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={open}
            onChange={(e) => setOpen(e.target.checked)}
            className="h-4 w-4"
          />
          Chỉ người đang tìm việc
        </label>
```
Trong thẻ ứng viên, ngay dưới khối tên/headline (sau `</div>` bao `CompanyAvatar` + tên), thêm badge:
```tsx
                {c.openToWork && (
                  <Badge variant="outline" className="mt-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                    Đang tìm việc
                  </Badge>
                )}
```

- [ ] **Step 7: Typecheck + test toàn bộ**

Run: `npx tsc --noEmit` → Expected: không lỗi.
Run: `npx vitest run` → Expected: toàn bộ PASS (397 + 2 = 399).

- [ ] **Step 8: Commit**

```bash
git add lib/candidates/search.ts lib/candidates/__tests__/search.test.ts app/candidates/page.tsx app/candidates/CandidateSearch.tsx
git commit -m "feat(candidate): recruiter thấy badge + lọc Đang tìm việc"
```

---

### Task 6: Kiểm chứng cuối

**Files:** (không sửa; chỉ chạy)

- [ ] **Step 1: Lint + typecheck + test đầy đủ**

Run:
```bash
npx tsc --noEmit
npm run lint
npx vitest run
```
Expected: tsc sạch; test toàn bộ PASS (399). Lint: KHÔNG có lỗi MỚI so với baseline (đã tồn đọng sẵn 3 errors: ThemeToggle set-state-in-effect, recruiter-analytics.test no-explicit-any x2 — không thuộc phạm vi vòng này). Nếu xuất hiện lỗi lint ở file vòng này sửa/tạo, phải sửa.

- [ ] **Step 2: Chạy app soát mắt (khuyến nghị)**

Run: `npm run dev`:
- `/applications` (đăng nhập ứng viên): mỗi đơn hiện timeline dọc có mốc thời gian, bước hiện tại nổi bật.
- `/settings/profile`: thanh % hoàn thiện + checklist; toggle "Đang tìm việc" lưu được.
- `/dashboard` (ứng viên): thẻ nhắc hoàn thiện hiện khi <100%.
- `/candidates` (đăng nhập recruiter): badge "Đang tìm việc"; tick "Chỉ người đang tìm việc" lọc đúng.

## Self-Review

- **Spec coverage:** Timeline (Task 2) ✅ · % hoàn thiện + meter settings + nhắc dashboard (Task 3) ✅ · schema openToWork (Task 1) ✅ · toggle ứng viên (Task 4) ✅ · recruiter badge + lọc (Task 5) ✅ · kiểm thử unit 4 helper (Task 2,3,4,5) ✅ · kiểm chứng cuối (Task 6) ✅.
- **Placeholder scan:** không có TBD/TODO; mọi step code đầy đủ.
- **Type consistency:** `TimelineStep`/`buildApplicationTimeline`, `CompletenessInput`/`CompletenessResult`/`profileCompleteness`, `ProfileInput.openToWork`, `CandidateCard.openToWork`/`applyOpenFilter` nhất quán giữa producer và consumer. `openToWork` được sinh trong Prisma client ở Task 1 trước khi các task sau tham chiếu.
