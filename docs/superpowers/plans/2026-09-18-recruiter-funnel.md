# Funnel ứng tuyển cho recruiter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm khối "Funnel ứng tuyển" trên dashboard recruiter: số đơn đạt tới từng bước (Nộp→Sàng lọc→Phỏng vấn→Offer→Nhận) + tỷ lệ chuyển đổi giữa các bước, tính từ lịch sử `ApplicationEvent`.

**Architecture:** Hàm thuần `computeFunnel(apps, events)` (dùng `maxReached` theo index bước, xử lý cả nhảy bước) — test bằng vitest. Accessor `getRecruiterFunnel` nạp dữ liệu Prisma. Server component `RecruiterFunnel` render trong dashboard cạnh `RecruiterAnalytics` sẵn có.

**Tech Stack:** Next.js 16 (App Router, Server Components), Prisma 6, vitest 4, TypeScript.

## Global Constraints

- Không thêm dependency/env/DB (dùng `Application` + `ApplicationEvent` sẵn có).
- Logic thuần (`computeFunnel`) không import prisma — test bằng fake data.
- Nhãn bước lấy từ `STATUS_LABELS` (`@/lib/applications/status`): SUBMITTED="Đã nộp", SCREENING="Đang sàng lọc", INTERVIEW="Phỏng vấn", OFFER="Offer", HIRED="Nhận".
- Copy tiếng Việt. Chỉ recruiter thấy (dashboard đã rẽ theo role).
- Kết thúc: `npx tsc --noEmit` 0, `npm run lint` 0 error (2 warning tồn đọng chấp nhận), `npm test` xanh, `npm run build` PASS.
- Commit tiếng Việt, prefix `feat(analytics):` / `test(analytics):`.

---

### Task 1: `computeFunnel` (pure logic)

**Files:**
- Create: `lib/dashboard/recruiter-funnel.ts`
- Test: `lib/dashboard/__tests__/recruiter-funnel.test.ts`

**Interfaces:**
- Consumes: `STATUS_LABELS` (`@/lib/applications/status`).
- Produces:
  - `FUNNEL_STAGES = ["SUBMITTED","SCREENING","INTERVIEW","OFFER","HIRED"] as const`; `type FunnelStage`.
  - `type FunnelRow = { stage: FunnelStage; label: string; count: number; pctOfTotal: number; conversionFromPrev: number | null }`
  - `type FunnelResult = { total: number; rows: FunnelRow[] }`
  - `computeFunnel(apps: { id: string }[], events: { applicationId: string; toStatus: string }[]): FunnelResult`

- [ ] **Step 1: Viết test thất bại**

Tạo `lib/dashboard/__tests__/recruiter-funnel.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeFunnel } from "../recruiter-funnel";

// helper: dựng events cho 1 app theo chuỗi toStatus
function ev(appId: string, ...statuses: string[]) {
  return statuses.map((toStatus) => ({ applicationId: appId, toStatus }));
}

describe("computeFunnel", () => {
  it("đếm reached theo bước cao nhất mỗi đơn", () => {
    const apps = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const events = [
      ...ev("a", "SUBMITTED", "SCREENING", "INTERVIEW"),
      ...ev("b", "SUBMITTED", "SCREENING"),
      ...ev("c", "SUBMITTED"),
    ];
    const r = computeFunnel(apps, events);
    expect(r.total).toBe(3);
    const counts = r.rows.map((x) => x.count);
    expect(counts).toEqual([3, 2, 1, 0, 0]); // SUBMITTED, SCREENING, INTERVIEW, OFFER, HIRED
  });

  it("nhảy bước: chạm OFFER tính luôn các bước giữa", () => {
    const apps = [{ id: "a" }];
    const events = ev("a", "SUBMITTED", "OFFER");
    const r = computeFunnel(apps, events);
    expect(r.rows.map((x) => x.count)).toEqual([1, 1, 1, 1, 0]);
  });

  it("tỷ lệ chuyển đổi từ bước trước; bước đầu null", () => {
    const apps = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const events = [
      ...ev("a", "SUBMITTED", "SCREENING"),
      ...ev("b", "SUBMITTED", "SCREENING"),
      ...ev("c", "SUBMITTED"),
      ...ev("d", "SUBMITTED"),
    ];
    const r = computeFunnel(apps, events);
    expect(r.rows[0].conversionFromPrev).toBeNull();
    expect(r.rows[1].conversionFromPrev).toBe(0.5); // 2/4 reached SCREENING
    expect(r.rows[0].pctOfTotal).toBe(1);
  });

  it("đơn REJECTED giữ trong funnel tới bước đã chạm", () => {
    const apps = [{ id: "a" }];
    const events = ev("a", "SUBMITTED", "SCREENING", "REJECTED");
    const r = computeFunnel(apps, events);
    expect(r.rows.map((x) => x.count)).toEqual([1, 1, 0, 0, 0]); // REJECTED không phải bước funnel
  });

  it("rỗng: total 0, count 0, không lỗi chia 0", () => {
    const r = computeFunnel([], []);
    expect(r.total).toBe(0);
    expect(r.rows.every((x) => x.count === 0 && x.pctOfTotal === 0)).toBe(true);
    expect(r.rows[0].conversionFromPrev).toBeNull();
    expect(r.rows[1].conversionFromPrev).toBe(0); // reached[0]=0 -> 0, không NaN
  });
});
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `npx vitest run lib/dashboard/__tests__/recruiter-funnel.test.ts`
Expected: FAIL ("Cannot find module '../recruiter-funnel'").

- [ ] **Step 3: Viết implementation**

Tạo `lib/dashboard/recruiter-funnel.ts`:

```ts
import { STATUS_LABELS } from "@/lib/applications/status";

