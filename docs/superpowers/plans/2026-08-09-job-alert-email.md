# Email cho Job Alert — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gửi email (qua Resend REST, degrade mềm) cho ứng viên đã bật email khi có tin công khai mới khớp alert — song song thông báo in-app đã có.

**Architecture:** Builder nội dung thuần `buildJobAlertEmail` (TDD). Transport `send.ts` đọc env, chưa cấu hình thì bỏ qua êm. Thêm `JobAlert.emailEnabled`. Mở rộng `notifyMatchingAlerts` gom 2 tập (in-app / email) rồi gửi email cho tập opt-in. Công tắc "Gửi email" mỗi alert ở `/jobs/alerts`.

**Tech Stack:** Next.js 16, React 19, Prisma 6 (Neon), Vitest, Resend REST via `fetch`.

## Global Constraints

- Prisma **pinned v6**; thay đổi schema DUY NHẤT là thêm cột `emailEnabled Boolean @default(true)` trên `model JobAlert`; đồng bộ bằng `npm run db:push` (không migration tay).
- **KHÔNG thêm dependency** — gọi Resend bằng `fetch` toàn cục.
- Email **degrade mềm**: thiếu `RESEND_API_KEY`/`EMAIL_FROM` → bỏ qua gửi (không lỗi); lỗi gửi → nuốt; **không bao giờ** cản đăng tin (giữ `try/catch` bao ngoài trong `notifyMatchingAlerts`).
- Vitest: unit-test **logic thuần** (`job-alert-email.ts`); `send.ts`/`isEmailConfigured`/`notifyMatchingAlerts`/route/action/UI KHÔNG unit-test.
- Tái dùng: `notifyMatchingAlerts`/`matchesAlert` (`lib/jobs/alerts`), `formatSalary` (`lib/jobs/salary`), `createNotification` (`lib/notifications/create`).
- `className` **nháy thẳng ASCII**; nội dung tiếng Việt; **SmartHire**.
- Không đổi AI, auth, realtime, phân quyền, `CvInput`, luồng in-app hiện có.
- Windows: `npm test`, `npm run lint`, `npm run build`, `npm run db:push`.

## File Structure

**Tạo mới:**
- `lib/email/job-alert-email.ts` + `lib/email/__tests__/job-alert-email.test.ts` — builder nội dung thuần.
- `lib/email/send.ts` — `isEmailConfigured` + `sendEmail` (Resend REST).
- `components/jobs/AlertEmailToggle.tsx` — công tắc client.

**Sửa:**
- `prisma/schema.prisma` (`emailEnabled` trên `JobAlert`)
- `lib/jobs/alert-notify.ts` (2 tập recipient + gửi email)
- `lib/jobs/alert-actions.ts` (thêm `setAlertEmail`)
- `app/jobs/alerts/page.tsx` (công tắc email mỗi dòng)
- `.env.example` (3 biến)

---

### Task 1: Builder nội dung email thuần (TDD)

**Files:**
- Create: `lib/email/job-alert-email.ts`, `lib/email/__tests__/job-alert-email.test.ts`

**Interfaces:**
- Consumes: `formatSalary` (`@/lib/jobs/salary`).
- Produces: `buildJobAlertEmail(job: { id: string; title: string; company: string; location: string | null; salaryMin: number | null; salaryMax: number | null }, appUrl: string): { subject: string; html: string }`.

- [ ] **Step 1: Viết test thất bại**

