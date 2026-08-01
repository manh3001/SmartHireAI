# Phase 15 — Dashboard theo vai Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chèn dải thống kê theo vai lên đầu `/dashboard` — NTD xem phễu tuyển dụng của mình, ứng viên xem thống kê đơn của mình.

**Architecture:** Chuyển `shapeStatusDistribution` về `lib/applications/status.ts` để dùng chung. Lớp data `lib/dashboard/*` (truy vấn Prisma) + hàm thuần `lib/dashboard/shape.ts` (`computeConversion`, `formatActivity`) test được. Hai server component `RecruiterStats`/`CandidateStats` render dải thống kê ở đầu `/dashboard`.

**Tech Stack:** Next.js 16 (App Router, server components), Prisma 6 + Postgres (Neon), Vitest, Tailwind + shadcn/ui.

## Global Constraints

- Prisma pinned v6 — KHÔNG nâng. Lệnh DB qua script npm có `NODE_OPTIONS=--dns-result-order=ipv4first`.
- Tái dùng `APPLICATION_STATUSES` + `STATUS_LABELS` từ `lib/applications/status.ts` (DRY) — không khai lại nhãn trạng thái.
- Không thêm thư viện chart — bar bằng Tailwind div, bảo vệ chia-0 bằng `Math.max(1, ...)`.
- Hàm thuần tách file để test không cần Prisma/Next runtime (kiểu DI của repo).
- `computeConversion` trả tỉ lệ dạng số 0–1; UI nhân 100 + "%".
- UI text tiếng Việt, đồng bộ style `/admin`.
- Verify UI/DB task bằng `npx tsc --noEmit` + `npm run lint` (+ `npm test` ở task cuối). Lint có 1 cảnh báo có sẵn (`summary` unused trong AI test) — bỏ qua.

---

### Task 1: Chuyển `shapeStatusDistribution` về `lib/applications/status.ts`

**Files:**
- Modify: `lib/applications/status.ts` (thêm hàm)
- Modify: `lib/admin/stats-shape.ts` (bỏ hàm + import thừa)
- Modify: `lib/admin/stats.ts` (đổi nguồn import)
- Modify: `lib/applications/__tests__/status.test.ts` (thêm test)
- Modify: `lib/admin/__tests__/stats-shape.test.ts` (bỏ test đã chuyển)

**Interfaces:**
- Produces: `shapeStatusDistribution(groups: {status: string; count: number}[]): {status: string; label: string; count: number}[]` — nay export từ `@/lib/applications/status`.

- [ ] **Step 1: Thêm hàm vào `lib/applications/status.ts`**

Ở CUỐI file `lib/applications/status.ts`, thêm:

```ts
// Định hình kết quả groupBy status thành mảng đủ 7 trạng thái đúng thứ tự vòng đời,
// kèm nhãn tiếng Việt; trạng thái vắng mặt = 0. Dùng chung cho /admin và dashboard.
export function shapeStatusDistribution(
  groups: { status: string; count: number }[],
): { status: string; label: string; count: number }[] {
  const map = new Map(groups.map((g) => [g.status, g.count]));
  return APPLICATION_STATUSES.map((s) => ({
    status: s,
    label: STATUS_LABELS[s],
    count: map.get(s) ?? 0,
  }));
}
```

- [ ] **Step 2: Bỏ hàm + import thừa khỏi `lib/admin/stats-shape.ts`**

Xoá khối `export function shapeStatusDistribution(...) {...}` (hàm đầu file). Xoá luôn dòng import đầu file `import { APPLICATION_STATUSES, STATUS_LABELS } from "@/lib/applications/status";` (không còn dùng sau khi bỏ hàm — `shapeRoleCounts`/`summarizeSalaries` không cần). File chỉ còn `shapeRoleCounts` và `summarizeSalaries`.

- [ ] **Step 3: Đổi nguồn import trong `lib/admin/stats.ts`**

Sửa dòng import:

```ts
import { shapeRoleCounts, summarizeSalaries } from "./stats-shape";
import { shapeStatusDistribution } from "@/lib/applications/status";
```

- [ ] **Step 4: Chuyển test — thêm vào `lib/applications/__tests__/status.test.ts`**

