# Onboarding "Bắt đầu" trên dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm thẻ "Bắt đầu" trên dashboard: checklist mốc hành động cho user mới (theo role), có trạng thái xong/chưa + link, tự ẩn khi hoàn tất.

**Architecture:** Hàm thuần `computeOnboarding(role, signals)` (test bằng vitest) trả các bước + tiến độ. Server component `OnboardingCard` render trong 2 nhánh dashboard; tín hiệu lấy từ dữ liệu dashboard sẵn có + 1 query đếm đơn (candidate).

**Tech Stack:** Next.js 16 (App Router, Server Components), Prisma 6, lucide-react, vitest 4, TypeScript.

## Global Constraints

- Không thêm dependency/env/DB (dùng dữ liệu sẵn có + 1 `count`). Logic thuần không import prisma.
- KHÔNG trùng `profileCompleteness` / `VerifyEmailBanner` (không thêm bước email).
- Thẻ tự ẩn khi `allDone` (không có nút "bỏ qua" — YAGNI, tránh schema).
- Copy tiếng Việt. Chỉ hiển thị đúng role (dashboard đã rẽ theo role).
- Kết thúc: `npx tsc --noEmit` 0, `npm run lint` 0 error (2 warning tồn đọng chấp nhận), `npm test` xanh, `npm run build` PASS.
- Commit tiếng Việt, prefix `feat(ux):` / `test(ux):`.

---

### Task 1: `computeOnboarding` (pure logic)

**Files:**
- Create: `lib/dashboard/onboarding.ts`
- Test: `lib/dashboard/__tests__/onboarding.test.ts`

**Interfaces:**
- Produces:
  - `type OnboardingSignals = { hasCV: boolean; hasBio: boolean; hasApplication: boolean; hasCompany: boolean; hasJob: boolean }`
  - `type OnboardingStep = { key: string; label: string; href: string; done: boolean }`
  - `type Onboarding = { steps: OnboardingStep[]; completed: number; total: number; allDone: boolean }`
  - `computeOnboarding(role: "CANDIDATE" | "RECRUITER", signals: OnboardingSignals): Onboarding`

- [ ] **Step 1: Viết test thất bại**

Tạo `lib/dashboard/__tests__/onboarding.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeOnboarding, type OnboardingSignals } from "../onboarding";

const NONE: OnboardingSignals = {
  hasCV: false, hasBio: false, hasApplication: false, hasCompany: false, hasJob: false,
};

describe("computeOnboarding", () => {
  it("CANDIDATE: 3 bước, done khớp signals", () => {
    const r = computeOnboarding("CANDIDATE", { ...NONE, hasCV: true, hasBio: true });
    expect(r.total).toBe(3);
    expect(r.steps.map((s) => s.key)).toEqual(["cv", "bio", "apply"]);
    expect(r.steps.map((s) => s.done)).toEqual([true, true, false]);
    expect(r.completed).toBe(2);
    expect(r.allDone).toBe(false);
  });

  it("CANDIDATE: đủ 3 -> allDone", () => {
    const r = computeOnboarding("CANDIDATE", { ...NONE, hasCV: true, hasBio: true, hasApplication: true });
    expect(r.completed).toBe(3);
    expect(r.allDone).toBe(true);
  });

  it("RECRUITER: 2 bước, không lẫn bước candidate", () => {
    const r = computeOnboarding("RECRUITER", { ...NONE, hasCompany: true });
    expect(r.total).toBe(2);
    expect(r.steps.map((s) => s.key)).toEqual(["company", "job"]);
    expect(r.completed).toBe(1);
    expect(r.allDone).toBe(false);
  });

  it("RECRUITER: đủ 2 -> allDone", () => {
    const r = computeOnboarding("RECRUITER", { ...NONE, hasCompany: true, hasJob: true });
    expect(r.allDone).toBe(true);
  });

  it("mỗi bước có href + label", () => {
    const r = computeOnboarding("CANDIDATE", NONE);
    expect(r.steps[0]).toMatchObject({ key: "cv", label: "Tạo CV", href: "/dashboard" });
  });
});
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `npx vitest run lib/dashboard/__tests__/onboarding.test.ts`
Expected: FAIL ("Cannot find module '../onboarding'").

- [ ] **Step 3: Viết implementation**

Tạo `lib/dashboard/onboarding.ts`:

```ts
export type OnboardingSignals = {
  hasCV: boolean;
  hasBio: boolean;
  hasApplication: boolean;
  hasCompany: boolean;
  hasJob: boolean;
};

export type OnboardingStep = { key: string; label: string; href: string; done: boolean };
export type Onboarding = {
  steps: OnboardingStep[];
  completed: number;
  total: number;
  allDone: boolean;
};

type StepDef = { key: string; label: string; href: string; signal: keyof OnboardingSignals };

const CANDIDATE_STEPS: StepDef[] = [
  { key: "cv", label: "Tạo CV", href: "/dashboard", signal: "hasCV" },
  { key: "bio", label: "Điền giới thiệu hồ sơ", href: "/settings/profile", signal: "hasBio" },
  { key: "apply", label: "Ứng tuyển tin đầu tiên", href: "/jobs", signal: "hasApplication" },
];