`lib/email/__tests__/job-alert-email.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildJobAlertEmail } from "../job-alert-email";

const base = {
  id: "job123",
  title: "Lập trình viên React",
  company: "FPT Software",
  location: "Hà Nội" as string | null,
  salaryMin: 20_000_000 as number | null,
  salaryMax: 30_000_000 as number | null,
};

describe("buildJobAlertEmail", () => {
  it("subject chứa tiêu đề (text thuần)", () => {
    const { subject } = buildJobAlertEmail(base, "https://smarthire.vn");
    expect(subject).toBe("Việc làm mới khớp thông báo: Lập trình viên React");
  });
  it("html chứa công ty và link tuyệt đối", () => {
    const { html } = buildJobAlertEmail(base, "https://smarthire.vn");
    expect(html).toContain("FPT Software");
    expect(html).toContain('href="https://smarthire.vn/jobs/job123"');
  });
  it("có dòng lương khi truyền salary, không có khi null", () => {
    expect(buildJobAlertEmail(base, "https://x").html).toContain("Mức lương");
    const noSalary = { ...base, salaryMin: null, salaryMax: null };
    expect(buildJobAlertEmail(noSalary, "https://x").html).not.toContain("Mức lương");
  });
  it("có địa điểm khi truyền, không có khi null", () => {
    expect(buildJobAlertEmail(base, "https://x").html).toContain("Hà Nội");
    const noLoc = { ...base, location: null };
    expect(buildJobAlertEmail(noLoc, "https://x").html).not.toContain("Địa điểm");
  });
  it("escape ký tự HTML trong tiêu đề/công ty", () => {
    const evil = { ...base, title: "Dev <script>", company: "A & B" };
    const { html } = buildJobAlertEmail(evil, "https://x");
    expect(html).toContain("Dev &lt;script&gt;");
    expect(html).toContain("A &amp; B");
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn fail**

Run: `npm test -- job-alert-email`
Expected: FAIL ("Cannot find module '../job-alert-email'").

- [ ] **Step 3: Cài đặt `lib/email/job-alert-email.ts`**

```ts
import { formatSalary } from "@/lib/jobs/salary";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildJobAlertEmail(
  job: {
    id: string;
    title: string;
    company: string;
    location: string | null;
    salaryMin: number | null;
    salaryMax: number | null;
  },
  appUrl: string,
): { subject: string; html: string } {
  const subject = "Việc làm mới khớp thông báo: " + job.title;
  const salary = formatSalary(job.salaryMin, job.salaryMax, false);
  const url = appUrl + "/jobs/" + job.id;

  const lines: string[] = [];
  lines.push(`<h2>${esc(job.title)}</h2>`);
  lines.push(`<p>${esc(job.company)}</p>`);
  if (job.location) lines.push(`<p>Địa điểm: ${esc(job.location)}</p>`);
  if (salary) lines.push(`<p>Mức lương: ${esc(salary)}</p>`);
  lines.push(`<p><a href="${url}">Xem chi tiết</a></p>`);
  lines.push(
    `<p style="color:#888;font-size:12px">Bạn nhận email này vì đã bật thông báo việc làm trên SmartHire.</p>`,
  );

  return { subject, html: lines.join("\n") };
}
```

- [ ] **Step 4: Chạy test để chắc chắn pass**

Run: `npm test -- job-alert-email`
Expected: PASS (5 test).

- [ ] **Step 5: Commit**

```bash
git add lib/email/job-alert-email.ts lib/email/__tests__/job-alert-email.test.ts
git commit -m "feat(email): pure job-alert email content builder"
```

---

### Task 2: Transport email `send.ts` + `.env.example`

**Files:**
- Create: `lib/email/send.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces:
  - `isEmailConfigured(): boolean`
  - `sendEmail(msg: { to: string; subject: string; html: string }): Promise<{ ok: boolean; skipped?: boolean }>`

- [ ] **Step 1: Cài đặt `lib/email/send.ts`**

```ts
// Gửi email qua Resend REST (không thêm dependency). Chưa cấu hình -> bỏ qua êm.
export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

export async function sendEmail(msg: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; skipped?: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { ok: true, skipped: true };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: msg.to, subject: msg.subject, html: msg.html }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}
```

- [ ] **Step 2: Thêm 3 biến vào `.env.example`**

Nối vào cuối `.env.example`:

```
RESEND_API_KEY="re_... (lay tai resend.com; bo trong -> khong gui email, chi in-app)"
EMAIL_FROM="SmartHire <onboarding@resend.dev>"
APP_URL="http://localhost:3000"
```

- [ ] **Step 3: Verify lint + build**

Run: `npm run lint` rồi `npm run build`
Expected: thành công (không lỗi type; module chưa được ai import nên chỉ cần compile sạch).

- [ ] **Step 4: Commit**

```bash
git add lib/email/send.ts .env.example
git commit -m "feat(email): Resend REST transport (graceful degrade) + env example"
```

---

### Task 3: Cột `emailEnabled` + gửi email trong `notifyMatchingAlerts`

**Files:**
- Modify: `prisma/schema.prisma`, `lib/jobs/alert-notify.ts`