Sửa dòng import ở đầu file để thêm `shapeStatusDistribution`:

```ts
import {
  APPLICATION_STATUSES,
  BOARD_STATUSES,
  STATUS_LABELS,
  canTransition,
  canWithdraw,
  shapeStatusDistribution,
} from "../status";
```

Thêm block test mới (cuối file, trước dấu đóng cùng cấp):

```ts
describe("shapeStatusDistribution", () => {
  it("đủ 7 trạng thái đúng thứ tự, vắng mặt = 0", () => {
    const out = shapeStatusDistribution([
      { status: "HIRED", count: 3 },
      { status: "SUBMITTED", count: 5 },
    ]);
    expect(out.map((o) => o.status)).toEqual([
      "SUBMITTED", "SCREENING", "INTERVIEW", "OFFER", "HIRED", "REJECTED", "WITHDRAWN",
    ]);
    expect(out[0]).toEqual({ status: "SUBMITTED", label: "Đã nộp", count: 5 });
    expect(out.find((o) => o.status === "SCREENING")!.count).toBe(0);
    expect(out.find((o) => o.status === "HIRED")!.count).toBe(3);
  });
});
```

- [ ] **Step 5: Bỏ test đã chuyển khỏi `lib/admin/__tests__/stats-shape.test.ts`**

Sửa dòng import: `import { shapeRoleCounts, summarizeSalaries } from "../stats-shape";` (bỏ `shapeStatusDistribution`). Xoá nguyên khối `describe("shapeStatusDistribution", () => {...})`. Giữ 2 khối còn lại.

- [ ] **Step 6: Chạy test tổng để xác nhận xanh**

Run: `npm test`
Expected: toàn bộ PASS (số test không đổi — chỉ đổi chỗ).

- [ ] **Step 7: Verify type**

Run: `npx tsc --noEmit`
Expected: exit 0, không lỗi.

- [ ] **Step 8: Commit**

```bash
git add lib/applications/status.ts lib/admin/stats-shape.ts lib/admin/stats.ts lib/applications/__tests__/status.test.ts lib/admin/__tests__/stats-shape.test.ts
git commit -m "refactor(stats): move shapeStatusDistribution to applications/status"
```

---

### Task 2: Hàm thuần `lib/dashboard/shape.ts`

**Files:**
- Create: `lib/dashboard/shape.ts`
- Test: `lib/dashboard/__tests__/shape.test.ts`

**Interfaces:**
- Consumes: `STATUS_LABELS` từ `@/lib/applications/status`.
- Produces:
  - `computeConversion(statusCounts: {status: string; count: number}[]): {total: number; hiredRate: number; interviewRate: number}` (tỉ lệ 0–1).
  - `formatActivity(event: {toStatus: string; jobTitle: string}): string`.

- [ ] **Step 1: Viết test thất bại**

Tạo `lib/dashboard/__tests__/shape.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeConversion, formatActivity } from "../shape";

describe("computeConversion", () => {
  it("tính hiredRate và interviewRate", () => {
    const r = computeConversion([
      { status: "SUBMITTED", count: 4 },
      { status: "INTERVIEW", count: 2 },
      { status: "OFFER", count: 1 },
      { status: "HIRED", count: 3 },
    ]);
    expect(r.total).toBe(10);
    expect(r.hiredRate).toBeCloseTo(0.3);
    expect(r.interviewRate).toBeCloseTo(0.6); // (2+1+3)/10
  });
  it("total = 0 -> tỉ lệ 0, không chia 0", () => {
    expect(computeConversion([])).toEqual({ total: 0, hiredRate: 0, interviewRate: 0 });
  });
  it("chỉ INTERVIEW -> interviewRate>0, hiredRate=0", () => {
    const r = computeConversion([{ status: "INTERVIEW", count: 5 }]);
    expect(r.hiredRate).toBe(0);
    expect(r.interviewRate).toBe(1);
  });
});

describe("formatActivity", () => {
  it("dựng chuỗi với nhãn tiếng Việt", () => {
    expect(formatActivity({ toStatus: "INTERVIEW", jobTitle: "Frontend" })).toBe(
      'Đơn "Frontend" chuyển sang Phỏng vấn',
    );
    expect(formatActivity({ toStatus: "HIRED", jobTitle: "Backend" })).toBe(
      'Đơn "Backend" chuyển sang Nhận',
    );
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm test -- dashboard/__tests__/shape`
Expected: FAIL — "Failed to resolve import ../shape".