const RECRUITER_STEPS: StepDef[] = [
  { key: "company", label: "Tạo hồ sơ công ty", href: "/company/edit", signal: "hasCompany" },
  { key: "job", label: "Đăng tin tuyển dụng đầu tiên", href: "/jobs/new", signal: "hasJob" },
];

export function computeOnboarding(
  role: "CANDIDATE" | "RECRUITER",
  signals: OnboardingSignals,
): Onboarding {
  const defs = role === "RECRUITER" ? RECRUITER_STEPS : CANDIDATE_STEPS;
  const steps: OnboardingStep[] = defs.map((d) => ({
    key: d.key,
    label: d.label,
    href: d.href,
    done: signals[d.signal],
  }));
  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  return { steps, completed, total, allDone: completed === total };
}
```

- [ ] **Step 4: Chạy test — phải PASS**

Run: `npx vitest run lib/dashboard/__tests__/onboarding.test.ts`
Expected: PASS (5 test).

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/onboarding.ts lib/dashboard/__tests__/onboarding.test.ts
git commit -m "feat(ux): computeOnboarding (checklist bắt đầu theo role)"
```

---

### Task 2: `OnboardingCard` + wiring dashboard

**Files:**
- Create: `components/dashboard/OnboardingCard.tsx`
- Modify: `app/dashboard/page.tsx` (cả 2 nhánh + 1 query đếm đơn candidate)

**Interfaces:**
- Consumes: `computeOnboarding`/`Onboarding` (Task 1), `isEmailVerified` (đã import sẵn ở page), `prisma`.
- Produces: component `OnboardingCard`.

- [ ] **Step 1: Component `OnboardingCard`**

Tạo `components/dashboard/OnboardingCard.tsx`:

```tsx
import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import type { Onboarding } from "@/lib/dashboard/onboarding";

export default function OnboardingCard({ onboarding }: { onboarding: Onboarding }) {
  if (onboarding.allDone) return null;

  return (
    <section className="mb-6 rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Bắt đầu</h2>
        <span className="text-xs text-muted-foreground">
          {onboarding.completed}/{onboarding.total} bước
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {onboarding.steps.map((step) => (
          <li key={step.key} className="flex items-center gap-2 text-sm">
            {step.done ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            {step.done ? (
              <span className="text-muted-foreground line-through">{step.label}</span>
            ) : (
              <Link href={step.href} className="flex items-center gap-1 text-foreground hover:text-primary">
                {step.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

> Kiểm `lucide-react` có `CheckCircle2`, `Circle`, `ArrowRight` (đều là icon phổ biến, đã dùng trong repo). Nếu thiếu icon nào, thay bằng icon tương đương sẵn có.

- [ ] **Step 2: Wire vào nhánh RECRUITER**

Trong `app/dashboard/page.tsx`, nhánh recruiter: `jobs` và `companyProfile` đã có sẵn. Thêm import ở đầu file:
```ts
import { computeOnboarding } from "@/lib/dashboard/onboarding";
import OnboardingCard from "@/components/dashboard/OnboardingCard";
```

Ngay SAU dòng `{!isEmailVerified(me) && <VerifyEmailBanner />}` trong nhánh recruiter (dòng ~48), thêm:
```tsx
          <OnboardingCard
            onboarding={computeOnboarding("RECRUITER", {
              hasCV: false,
              hasBio: false,
              hasApplication: false,
              hasCompany: !!companyProfile,
              hasJob: jobs.length > 0,
            })}
          />
```

- [ ] **Step 3: Wire vào nhánh CANDIDATE**

Trong nhánh candidate, sau khi có `cvCount` và `candidateProfile` (khối `const completeness = ...`), thêm query đếm đơn:
```ts
  const appCount = await prisma.application.count({ where: { candidateId: session.user.id } });
```

Ngay SAU dòng `{!isEmailVerified(me) && <VerifyEmailBanner />}` trong nhánh candidate (dòng ~131), thêm:
```tsx
        <OnboardingCard
          onboarding={computeOnboarding("CANDIDATE", {
            hasCV: cvCount > 0,
            hasBio: !!candidateProfile?.bio?.trim(),
            hasApplication: appCount > 0,
            hasCompany: false,
            hasJob: false,
          })}
        />
```

> READ `app/dashboard/page.tsx` để đặt đúng chỗ 2 khối render (ngay dưới `VerifyEmailBanner` của từng nhánh) và query `appCount` (cùng khu nạp dữ liệu candidate, trước phần `return`).

- [ ] **Step 4: Kiểm tra tổng thể**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: tsc 0; lint 0 error (2 warning tồn đọng chấp nhận); toàn bộ test xanh; build PASS; `/dashboard` build được.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/OnboardingCard.tsx app/dashboard/page.tsx
git commit -m "feat(ux): thẻ Bắt đầu (onboarding) trên dashboard 2 nhánh"
```

---

## Việc người dùng phải tự làm sau khi merge
Không có (dùng dữ liệu sẵn có). Kiểm tay: tài khoản mới (chưa CV/công ty/tin) → dashboard thấy thẻ
"Bắt đầu"; làm xong các bước → thẻ tự ẩn.

## Để dành vòng sau
Nút "bỏ qua" lưu DB; onboarding admin; tour tooltip; thêm bước xác minh email.