**Interfaces:**
- Consumes: `buildJobAlertEmail` (Task 1); `isEmailConfigured`/`sendEmail` (Task 2); `matchesAlert`/`AlertCriteria`/`MatchableJob` (`./alerts`); `createNotification`.
- Produces: `notifyMatchingAlerts(job: NotifyJob)` không đổi chữ ký (`NotifyJob = MatchableJob & { id; userId }`), thêm gửi email cho tập opt-in.

- [ ] **Step 1: Thêm cột vào Prisma**

Trong `prisma/schema.prisma`, `model JobAlert`, ngay SAU dòng `salaryMillions  Int?`, thêm:

```prisma
  emailEnabled    Boolean          @default(true)
```

- [ ] **Step 2: Đồng bộ DB**

Run: `npm run db:push`
Expected: "Your database is now in sync" (chỉ thêm cột có default, an toàn).

- [ ] **Step 3: Thay toàn bộ `lib/jobs/alert-notify.ts`**

```ts
import prisma from "@/lib/db/prisma";
import { createNotification } from "@/lib/notifications/create";
import { matchesAlert, type AlertCriteria, type MatchableJob } from "./alerts";
import type { EmploymentType, ExperienceLevel } from "./job-fields";
import type { JobCategory } from "./job-categories";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";
import { buildJobAlertEmail } from "@/lib/email/job-alert-email";

export type NotifyJob = MatchableJob & { id: string; userId: string };

// Khi tạo tin công khai mới: tìm mọi JobAlert khớp, tạo thông báo in-app cho
// các ứng viên (khử trùng theo user, loại người đăng); gửi thêm email cho ai
// bật email. Nuốt lỗi để không làm hỏng luồng đăng tin.
export async function notifyMatchingAlerts(job: NotifyJob): Promise<void> {
  try {
    const alerts = await prisma.jobAlert.findMany({
      select: {
        userId: true,
        term: true,
        category: true,
        employmentType: true,
        experienceLevel: true,
        salaryMillions: true,
        emailEnabled: true,
      },
    });

    const inAppRecipients = new Set<string>();
    const emailRecipients = new Set<string>();
    for (const a of alerts) {
      if (a.userId === job.userId) continue;
      const criteria: AlertCriteria = {
        term: a.term ?? undefined,
        category: (a.category as JobCategory | null) ?? undefined,
        employmentType: (a.employmentType as EmploymentType | null) ?? undefined,
        experienceLevel: (a.experienceLevel as ExperienceLevel | null) ?? undefined,
        salaryMillions: a.salaryMillions,
      };
      if (!matchesAlert(job, criteria)) continue;
      inAppRecipients.add(a.userId);
      if (a.emailEnabled) emailRecipients.add(a.userId);
    }

    const message = `Tin mới khớp thông báo của bạn: ${job.title} — ${job.company}`;
    const link = `/jobs/${job.id}`;
    await Promise.all(
      [...inAppRecipients].map((userId) => createNotification(userId, { message, link })),
    );

    if (isEmailConfigured() && emailRecipients.size > 0) {
      const appUrl = process.env.APP_URL || "http://localhost:3000";
      const users = await prisma.user.findMany({
        where: { id: { in: [...emailRecipients] } },
        select: { email: true },
      });
      const mail = buildJobAlertEmail(job, appUrl);
      await Promise.all(
        users.map((u) => sendEmail({ to: u.email, subject: mail.subject, html: mail.html })),
      );
    }
  } catch {
    // Bỏ qua: thông báo/email lỗi không được cản trở việc đăng tin.
  }
}
```

- [ ] **Step 4: Verify lint + build**

Run: `npm run lint` rồi `npm run build`
Expected: thành công. Prisma Client đã regenerate ở Step 2 nên `emailEnabled` có trong type.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma lib/jobs/alert-notify.ts
git commit -m "feat(jobs): send alert emails to opted-in recipients on new job"
```

---

### Task 4: Công tắc "Gửi email" mỗi alert (`/jobs/alerts`)

**Files:**
- Create: `components/jobs/AlertEmailToggle.tsx`
- Modify: `lib/jobs/alert-actions.ts`, `app/jobs/alerts/page.tsx`

**Interfaces:**
- Consumes: `emailEnabled` cột (Task 3); `auth`, `prisma`.
- Produces: `setAlertEmail(id: string, enabled: boolean): Promise<void>` (server action).

- [ ] **Step 1: Thêm `setAlertEmail` vào `lib/jobs/alert-actions.ts`**

Nối vào cuối file (giữ nguyên `createJobAlert`/`deleteJobAlert`):

```ts
export async function setAlertEmail(id: string, enabled: boolean): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  await prisma.jobAlert.updateMany({ where: { id, userId }, data: { emailEnabled: enabled } });
  revalidatePath("/jobs/alerts");
}
```

- [ ] **Step 2: Cài đặt `components/jobs/AlertEmailToggle.tsx`**

```tsx
"use client";