- [ ] **Step 3: Viết `lib/dashboard/shape.ts`**

```ts
import { STATUS_LABELS } from "@/lib/applications/status";

export function computeConversion(
  statusCounts: { status: string; count: number }[],
): { total: number; hiredRate: number; interviewRate: number } {
  const total = statusCounts.reduce((a, c) => a + c.count, 0);
  if (total === 0) return { total: 0, hiredRate: 0, interviewRate: 0 };
  const get = (s: string) => statusCounts.find((c) => c.status === s)?.count ?? 0;
  const interviewPlus = get("INTERVIEW") + get("OFFER") + get("HIRED");
  return { total, hiredRate: get("HIRED") / total, interviewRate: interviewPlus / total };
}

export function formatActivity(event: { toStatus: string; jobTitle: string }): string {
  const label =
    STATUS_LABELS[event.toStatus as keyof typeof STATUS_LABELS] ?? event.toStatus;
  return `Đơn "${event.jobTitle}" chuyển sang ${label}`;
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- dashboard/__tests__/shape`
Expected: PASS toàn bộ.

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/shape.ts lib/dashboard/__tests__/shape.test.ts
git commit -m "feat(dashboard): pure conversion + activity helpers"
```

---

### Task 3: Lớp truy vấn `recruiter-stats.ts` + `candidate-stats.ts`

**Files:**
- Create: `lib/dashboard/recruiter-stats.ts`
- Create: `lib/dashboard/candidate-stats.ts`

**Interfaces:**
- Consumes: `prisma`.
- Produces:
  - `getRecruiterStats(userId: string): Promise<{ openJobs, totalApplicants, newApplicants, statusCounts: {status,count}[], avgScore: number|null }>`
  - `getCandidateStats(userId: string): Promise<{ cvCount, savedCount, totalApplications, statusCounts: {status,count}[], avgScore: number|null, recentEvents: {id: string; toStatus: string; jobTitle: string}[] }>`

- [ ] **Step 1: Viết `lib/dashboard/recruiter-stats.ts`**

```ts
import prisma from "@/lib/db/prisma";

export async function getRecruiterStats(userId: string) {
  const [openJobs, totalApplicants, newApplicants, statusGroups, evalAgg] = await Promise.all([
    prisma.jobDescription.count({ where: { userId, isPublic: true } }),
    prisma.application.count({ where: { job: { userId } } }),
    prisma.application.count({ where: { job: { userId }, status: "SUBMITTED" } }),
    prisma.application.groupBy({
      by: ["status"],
      where: { job: { userId } },
      _count: { _all: true },
    }),
    prisma.evaluation.aggregate({
      where: { application: { job: { userId } } },
      _avg: { overallScore: true },
      _count: { _all: true },
    }),
  ]);

  return {
    openJobs,
    totalApplicants,
    newApplicants,
    statusCounts: statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
    avgScore:
      evalAgg._count._all === 0 || evalAgg._avg.overallScore == null
        ? null
        : Math.round(evalAgg._avg.overallScore),
  };
}
```

- [ ] **Step 2: Viết `lib/dashboard/candidate-stats.ts`**

```ts
import prisma from "@/lib/db/prisma";