export const FUNNEL_STAGES = ["SUBMITTED", "SCREENING", "INTERVIEW", "OFFER", "HIRED"] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export type FunnelRow = {
  stage: FunnelStage;
  label: string;
  count: number;
  pctOfTotal: number;
  conversionFromPrev: number | null;
};
export type FunnelResult = { total: number; rows: FunnelRow[] };

const STAGE_INDEX: Record<string, number> = Object.fromEntries(
  FUNNEL_STAGES.map((s, i) => [s, i]),
);

export function computeFunnel(
  apps: { id: string }[],
  events: { applicationId: string; toStatus: string }[],
): FunnelResult {
  // maxReached: bước cao nhất mỗi đơn (baseline 0 = SUBMITTED cho mọi đơn).
  const maxReached = new Map<string, number>();
  for (const a of apps) maxReached.set(a.id, 0);
  for (const e of events) {
    if (!maxReached.has(e.applicationId)) continue;
    const idx = STAGE_INDEX[e.toStatus];
    if (idx === undefined) continue; // REJECTED/WITHDRAWN: không phải bước funnel
    if (idx > maxReached.get(e.applicationId)!) maxReached.set(e.applicationId, idx);
  }

  const total = apps.length;
  const reached = FUNNEL_STAGES.map((_, k) => {
    let c = 0;
    for (const v of maxReached.values()) if (v >= k) c++;
    return c;
  });

  const rows: FunnelRow[] = FUNNEL_STAGES.map((stage, k) => ({
    stage,
    label: STATUS_LABELS[stage],
    count: reached[k],
    pctOfTotal: total > 0 ? reached[k] / total : 0,
    conversionFromPrev: k === 0 ? null : reached[k - 1] > 0 ? reached[k] / reached[k - 1] : 0,
  }));

  return { total, rows };
}
```

- [ ] **Step 4: Chạy test — phải PASS**

Run: `npx vitest run lib/dashboard/__tests__/recruiter-funnel.test.ts`
Expected: PASS (5 test).

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/recruiter-funnel.ts lib/dashboard/__tests__/recruiter-funnel.test.ts
git commit -m "feat(analytics): computeFunnel (đếm reached theo bước + tỷ lệ chuyển đổi)"
```

---

### Task 2: Accessor (file riêng) + component + render dashboard

**Files:**
- Create: `lib/dashboard/recruiter-funnel-data.ts` (`getRecruiterFunnel`, import prisma)
- Create: `components/dashboard/RecruiterFunnel.tsx`
- Modify: `app/dashboard/page.tsx` (render trong nhánh recruiter)

**Interfaces:**
- Consumes: `computeFunnel`/`FunnelResult` (Task 1), `prisma`, `EmptyState`.
- Produces: `getRecruiterFunnel(recruiterId: string): Promise<FunnelResult>`; component `RecruiterFunnel`.

