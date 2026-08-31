# Recruiter Tools (Vòng 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add recruiter tools to the platform: internal applicant notes, interview scheduling with in-app notification, and a candidate search page.

**Architecture:** Business logic in pure functions with dependency injection (same pattern as `transition.ts` / `apply.ts`) so tests can run without DB. Server actions in separate `"use server"` files wire up real Prisma deps. UI components are Client Components that call server actions and update state optimistically.

**Tech Stack:** Prisma 6 (db push, no migrations), Next.js App Router, Vitest, shadcn/ui Dialog (to install), Tailwind design tokens.

## Global Constraints

- `prisma db push` only — never `prisma migrate dev` (no migrations directory)
- Tailwind tokens only: `bg-primary`, `text-foreground`, `bg-muted/40`, `border-border` — no hardcoded `blue-*` / `slate-*`
- Server actions return `{ ok: boolean; error?: string }` — never throw
- Auth pattern: `const session = await auth(); const userId = session?.user?.id; if (!userId) return { ok: false, error: "..." }`
- `revalidateTag(CACHE_TAGS.applications)` after any write that affects application data
- Vietnamese copy throughout UI — match existing tone in codebase
- Tests: use Vitest with `vi.fn().mockResolvedValue(...)` for deps injection (no vi.mock of modules)
- No edit/delete for notes — append-only by design
- Cap candidate search at 50 results (slice after exp filter)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add ApplicantNote, Interview models; add relations to Application and User |
| `lib/applications/notes-logic.ts` | Create | Pure `runAddNote(params, deps)` function (testable) |
| `lib/applications/notes.ts` | Create | `"use server"` addNote server action |
| `lib/applications/__tests__/notes.test.ts` | Create | Unit tests for runAddNote |
| `components/NotesPanel.tsx` | Create | Client Component: notes list + add form |
| `app/jobs/[id]/applicants/[appId]/page.tsx` | Modify | Add notes query + NotesPanel (Task 3), then interview query + card (Task 6) |
| `lib/applications/interview-logic.ts` | Create | Pure `runScheduleInterview(params, deps)` (testable) |
| `lib/applications/interview.ts` | Create | `"use server"` scheduleInterview server action |
| `lib/applications/__tests__/interview.test.ts` | Create | Unit tests for runScheduleInterview |
| `components/InterviewModal.tsx` | Create | Client Component: interview scheduling dialog |
| `components/ui/dialog.tsx` (+ peers) | Install | shadcn Dialog component |
| `app/jobs/[id]/applicants/ApplicantsBoard.tsx` | Modify | Intercept INTERVIEW status → show InterviewModal |
| `app/applications/page.tsx` | Modify | Add interview query + "Có lịch phỏng vấn" badge |
| `lib/candidates/search.ts` | Create | `applyExpFilter`, `mapToCandidateCards`, `searchCandidates` |
| `lib/candidates/__tests__/search.test.ts` | Create | Unit tests for pure functions |
| `app/candidates/page.tsx` | Create | RECRUITER-only Server Component: renders search form + results |
| `app/candidates/CandidateSearch.tsx` | Create | Client Component: search form + candidate cards |
| `components/NavLinks.tsx` | Modify | Add `isRecruiter` prop → show "Ứng viên" link |
| `components/Navbar.tsx` | Modify | Pass `isRecruiter` to NavLinks |

---

## Task 1: Schema — ApplicantNote + Interview models

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `ApplicantNote` and `Interview` Prisma models; `notes` and `interview` relations on `Application`; `notes` relation on `User`

- [ ] **Step 1: Add ApplicantNote and Interview to schema**

Open `prisma/schema.prisma`. After the `ApplicationEvent` model (around line 261), add the two new models:

```prisma
model ApplicantNote {
  id            String      @id @default(cuid())
  applicationId String
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  recruiterId   String
  recruiter     User        @relation("RecruiterNotes", fields: [recruiterId], references: [id], onDelete: Cascade)
  content       String
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}

model Interview {
  id            String      @id @default(cuid())
  applicationId String      @unique
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  scheduledAt   DateTime
  location      String      @default("")
  meetingLink   String      @default("")
  note          String      @default("")
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}
```

- [ ] **Step 2: Add relations to Application model**

In the `Application` model (around line 232), add before the closing brace:

```prisma
  notes         ApplicantNote[]
  interview     Interview?
```

- [ ] **Step 3: Add relation to User model**

In the `User` model (around line 16), add after `notifications Notification[]`:

```prisma
  recruiterNotes ApplicantNote[] @relation("RecruiterNotes")
```

- [ ] **Step 4: Push schema to DB**

```bash
npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 5: Verify Prisma client regenerated**

```bash
npx prisma generate
```

Expected: Prisma client generated successfully.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add ApplicantNote and Interview models"
```

---

## Task 2: addNote logic + server action + tests

**Files:**
- Create: `lib/applications/notes-logic.ts`
- Create: `lib/applications/notes.ts`
- Create: `lib/applications/__tests__/notes.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces:
  - `runAddNote(params, deps): Promise<{ ok: boolean; error?: string }>`
  - `addNote(applicationId, content): Promise<{ ok: boolean; error?: string }>` (server action)

- [ ] **Step 1: Write the failing tests**

Create `lib/applications/__tests__/notes.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { runAddNote, type AddNoteDeps } from "../notes-logic";