export async function getCandidateStats(userId: string) {
  const [cvCount, savedCount, totalApplications, statusGroups, evalAgg, events] = await Promise.all([
    prisma.cV.count({ where: { userId } }),
    prisma.savedJob.count({ where: { userId } }),
    prisma.application.count({ where: { candidateId: userId } }),
    prisma.application.groupBy({
      by: ["status"],
      where: { candidateId: userId },
      _count: { _all: true },
    }),
    prisma.evaluation.aggregate({
      where: { userId },
      _avg: { overallScore: true },
      _count: { _all: true },
    }),
    prisma.applicationEvent.findMany({
      where: { application: { candidateId: userId } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        toStatus: true,
        application: { select: { job: { select: { title: true } } } },
      },
    }),
  ]);

  return {
    cvCount,
    savedCount,
    totalApplications,
    statusCounts: statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
    avgScore:
      evalAgg._count._all === 0 || evalAgg._avg.overallScore == null
        ? null
        : Math.round(evalAgg._avg.overallScore),
    recentEvents: events.map((e) => ({
      id: e.id,
      toStatus: e.toStatus,
      jobTitle: e.application.job.title,
    })),
  };
}
```

- [ ] **Step 3: Verify type + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: không lỗi mới. (Prisma client đã có mọi model/field.)

- [ ] **Step 4: Commit**

```bash
git add lib/dashboard/recruiter-stats.ts lib/dashboard/candidate-stats.ts
git commit -m "feat(dashboard): recruiter and candidate stats queries"
```

---

### Task 4: `StatCard` dùng chung + `RecruiterStats` + gắn vào /dashboard

**Files:**
- Create: `components/StatCard.tsx`
- Create: `app/dashboard/RecruiterStats.tsx`
- Modify: `app/dashboard/page.tsx` (nhánh recruiter)

**Interfaces:**
- Consumes: `getRecruiterStats` (Task 3); `shapeStatusDistribution` (Task 1); `computeConversion` (Task 2).
- Produces: `StatCard({label, value})`; `RecruiterStats({userId})` server component.

- [ ] **Step 1: Viết `components/StatCard.tsx`**

```tsx
import { Card, CardContent } from "@/components/ui/card";

export default function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="border-slate-200">
      <CardContent className="py-4">
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Viết `app/dashboard/RecruiterStats.tsx`**

```tsx
import { getRecruiterStats } from "@/lib/dashboard/recruiter-stats";
import { shapeStatusDistribution } from "@/lib/applications/status";
import { computeConversion } from "@/lib/dashboard/shape";
import StatCard from "@/components/StatCard";

export default async function RecruiterStats({ userId }: { userId: string }) {
  const s = await getRecruiterStats(userId);
  const dist = shapeStatusDistribution(s.statusCounts);
  const conv = computeConversion(s.statusCounts);
  const maxStatus = Math.max(1, ...dist.map((d) => d.count));

  return (
    <section className="mb-8 flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Tin đang đăng" value={s.openJobs} />
        <StatCard label="Ứng viên đã nộp" value={s.totalApplicants} />
        <StatCard label="Đơn mới" value={s.newApplicants} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-500">Phễu theo trạng thái</h2>
        <div className="flex flex-col gap-2">
          {dist.map((d) => (
            <div key={d.status} className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-sm text-slate-600">{d.label}</div>
              <div className="h-4 flex-1 rounded bg-slate-100">
                <div className="h-4 rounded bg-blue-500" style={{ width: `${(d.count / maxStatus) * 100}%` }} />
              </div>
              <div className="w-10 shrink-0 text-right text-sm font-medium text-slate-700">{d.count}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Tỉ lệ nhận" value={`${Math.round(conv.hiredRate * 100)}%`} />
        <StatCard label="Tỉ lệ vào phỏng vấn" value={`${Math.round(conv.interviewRate * 100)}%`} />
        <StatCard label="Điểm AI trung bình" value={s.avgScore ?? "—"} />
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Gắn `RecruiterStats` vào `app/dashboard/page.tsx`**

Trong nhánh recruiter, thêm import ở đầu file:

```tsx
import RecruiterStats from "./RecruiterStats";
```

Trong JSX nhánh recruiter, NGAY SAU khối header `<div className="mb-6 flex items-center justify-between">...</div>` và TRƯỚC `<div className="flex flex-col gap-3">` (danh sách JD), thêm:

```tsx
          <RecruiterStats userId={session.user.id} />
```

- [ ] **Step 4: Verify type + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: không lỗi mới.

- [ ] **Step 5: Commit**

```bash
git add components/StatCard.tsx app/dashboard/RecruiterStats.tsx app/dashboard/page.tsx
git commit -m "feat(dashboard): recruiter stats strip on /dashboard"
```

---

### Task 5: `CandidateStats` + gắn vào /dashboard

**Files:**
- Create: `app/dashboard/CandidateStats.tsx`
- Modify: `app/dashboard/page.tsx` (nhánh candidate)

**Interfaces:**
- Consumes: `getCandidateStats` (Task 3); `shapeStatusDistribution` (Task 1); `formatActivity` (Task 2); `StatCard` (Task 4).

- [ ] **Step 1: Viết `app/dashboard/CandidateStats.tsx`**

```tsx
import { getCandidateStats } from "@/lib/dashboard/candidate-stats";
import { shapeStatusDistribution } from "@/lib/applications/status";
import { formatActivity } from "@/lib/dashboard/shape";
import StatCard from "@/components/StatCard";