import { useTransition } from "react";
import { setAlertEmail } from "@/lib/jobs/alert-actions";

export default function AlertEmailToggle({ id, enabled }: { id: string; enabled: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <input
        type="checkbox"
        checked={enabled}
        disabled={pending}
        onChange={() => startTransition(() => setAlertEmail(id, !enabled))}
      />
      Gửi email
    </label>
  );
}
```

- [ ] **Step 3: Thêm công tắc vào `app/jobs/alerts/page.tsx`**

Thêm import cạnh `DeleteAlertButton`:

```tsx
import AlertEmailToggle from "@/components/jobs/AlertEmailToggle";
```

Thay khối `<DeleteAlertButton id={a.id} />` (cuối mỗi `<li>`) bằng cụm phải gồm công tắc + nút xóa:

```tsx
                  <div className="flex items-center gap-3">
                    <AlertEmailToggle id={a.id} enabled={a.emailEnabled} />
                    <DeleteAlertButton id={a.id} />
                  </div>
```

(`findMany` ở trang không dùng `select` nên `a.emailEnabled` đã có sẵn.)

- [ ] **Step 4: Verify lint + build**

Run: `npm run lint` rồi `npm run build`
Expected: thành công.

- [ ] **Step 5: Commit**

```bash
git add components/jobs/AlertEmailToggle.tsx lib/jobs/alert-actions.ts app/jobs/alerts/page.tsx
git commit -m "feat(jobs): per-alert email toggle on /jobs/alerts"
```

---

### Task 5: Rà soát & kiểm thử tổng

**Files:** (rà soát)

- [ ] **Step 1: Chạy toàn bộ test**

Run: `npm test`
Expected: PASS (gồm `job-alert-email`).

- [ ] **Step 2: Build production**

Run: `npm run build`
Expected: thành công, không lỗi type.

- [ ] **Step 3: Chạy thử thủ công (khuyến nghị)**

Run: `npm run dev`.
- Chưa điền `RESEND_API_KEY` → NTD đăng tin khớp: ứng viên chỉ nhận in-app, không lỗi.
- Điền `RESEND_API_KEY`/`EMAIL_FROM`/`APP_URL` (restart dev) → đăng tin khớp: ứng viên (email bật) nhận email + in-app.
- Vào `/jobs/alerts`, tắt "Gửi email" ở 1 alert → đăng tin khớp lại: chỉ in-app cho alert đó.

- [ ] **Step 4: Commit dọn dẹp nếu có**

```bash
git add -A
git commit -m "chore(jobs): finalize job alert email feature"
```

---

## Self-Review (đã thực hiện khi viết plan)

- **Spec coverage:** transport degrade mềm → Task 2; builder thuần → Task 1; cột `emailEnabled` + gửi email trong hook → Task 3; công tắc opt-out mỗi alert → Task 4; env.example → Task 2; kiểm thử → Task 5. ✅
- **Placeholder scan:** không TODO/TBD; mọi bước có code/lệnh cụ thể.
- **Type consistency:** `buildJobAlertEmail(job, appUrl)` (Task 1) khớp lời gọi ở Task 3 (truyền `job` là `NotifyJob`, đủ trường id/title/company/location/salaryMin/salaryMax). `isEmailConfigured`/`sendEmail` (Task 2) dùng ở Task 3. `setAlertEmail(id, enabled)` (Task 4) khớp `AlertEmailToggle` gọi `setAlertEmail(id, !enabled)`. Cột `emailEnabled` (Task 3 schema) khớp `select` ở Task 3 và đọc `a.emailEnabled` ở Task 4 page + `updateMany data` ở Task 4 action.
- **Thứ tự an toàn:** Task 3 phụ thuộc Task 1+2 (builder + transport) và thêm cột trước khi Task 4 dùng. Task 2 module chưa ai import → build sạch độc lập. `notifyMatchingAlerts` giữ `try/catch` bao ngoài + gate `isEmailConfigured` → không cấu hình vẫn chạy in-app; chữ ký hàm không đổi nên `createJobDescription` không cần sửa.