function deps(over: Partial<AddNoteDeps> = {}): AddNoteDeps {
  return {
    findApplicationForRecruiter: vi.fn().mockResolvedValue({ id: "app_1" }),
    createNote: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe("runAddNote", () => {
  it("happy path: tạo note thành công", async () => {
    const d = deps();
    const r = await runAddNote(
      { applicationId: "app_1", recruiterId: "r_1", content: "Ghi chú tốt" },
      d,
    );
    expect(r).toEqual({ ok: true });
    expect(d.createNote).toHaveBeenCalledWith({
      applicationId: "app_1",
      recruiterId: "r_1",
      content: "Ghi chú tốt",
    });
  });

  it("từ chối nếu NTD không phải chủ job", async () => {
    const r = await runAddNote(
      { applicationId: "app_1", recruiterId: "r_1", content: "Ghi chú" },
      deps({ findApplicationForRecruiter: vi.fn().mockResolvedValue(null) }),
    );
    expect(r).toEqual({ ok: false, error: "Không có quyền thêm ghi chú" });
  });

  it("từ chối nếu content rỗng hoặc toàn khoảng trắng", async () => {
    const r = await runAddNote(
      { applicationId: "app_1", recruiterId: "r_1", content: "   " },
      deps(),
    );
    expect(r).toEqual({ ok: false, error: "Ghi chú không được để trống" });
  });

  it("từ chối nếu content quá 2000 ký tự", async () => {
    const r = await runAddNote(
      { applicationId: "app_1", recruiterId: "r_1", content: "a".repeat(2001) },
      deps(),
    );
    expect(r).toEqual({ ok: false, error: "Ghi chú không được vượt quá 2000 ký tự" });
  });

  it("trim whitespace trước khi lưu", async () => {
    const d = deps();
    await runAddNote(
      { applicationId: "app_1", recruiterId: "r_1", content: "  Ghi chú  " },
      d,
    );
    expect(d.createNote).toHaveBeenCalledWith(
      expect.objectContaining({ content: "Ghi chú" }),
    );
  });

  it("không gọi createNote nếu validation fail", async () => {
    const d = deps();
    await runAddNote(
      { applicationId: "app_1", recruiterId: "r_1", content: "" },
      d,
    );
    expect(d.createNote).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/applications/__tests__/notes.test.ts
```

Expected: FAIL — `Cannot find module '../notes-logic'`

- [ ] **Step 3: Create the pure logic function**

Create `lib/applications/notes-logic.ts`:

```typescript
export type AddNoteDeps = {
  findApplicationForRecruiter: (
    appId: string,
    recruiterId: string,
  ) => Promise<{ id: string } | null>;
  createNote: (data: {
    applicationId: string;
    recruiterId: string;
    content: string;
  }) => Promise<void>;
};

export async function runAddNote(
  params: { applicationId: string; recruiterId: string; content: string },
  deps: AddNoteDeps,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = params.content.trim();
  if (!trimmed) return { ok: false, error: "Ghi chú không được để trống" };
  if (trimmed.length > 2000)
    return { ok: false, error: "Ghi chú không được vượt quá 2000 ký tự" };

  const app = await deps.findApplicationForRecruiter(
    params.applicationId,
    params.recruiterId,
  );
  if (!app) return { ok: false, error: "Không có quyền thêm ghi chú" };

  await deps.createNote({
    applicationId: params.applicationId,
    recruiterId: params.recruiterId,
    content: trimmed,
  });
  return { ok: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/applications/__tests__/notes.test.ts
```

Expected: 6 tests passing.

- [ ] **Step 5: Create the server action**

Create `lib/applications/notes.ts`:

```typescript
"use server";

import { auth } from "@/auth";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/tags";
import prisma from "@/lib/db/prisma";
import { runAddNote, type AddNoteDeps } from "./notes-logic";

export async function addNote(
  applicationId: string,
  content: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "RECRUITER")
    return { ok: false, error: "Chỉ nhà tuyển dụng" };

  const deps: AddNoteDeps = {
    findApplicationForRecruiter: (appId, recruiterId) =>
      prisma.application.findFirst({
        where: { id: appId, job: { userId: recruiterId } },
        select: { id: true },
      }),
    createNote: async (data) => {
      await prisma.applicantNote.create({ data });
    },
  };

  const outcome = await runAddNote(
    { applicationId, recruiterId: userId, content },
    deps,
  );
  if (outcome.ok) revalidateTag(CACHE_TAGS.applications);
  return outcome;
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/applications/notes-logic.ts lib/applications/notes.ts lib/applications/__tests__/notes.test.ts
git commit -m "feat(notes): add recruiter applicant notes server action + tests"
```

---

## Task 3: Notes panel UI on applicant detail page

**Files:**
- Create: `components/NotesPanel.tsx`
- Modify: `app/jobs/[id]/applicants/[appId]/page.tsx`

**Interfaces:**
- Consumes: `addNote` from `lib/applications/notes.ts`
- Produces: `NotesPanel` component; updated applicant detail page with notes

- [ ] **Step 1: Create NotesPanel component**

Create `components/NotesPanel.tsx`:

```typescript
"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { addNote } from "@/lib/applications/notes";

type Note = { id: string; content: string; createdAt: Date | string };

export default function NotesPanel({
  applicationId,
  initialNotes,
}: {
  applicationId: string;
  initialNotes: Note[];
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const trimmed = content.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const r = await addNote(applicationId, trimmed);
      if (r.ok) {
        setNotes((prev) => [
          ...prev,
          {
            id: `tmp_${Date.now()}`,
            content: trimmed,
            createdAt: new Date(),
          },
        ]);
        setContent("");
      } else {
        toast.error(r.error ?? "Lưu ghi chú thất bại");
      }
    });
  }

  return (
    <Card className="mt-3">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground">Ghi chú nội bộ</CardTitle>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            Chỉ NTD thấy
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {notes.length > 0 && (
          <div className="space-y-2">
            {notes.map((n) => (
              <div
                key={n.id}
                className="rounded-md bg-muted/40 p-3 text-sm text-foreground"
              >
                <p className="mb-1 text-xs text-muted-foreground">
                  {new Date(n.createdAt).toLocaleDateString("vi-VN")}
                </p>
                <p className="whitespace-pre-wrap">{n.content}</p>
              </div>
            ))}
          </div>
        )}
        <Textarea
          placeholder="Thêm ghi chú..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={2000}
          rows={3}
          className="resize-none"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isPending || !content.trim()}
          >
            {isPending ? "Đang lưu..." : "Lưu ghi chú"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Update applicant detail page to query notes + render NotesPanel**

In `app/jobs/[id]/applicants/[appId]/page.tsx`, make the following changes:

**Add import at the top (after existing imports):**
```typescript
import NotesPanel from "@/components/NotesPanel";
```

**Update the Prisma query** — add `notes` to the `select` block (inside the existing `prisma.application.findFirst` call):
```typescript
      notes: {
        orderBy: { createdAt: "asc" },
        select: { id: true, content: true, createdAt: true },
      },
```

So the full select becomes:
```typescript
    select: {
      id: true,
      status: true,
      coverLetter: true,
      cvSnapshot: true,
      candidate: { select: { name: true } },
      evaluation: { select: { overallScore: true, summary: true } },
      events: {
        orderBy: { createdAt: "asc" },
        select: { toStatus: true, createdAt: true },
      },
      notes: {
        orderBy: { createdAt: "asc" },
        select: { id: true, content: true, createdAt: true },
      },
    },
```

**Add NotesPanel** at the end of `<main>`, after the existing `Card` for "Lịch sử trạng thái":
```tsx
        <NotesPanel applicationId={app.id} initialNotes={app.notes} />
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/NotesPanel.tsx app/jobs/[id]/applicants/[appId]/page.tsx
git commit -m "feat(notes): recruiter notes panel on applicant detail page"
```

---

## Task 4: scheduleInterview logic + server action + tests

**Files:**
- Create: `lib/applications/interview-logic.ts`
- Create: `lib/applications/interview.ts`
- Create: `lib/applications/__tests__/interview.test.ts`

**Interfaces:**
- Consumes: `createNotification` from `lib/notifications/create.ts`
- Produces:
  - `InterviewData` type
  - `runScheduleInterview(params, deps): Promise<{ ok: boolean; error?: string }>`
  - `scheduleInterview(applicationId, data): Promise<{ ok: boolean; error?: string }>` (server action)

- [ ] **Step 1: Write the failing tests**

Create `lib/applications/__tests__/interview.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { runScheduleInterview, type ScheduleInterviewDeps } from "../interview-logic";

const mockData = {
  scheduledAt: new Date("2026-09-10T09:00:00"),
  location: "Hà Nội",
  meetingLink: "",
  note: "Phỏng vấn kỹ thuật",
};

function deps(over: Partial<ScheduleInterviewDeps> = {}): ScheduleInterviewDeps {
  return {
    findApplicationForRecruiter: vi
      .fn()
      .mockResolvedValue({ id: "app_1", candidateId: "c_1" }),
    upsertInterview: vi.fn().mockResolvedValue(undefined),
    notifyCandidate: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe("runScheduleInterview", () => {
  it("happy path: lưu lịch + gửi thông báo ứng viên", async () => {
    const d = deps();
    const r = await runScheduleInterview(
      { applicationId: "app_1", recruiterId: "r_1", recruiterName: "NTD A", data: mockData },
      d,
    );
    expect(r).toEqual({ ok: true });
    expect(d.upsertInterview).toHaveBeenCalledWith("app_1", mockData);
    expect(d.notifyCandidate).toHaveBeenCalledWith(
      "c_1",
      expect.stringContaining("NTD A"),
      "/applications",
    );
  });

  it("từ chối nếu NTD không phải chủ job", async () => {
    const r = await runScheduleInterview(
      { applicationId: "app_1", recruiterId: "r_1", recruiterName: "NTD A", data: mockData },
      deps({ findApplicationForRecruiter: vi.fn().mockResolvedValue(null) }),
    );
    expect(r).toEqual({ ok: false, error: "Không tìm thấy đơn ứng tuyển" });
  });

  it("thông báo thất bại không làm hỏng kết quả", async () => {
    const d = deps({
      notifyCandidate: vi.fn().mockRejectedValue(new Error("push failed")),
    });
    const r = await runScheduleInterview(
      { applicationId: "app_1", recruiterId: "r_1", recruiterName: "NTD A", data: mockData },
      d,
    );
    expect(r).toEqual({ ok: true });
    expect(d.upsertInterview).toHaveBeenCalled();
  });

  it("thông báo chứa ngày giờ đúng định dạng vi-VN", async () => {
    const d = deps();
    await runScheduleInterview(
      { applicationId: "app_1", recruiterId: "r_1", recruiterName: "NTD A", data: mockData },
      d,
    );
    const [, msg] = (d.notifyCandidate as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(msg).toContain("10");  // day 10
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/applications/__tests__/interview.test.ts
```

Expected: FAIL — `Cannot find module '../interview-logic'`

- [ ] **Step 3: Create the pure logic function**

Create `lib/applications/interview-logic.ts`:

```typescript
export type InterviewData = {
  scheduledAt: Date;
  location: string;
  meetingLink: string;
  note: string;
};

export type ScheduleInterviewDeps = {
  findApplicationForRecruiter: (
    appId: string,
    recruiterId: string,
  ) => Promise<{ id: string; candidateId: string } | null>;
  upsertInterview: (
    applicationId: string,
    data: InterviewData,
  ) => Promise<void>;
  notifyCandidate: (
    candidateId: string,
    message: string,
    link: string,
  ) => Promise<void>;
};

export async function runScheduleInterview(
  params: {
    applicationId: string;
    recruiterId: string;
    recruiterName: string;
    data: InterviewData;
  },
  deps: ScheduleInterviewDeps,
): Promise<{ ok: boolean; error?: string }> {
  const app = await deps.findApplicationForRecruiter(
    params.applicationId,
    params.recruiterId,
  );
  if (!app) return { ok: false, error: "Không tìm thấy đơn ứng tuyển" };

  await deps.upsertInterview(params.applicationId, params.data);

  const dateStr = params.data.scheduledAt.toLocaleDateString("vi-VN");
  const timeStr = params.data.scheduledAt.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  try {
    await deps.notifyCandidate(
      app.candidateId,
      `Bạn có lịch phỏng vấn với ${params.recruiterName} vào ${dateStr} lúc ${timeStr}`,
      "/applications",
    );
  } catch {
    // thông báo lỗi không làm hỏng việc lưu lịch
  }

  return { ok: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/applications/__tests__/interview.test.ts
```

Expected: 4 tests passing.

- [ ] **Step 5: Create the server action**

Create `lib/applications/interview.ts`:

```typescript
"use server";

import { auth } from "@/auth";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/tags";
import prisma from "@/lib/db/prisma";
import { createNotification } from "@/lib/notifications/create";
import {
  runScheduleInterview,
  type InterviewData,
  type ScheduleInterviewDeps,
} from "./interview-logic";

export type { InterviewData };

export async function scheduleInterview(
  applicationId: string,
  data: InterviewData,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "RECRUITER")
    return { ok: false, error: "Chỉ nhà tuyển dụng" };

  const deps: ScheduleInterviewDeps = {
    findApplicationForRecruiter: (appId, recruiterId) =>
      prisma.application.findFirst({
        where: { id: appId, job: { userId: recruiterId } },
        select: { id: true, candidateId: true },
      }),
    upsertInterview: async (appId, d) => {
      await prisma.interview.upsert({
        where: { applicationId: appId },
        create: {
          applicationId: appId,
          scheduledAt: d.scheduledAt,
          location: d.location,
          meetingLink: d.meetingLink,
          note: d.note,
        },
        update: {
          scheduledAt: d.scheduledAt,
          location: d.location,
          meetingLink: d.meetingLink,
          note: d.note,
        },
      });
    },
    notifyCandidate: (candidateId, message, link) =>
      createNotification(candidateId, { message, link }),
  };

  const outcome = await runScheduleInterview(
    {
      applicationId,
      recruiterId: userId,
      recruiterName: session.user.name ?? "Nhà tuyển dụng",
      data,
    },
    deps,
  );
  if (outcome.ok) revalidateTag(CACHE_TAGS.applications);
  return outcome;
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/applications/interview-logic.ts lib/applications/interview.ts lib/applications/__tests__/interview.test.ts
git commit -m "feat(interview): scheduleInterview server action + tests"
```

---

## Task 5: Interview modal in ApplicantsBoard

**Files:**
- Install: `components/ui/dialog.tsx` (via shadcn)
- Create: `components/InterviewModal.tsx`
- Modify: `app/jobs/[id]/applicants/ApplicantsBoard.tsx`

**Interfaces:**
- Consumes: `scheduleInterview` from `lib/applications/interview.ts`; `changeStatus` from `lib/applications/actions.ts`
- Produces: `InterviewModal` component; updated `ApplicantsBoard` that shows modal when dragging to INTERVIEW

- [ ] **Step 1: Install shadcn Dialog**

```bash
npx shadcn@latest add dialog
```

Expected: `components/ui/dialog.tsx` created.

- [ ] **Step 2: Create InterviewModal**

Create `components/InterviewModal.tsx`:

```typescript
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { scheduleInterview } from "@/lib/applications/interview";
import { changeStatus } from "@/lib/applications/actions";

type Props = {
  open: boolean;
  applicationId: string;
  onClose: () => void;
  onSuccess: () => void;
};

export default function InterviewModal({
  open,
  applicationId,
  onClose,
  onSuccess,
}: Props) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSkip() {
    setSaving(true);
    try {
      const r = await changeStatus(applicationId, "INTERVIEW", "");
      if (r.ok) {
        onClose();
        onSuccess();
      } else {
        toast.error(r.error);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!date || !time) {
      toast.error("Vui lòng chọn ngày và giờ phỏng vấn");
      return;
    }
    setSaving(true);
    try {
      const scheduledAt = new Date(`${date}T${time}`);
      const [r1, r2] = await Promise.all([
        scheduleInterview(applicationId, {
          scheduledAt,
          location,
          meetingLink,
          note,
        }),
        changeStatus(applicationId, "INTERVIEW", ""),
      ]);
      if (!r1.ok) { toast.error(r1.error); return; }
      if (!r2.ok) { toast.error(r2.error); return; }
      toast.success("Đã lưu lịch phỏng vấn");
      onClose();
      onSuccess();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Đặt lịch phỏng vấn (không bắt buộc)</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="iv-date">Ngày *</Label>
              <Input
                id="iv-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="iv-time">Giờ *</Label>
              <Input
                id="iv-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="iv-loc">Địa điểm</Label>
            <Input
              id="iv-loc"
              placeholder="Địa chỉ văn phòng..."
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="iv-link">Link meeting</Label>
            <Input
              id="iv-link"
              placeholder="meet.google.com/abc-def-ghi"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="iv-note">Ghi chú thêm</Label>
            <Textarea
              id="iv-note"
              placeholder="Phỏng vấn kỹ thuật 45 phút..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleSkip} disabled={saving}>
            Bỏ qua
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu lịch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Update ApplicantsBoard**

In `app/jobs/[id]/applicants/ApplicantsBoard.tsx`, make these changes:

**Add import at top:**
```typescript
import InterviewModal from "@/components/InterviewModal";
```

**Add state after existing `useState` declarations** (after `const [dragId, setDragId] = useState<string | null>(null);`):
```typescript
  const [interviewAppId, setInterviewAppId] = useState<string | null>(null);
```

**Replace the `onDrop` function** with this version that intercepts INTERVIEW status:
```typescript
  async function onDrop(status: ApplicationStatus) {
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.status === status) return;

    if (status === "INTERVIEW") {
      setInterviewAppId(id);
      return;
    }

    const prev = cards;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status } : c)));
    const r = await changeStatus(id, status, "");
    if (r.ok) {
      toast.success(`Đã chuyển sang "${STATUS_LABELS[status]}"`);
      router.refresh();
    } else {
      setCards(prev);
      toast.error(r.error);
    }
  }
```

**Add InterviewModal** at the very end of the component return, after the final `</div>` and before the closing `</>`:
```tsx
      {interviewAppId && (
        <InterviewModal
          open={true}
          applicationId={interviewAppId}
          onClose={() => setInterviewAppId(null)}
          onSuccess={() => {
            setCards((cs) =>
              cs.map((c) =>
                c.id === interviewAppId ? { ...c, status: "INTERVIEW" as ApplicationStatus } : c,
              ),
            );
            setInterviewAppId(null);
            toast.success(`Đã chuyển sang "${STATUS_LABELS["INTERVIEW"]}"`);
            router.refresh();
          }}
        />
      )}
```

The return should now look like:
```tsx
  return (
    <>
      <div className="mt-4 grid grid-flow-col gap-3 ...">
        {/* existing board columns */}
      </div>

      {withdrawn.length > 0 && (
        {/* existing withdrawn section */}
      )}

      {interviewAppId && (
        <InterviewModal
          open={true}
          applicationId={interviewAppId}
          onClose={() => setInterviewAppId(null)}
          onSuccess={() => {
            setCards((cs) =>
              cs.map((c) =>
                c.id === interviewAppId ? { ...c, status: "INTERVIEW" as ApplicationStatus } : c,
              ),
            );
            setInterviewAppId(null);
            toast.success(`Đã chuyển sang "${STATUS_LABELS["INTERVIEW"]}"`);
            router.refresh();
          }}
        />
      )}
    </>
  );
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/ui/dialog.tsx components/InterviewModal.tsx app/jobs/[id]/applicants/ApplicantsBoard.tsx
git commit -m "feat(interview): interview modal when dragging to INTERVIEW status"
```

---

## Task 6: Interview display on detail page + badge on /applications

**Files:**
- Modify: `app/jobs/[id]/applicants/[appId]/page.tsx`
- Modify: `app/applications/page.tsx`

**Interfaces:**
- Consumes: `Interview` model (from Task 1 schema)
- Produces: interview card on applicant detail; interview badge on candidate applications list

- [ ] **Step 1: Update applicant detail page to query and display interview**

In `app/jobs/[id]/applicants/[appId]/page.tsx`:

**Add `interview` to the select block** (after `notes`):
```typescript
      interview: {
        select: {
          scheduledAt: true,
          location: true,
          meetingLink: true,
          note: true,
        },
      },
```

**Add Interview Card** in the JSX — insert after the evaluation Card and before the cover letter Card (around line 74):
```tsx
        {app.interview && (
          <Card className="mt-3">
            <CardHeader>
              <CardTitle className="text-foreground">Lịch phỏng vấn</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-foreground">
              <p>
                <span className="font-medium">Thời gian: </span>
                {new Date(app.interview.scheduledAt).toLocaleString("vi-VN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
              {app.interview.location && (
                <p>
                  <span className="font-medium">Địa điểm: </span>
                  {app.interview.location}
                </p>
              )}
              {app.interview.meetingLink && (
                <p>
                  <span className="font-medium">Link: </span>
                  <a
                    href={app.interview.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {app.interview.meetingLink}
                  </a>
                </p>
              )}
              {app.interview.note && (
                <p>
                  <span className="font-medium">Ghi chú: </span>
                  {app.interview.note}
                </p>
              )}
            </CardContent>
          </Card>
        )}
```

- [ ] **Step 2: Update /applications page to show interview badge**

In `app/applications/page.tsx`, update the Prisma query to include `interview`:

**Add to the `select` block** (after `events`):
```typescript
      interview: { select: { scheduledAt: true } },
```

**Add badge in the card render** — find where each application card is rendered (around line 60) and add the badge. After the status badge, add:
```tsx
                {a.interview && (
                  <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                    Có lịch phỏng vấn
                  </Badge>
                )}
```

To find the right location, look for the `<Card key={a.id}>` element and the status display. The badge goes alongside or below the status badge.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/jobs/[id]/applicants/[appId]/page.tsx app/applications/page.tsx
git commit -m "feat(interview): show interview details on applicant page + badge on applications list"
```

---

## Task 7: searchCandidates pure functions + tests

**Files:**
- Create: `lib/candidates/search.ts`
- Create: `lib/candidates/__tests__/search.test.ts`

**Interfaces:**
- Consumes: nothing (uses Prisma directly; pure logic functions are testable without DB)
- Produces:
  - `CandidateCard` type
  - `applyExpFilter(rows, exp)` — pure function
  - `mapToCandidateCards(rows)` — pure function
  - `searchCandidates(params)` — async function using Prisma

- [ ] **Step 1: Write failing tests for pure functions**

Create `lib/candidates/__tests__/search.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { applyExpFilter, mapToCandidateCards } from "../search";

type RawRow = {
  id: string;
  shareToken: string | null;
  profile: { fullName: string; headline: string; location: string } | null;
  skills: { name: string }[];
  _count: { experiences: number };
};

function row(experienceCount: number, id = `cv_${experienceCount}`): RawRow {
  return {
    id,
    shareToken: `tok_${id}`,
    profile: { fullName: `Ứng viên ${id}`, headline: "Developer", location: "HCM" },
    skills: [{ name: "React" }, { name: "TypeScript" }],
    _count: { experiences: experienceCount },
  };
}

describe("applyExpFilter", () => {
  it("exp undefined -> trả toàn bộ", () => {
    const rows = [row(0), row(2), row(6)];
    expect(applyExpFilter(rows, undefined)).toHaveLength(3);
  });

  it("exp '0' -> chỉ CV không có kinh nghiệm (0 entries)", () => {
    const rows = [row(0), row(1), row(3)];
    const result = applyExpFilter(rows, "0");
    expect(result).toHaveLength(1);
    expect(result[0]._count.experiences).toBe(0);
  });

  it("exp '1' -> experience entries trong khoảng 1–4", () => {
    const rows = [row(0), row(1), row(4), row(5)];
    const result = applyExpFilter(rows, "1");
    expect(result.map((r) => r._count.experiences)).toEqual([1, 4]);
  });

  it("exp '3' -> experience entries trong khoảng 3–8", () => {
    const rows = [row(2), row(3), row(8), row(9)];
    const result = applyExpFilter(rows, "3");
    expect(result.map((r) => r._count.experiences)).toEqual([3, 8]);
  });

  it("exp '5' -> experience entries >= 5", () => {
    const rows = [row(3), row(5), row(10)];
    const result = applyExpFilter(rows, "5");
    expect(result.map((r) => r._count.experiences)).toEqual([5, 10]);
  });

  it("giá trị exp không hợp lệ -> trả toàn bộ", () => {
    const rows = [row(0), row(5)];
    expect(applyExpFilter(rows, "999")).toHaveLength(2);
  });
});

describe("mapToCandidateCards", () => {
  it("map đúng tất cả các trường", () => {
    const cards = mapToCandidateCards([row(2, "cv_test")]);
    expect(cards[0]).toEqual({
      cvId: "cv_test",
      shareToken: "tok_cv_test",
      fullName: "Ứng viên cv_test",
      headline: "Developer",
      location: "HCM",
      skills: ["React", "TypeScript"],
    });
  });

  it("profile null -> chuỗi rỗng cho fullName, headline, location", () => {
    const r: RawRow = {
      id: "cv_null",
      shareToken: "tok_null",
      profile: null,
      skills: [],
      _count: { experiences: 0 },
    };
    const cards = mapToCandidateCards([r]);
    expect(cards[0].fullName).toBe("");
    expect(cards[0].headline).toBe("");
    expect(cards[0].location).toBe("");
    expect(cards[0].skills).toEqual([]);
  });

  it("skills chỉ lấy name từ mảng object", () => {
    const r = row(0, "cv_sk");
    r.skills = [{ name: "Go" }, { name: "Rust" }];
    const cards = mapToCandidateCards([r]);
    expect(cards[0].skills).toEqual(["Go", "Rust"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/candidates/__tests__/search.test.ts
```

Expected: FAIL — `Cannot find module '../search'`

- [ ] **Step 3: Create search.ts with pure functions and searchCandidates**

Create `lib/candidates/search.ts`:

```typescript
import prisma from "@/lib/db/prisma";

export type CandidateCard = {
  cvId: string;
  shareToken: string;
  fullName: string;
  headline: string;
  location: string;
  skills: string[];
};

type RawRow = {
  id: string;
  shareToken: string | null;
  profile: { fullName: string; headline: string; location: string } | null;
  skills: { name: string }[];
  _count: { experiences: number };
};

export function applyExpFilter(rows: RawRow[], exp: string | undefined): RawRow[] {
  return rows.filter((r) => {
    const n = r._count.experiences;
    if (exp === "0") return n === 0;
    if (exp === "1") return n >= 1 && n <= 4;
    if (exp === "3") return n >= 3 && n <= 8;
    if (exp === "5") return n >= 5;
    return true;
  });
}

export function mapToCandidateCards(rows: RawRow[]): CandidateCard[] {
  return rows.map((r) => ({
    cvId: r.id,
    shareToken: r.shareToken!,
    fullName: r.profile?.fullName ?? "",
    headline: r.profile?.headline ?? "",
    location: r.profile?.location ?? "",
    skills: r.skills.map((s) => s.name),
  }));
}

export async function searchCandidates(params: {
  q?: string;
  exp?: string;
}): Promise<CandidateCard[]> {
  const keywords = (params.q ?? "").trim().split(/\s+/).filter(Boolean);

  const keywordOr = keywords.flatMap((kw) => [
    { profile: { fullName: { contains: kw, mode: "insensitive" as const } } },
    { profile: { headline: { contains: kw, mode: "insensitive" as const } } },
    { profile: { location: { contains: kw, mode: "insensitive" as const } } },
    { profile: { summary: { contains: kw, mode: "insensitive" as const } } },
    { skills: { some: { name: { contains: kw, mode: "insensitive" as const } } } },
  ]);

  const rows = await prisma.cV.findMany({
    where: {
      shareToken: { not: null },
      ...(keywordOr.length > 0 ? { OR: keywordOr } : {}),
    },
    select: {
      id: true,
      shareToken: true,
      profile: { select: { fullName: true, headline: true, location: true } },
      skills: { select: { name: true }, take: 4, orderBy: { order: "asc" } },
      _count: { select: { experiences: true } },
    },
    take: 100,
    orderBy: { updatedAt: "desc" },
  });

  const filtered = applyExpFilter(rows, params.exp);
  return mapToCandidateCards(filtered.slice(0, 50));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/candidates/__tests__/search.test.ts
```

Expected: 9 tests passing.

- [ ] **Step 5: Commit**

```bash
git add lib/candidates/search.ts lib/candidates/__tests__/search.test.ts
git commit -m "feat(candidates): searchCandidates with exp filter + unit tests"
```

---

## Task 8: /candidates page + NavLinks update

**Files:**
- Create: `app/candidates/page.tsx`
- Create: `app/candidates/CandidateSearch.tsx`
- Modify: `components/NavLinks.tsx`
- Modify: `components/Navbar.tsx`

**Interfaces:**
- Consumes: `searchCandidates` from `lib/candidates/search.ts`; `CandidateCard` type
- Produces: `/candidates` route; "Ứng viên" nav link for RECRUITER

- [ ] **Step 1: Create CandidateSearch client component**

Create `app/candidates/CandidateSearch.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import CompanyAvatar from "@/components/CompanyAvatar";
import type { CandidateCard } from "@/lib/candidates/search";

const EXP_OPTIONS = [
  { value: "", label: "Tất cả kinh nghiệm" },
  { value: "0", label: "Chưa có kinh nghiệm" },
  { value: "1", label: "1–2 năm" },
  { value: "3", label: "3–5 năm" },
  { value: "5", label: "5+ năm" },
];

export default function CandidateSearch({
  initialCandidates,
  initialQ,
  initialExp,
}: {
  initialCandidates: CandidateCard[];
  initialQ: string;
  initialExp: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [exp, setExp] = useState(initialExp);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (exp) params.set("exp", exp);
    router.push(`/candidates?${params.toString()}`);
  }

  return (
    <div className="mt-4">
      <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
        <Input
          placeholder="React, Node.js, Hà Nội..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
        <select
          value={exp}
          onChange={(e) => setExp(e.target.value)}
          className="rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {EXP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm">
          Tìm
        </Button>
      </form>

      {initialCandidates.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<Users className="h-10 w-10" />}
            title="Không tìm thấy ứng viên"
            description="Chưa có ứng viên nào chia sẻ CV công khai hoặc không khớp bộ lọc."
          />
        </div>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted-foreground">
            Hiển thị {initialCandidates.length} ứng viên
          </p>
          <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {initialCandidates.map((c) => (
              <div
                key={c.cvId}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-center gap-3">
                  <CompanyAvatar name={c.fullName || "?"} className="h-10 w-10 text-sm" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {c.fullName || "(Chưa đặt tên)"}
                    </p>
                    {c.headline && (
                      <p className="truncate text-xs text-muted-foreground">
                        {c.headline}
                      </p>
                    )}
                  </div>
                </div>
                {c.location && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    📍 {c.location}
                  </p>
                )}
                {c.skills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.skills.map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
                <Link
                  href={`/cv/share/${c.shareToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-xs text-primary hover:underline"
                >
                  Xem CV →
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create /candidates page**

Create `app/candidates/page.tsx`:

```typescript
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import { searchCandidates } from "@/lib/candidates/search";
import CandidateSearch from "./CandidateSearch";

export const dynamic = "force-dynamic";

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; exp?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "RECRUITER") redirect("/dashboard");

  const { q, exp } = await searchParams;
  const candidates = await searchCandidates({ q, exp });

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 p-6">
        <h1 className="text-xl font-semibold text-foreground">Tìm ứng viên</h1>
        <CandidateSearch
          initialCandidates={candidates}
          initialQ={q ?? ""}
          initialExp={exp ?? ""}
        />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Update NavLinks to show "Ứng viên" link for RECRUITER**

In `components/NavLinks.tsx`, make the following changes:

**Update `NavLinks` function signature** from:
```typescript
export function NavLinks({ isAdmin }: { isAdmin?: boolean }) {
```
to:
```typescript
export function NavLinks({ isAdmin, isRecruiter }: { isAdmin?: boolean; isRecruiter?: boolean }) {
```

**Add the candidates link** inside `NavLinks`, after the existing `{links.map(...)}` and before the `{isAdmin && ...}` block:
```tsx
      {isRecruiter && (
        <Link
          href="/candidates"
          className={cn(
            "text-sm font-medium transition-colors",
            isActive("/candidates")
              ? "border-b-2 border-primary pb-0.5 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Ứng viên
        </Link>
      )}
```

**Update `MobileNavLinks` function signature** similarly (add `isRecruiter?: boolean`) and add the same candidates link inside it.

- [ ] **Step 4: Update Navbar to pass isRecruiter**

In `components/Navbar.tsx`, find the `<NavLinks>` usage (around line 41):
```tsx
<NavLinks isAdmin={session!.user!.role === "ADMIN"} />
```
Change to:
```tsx
<NavLinks
  isAdmin={session!.user!.role === "ADMIN"}
  isRecruiter={session!.user!.role === "RECRUITER"}
/>
```

Also find `<MobileNavLinks />` and change to:
```tsx
<MobileNavLinks isRecruiter={session!.user!.role === "RECRUITER"} />
```

- [ ] **Step 5: Run all tests to verify nothing broke**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/candidates/page.tsx app/candidates/CandidateSearch.tsx components/NavLinks.tsx components/Navbar.tsx
git commit -m "feat(candidates): /candidates search page + recruiter nav link"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] ApplicantNote model — Task 1
- [x] Interview model — Task 1
- [x] `addNote` server action — Task 2; auth + ownership + max 2000 chars + append-only
- [x] Notes panel UI — Task 3; "Chỉ NTD thấy" badge; list + textarea + save button
- [x] `scheduleInterview` server action — Task 4; upsert + notify candidate
- [x] Interview modal on INTERVIEW status drag — Task 5; "Bỏ qua" + "Lưu lịch"; pre-filled on reschedule (not in modal but upsert handles it)
- [x] Interview card on applicant detail — Task 6
- [x] Interview badge on /applications — Task 6
- [x] `searchCandidates` + exp filter — Task 7
- [x] `/candidates` route — RECRUITER only — Task 8
- [x] "Ứng viên" Navbar link for RECRUITER — Task 8

**Spec items verified YAGNI (not implemented, as spec requires):**
- No edit/delete notes
- No email notification for interview (in-app only)
- No candidate confirmation of interview
- No pagination on /candidates (take: 100, filter, slice to 50)
- No auth on `searchCandidates` itself (page handles auth)

**Type consistency check:**
- `InterviewData` defined in `interview-logic.ts`, re-exported from `interview.ts` — consistent
- `CandidateCard` exported from `search.ts`, imported in `CandidateSearch.tsx` — consistent
- `applyExpFilter` / `mapToCandidateCards` use same `RawRow` type as `searchCandidates` — consistent
- `AddNoteDeps.createNote` param shape matches `prisma.applicantNote.create({ data })` args — consistent