export default async function CandidateStats({ userId }: { userId: string }) {
  const s = await getCandidateStats(userId);
  const dist = shapeStatusDistribution(s.statusCounts);
  const maxStatus = Math.max(1, ...dist.map((d) => d.count));

  return (
    <section className="mb-8 flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="CV" value={s.cvCount} />
        <StatCard label="Đơn đã nộp" value={s.totalApplications} />
        <StatCard label="Tin đã lưu" value={s.savedCount} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-500">Đơn theo trạng thái</h2>
        <div className="flex flex-col gap-2">
          {dist.map((d) => (
            <div key={d.status} className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-sm text-slate-600">{d.label}</div>
              <div className="h-4 flex-1 rounded bg-slate-100">
                <div className="h-4 rounded bg-blue-500" style={{ width: `${(d.count / maxStatus) * 100}%` }} />
              </div>
              <div className="w-10 shrink-0 text-right text-sm font-medium text-slate-700">{d.count}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Điểm AI trung bình" value={s.avgScore ?? "—"} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-500">Hoạt động gần đây</h2>
        <ul className="flex flex-col gap-1 text-sm text-slate-600">
          {s.recentEvents.length === 0 && <li className="text-slate-400">Chưa có hoạt động nào</li>}
          {s.recentEvents.map((e) => (
            <li key={e.id}>• {formatActivity(e)}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Gắn `CandidateStats` vào `app/dashboard/page.tsx`**

Thêm import ở đầu file:

```tsx
import CandidateStats from "./CandidateStats";
```

Trong nhánh candidate, NGAY SAU khối header `<div className="mb-6 flex items-center justify-between">...</div>` và TRƯỚC `<div className="flex flex-col gap-3">` (danh sách CV), thêm:

```tsx
          <CandidateStats userId={session.user.id} />
```

- [ ] **Step 3: Verify type + lint + test tổng**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: không lỗi type/lint mới; toàn bộ test PASS.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/CandidateStats.tsx app/dashboard/page.tsx
git commit -m "feat(dashboard): candidate stats strip on /dashboard"
```

---

## Self-Review

**Spec coverage:**
- §1 Vị trí & cấu trúc (component riêng, đầu /dashboard) → Task 4 (recruiter) + Task 5 (candidate). ✓
- §2 Lớp dữ liệu (recruiter/candidate-stats + shape thuần) → Task 3 + Task 2. ✓
- §3 Chuyển shapeStatusDistribution về status.ts + cập nhật admin + di chuyển test → Task 1. ✓
- §4 Nội dung NTD (đếm/phễu/tỉ lệ/điểm AI) → Task 4. ✓
- §5 Nội dung ứng viên (đếm/trạng thái/điểm AI/hoạt động) → Task 5. ✓
- §6 Test (shape.test, status.test bổ sung, admin test bớt) → Task 2 + Task 1. ✓

**Placeholder scan:** UI/DB task (3,4,5) không unit-test nhưng verify cụ thể (`tsc`+`lint`(+`test`)) — đúng pattern repo. Không có TODO/TBD.

**Type consistency:**
- `getRecruiterStats`/`getCandidateStats` trả `statusCounts: {status,count}[]` — khớp `shapeStatusDistribution` và `computeConversion`.
- `recentEvents: {id, toStatus, jobTitle}[]` — khớp `formatActivity({toStatus, jobTitle})` (component truyền cả object, thừa `id` không sao).
- `avgScore: number|null` — UI dùng `?? "—"`.
- `StatCard({label, value: number|string})` — mọi chỗ dùng hợp lệ (kể cả chuỗi "%").
- `shapeStatusDistribution` sau khi chuyển: import từ `@/lib/applications/status` ở admin/stats.ts, RecruiterStats, CandidateStats — nhất quán.