- [ ] **Step 1: Tạo accessor ở FILE RIÊNG (giữ `recruiter-funnel.ts` thuần, không prisma)**

Tạo `lib/dashboard/recruiter-funnel-data.ts` (mirror cặp `insights.ts`/`insights-data.ts` — file thuần không đụng prisma để test không import prisma gián tiếp):

```ts
import prisma from "@/lib/db/prisma";
import { computeFunnel, type FunnelResult } from "./recruiter-funnel";

export async function getRecruiterFunnel(recruiterId: string): Promise<FunnelResult> {
  const [apps, events] = await Promise.all([
    prisma.application.findMany({
      where: { job: { userId: recruiterId } },
      select: { id: true },
    }),
    prisma.applicationEvent.findMany({
      where: { application: { job: { userId: recruiterId } } },
      select: { applicationId: true, toStatus: true },
    }),
  ]);
  return computeFunnel(apps, events);
}
```

> KHÔNG thêm import prisma vào `recruiter-funnel.ts` — file đó phải thuần để test `computeFunnel` không kéo theo prisma.

- [ ] **Step 2: Component `RecruiterFunnel`**

Tạo `components/dashboard/RecruiterFunnel.tsx`:

```tsx
import { getRecruiterFunnel } from "@/lib/dashboard/recruiter-funnel-data";
import { EmptyState } from "@/components/ui/empty-state";
import { Filter } from "lucide-react";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export default async function RecruiterFunnel({ userId }: { userId: string }) {
  const funnel = await getRecruiterFunnel(userId);

  if (funnel.total === 0) {
    return (
      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-foreground">Funnel ứng tuyển</h2>
        <EmptyState
          icon={<Filter className="h-8 w-8" />}
          title="Chưa có đơn ứng tuyển"
          description="Khi có đơn ứng tuyển, bạn sẽ thấy tỷ lệ chuyển đổi qua từng bước."
        />
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-base font-semibold text-foreground">Funnel ứng tuyển</h2>
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-4">
        {funnel.rows.map((row) => (
          <div key={row.stage}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-foreground">{row.label}</span>
              <span className="text-muted-foreground">
                {row.count} · {pct(row.pctOfTotal)}
                {row.conversionFromPrev !== null && (
                  <span className="ml-2 text-xs">(chuyển đổi {pct(row.conversionFromPrev)})</span>
                )}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: pct(row.pctOfTotal) }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

> Kiểm `components/ui/empty-state` export `EmptyState` (đã dùng ở `RecruiterAnalytics`). Icon `Filter` từ `lucide-react` (nếu không có, dùng `BarChart3` như `RecruiterAnalytics`).

- [ ] **Step 3: Render trong dashboard (nhánh recruiter)**

Trong `app/dashboard/page.tsx`:
- Thêm import (cạnh import `RecruiterAnalytics`):
```ts
import RecruiterFunnel from "@/components/dashboard/RecruiterFunnel";
```
- Ngay SAU khối `<Suspense>...<RecruiterAnalytics userId={session.user.id} /></Suspense>` (dòng ~62-64), thêm:
```tsx
          <Suspense fallback={<div className="mb-6 h-48 animate-pulse rounded-xl bg-muted" />}>
            <RecruiterFunnel userId={session.user.id} />
          </Suspense>
```

- [ ] **Step 4: Kiểm tra tổng thể**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: tsc 0; lint 0 error (2 warning tồn đọng chấp nhận); toàn bộ test xanh; build PASS; `/dashboard` build được.

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/recruiter-funnel-data.ts components/dashboard/RecruiterFunnel.tsx app/dashboard/page.tsx
git commit -m "feat(analytics): getRecruiterFunnel + khối Funnel ứng tuyển trên dashboard"
```

---

## Việc người dùng phải tự làm sau khi merge
Không có (dùng dữ liệu sẵn có). Kiểm tay: đăng nhập recruiter có đơn ứng tuyển → dashboard → khối
"Funnel ứng tuyển" hiển thị số & % chuyển đổi từng bước.

## Để dành vòng sau
Xu hướng theo thời gian; funnel theo từng tin; trang `/dashboard/analytics` riêng; export CSV.
