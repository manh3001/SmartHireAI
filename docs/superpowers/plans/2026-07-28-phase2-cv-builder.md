# Phase 2: CV Builder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho ứng viên tạo/sửa nhiều CV có cấu trúc (5 mục) trên một trang và xuất ra PDF đẹp (hỗ trợ tiếng Việt).

**Architecture:** Next.js App Router. Dữ liệu CV lưu PostgreSQL (Neon) qua Prisma với model `CV` và 5 model con. Tạo/sửa/xóa CV dùng **Server Actions** (không dùng API route CRUD). Xuất PDF dùng **API route** trả file nhị phân, render bằng `@react-pdf/renderer`. Logic thuần (Zod schema, chuẩn hóa dữ liệu) viết theo TDD với Vitest. Giao diện dùng shadcn/ui.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Prisma 6, PostgreSQL (Neon), Server Actions, Zod, `@react-pdf/renderer`, shadcn/ui, Tailwind v4, Vitest.

## Global Constraints

- Ngôn ngữ: TypeScript, chế độ `strict`.
- **Prisma phải giữ ở v6** (`prisma` và `@prisma/client` đều `^6`). KHÔNG nâng v7 (v7 bỏ `url` trong datasource, gây lỗi P1012).
- Mọi secret nằm trong `.env`, KHÔNG commit `.env`.
- Validate mọi input bằng Zod, schema dùng chung client + server.
- Auth.js v5: dùng `auth()` (từ `@/auth`) để lấy session ở server.
- **Next.js 16: `params` của route/page động là `Promise` — phải `await params`.**
- Ứng viên chỉ được đọc/ghi/xuất CV của chính mình (kiểm tra `userId` từ session).
- Ngày tháng trong CV lưu dạng chuỗi `"YYYY-MM"` (hoặc rỗng) — không dùng `DateTime`.
- Mỗi task kết thúc bằng một commit.

---

### Task 1: Prisma models cho CV + 5 model con

**Files:**
- Modify: `prisma/schema.prisma` (thêm 6 model, thêm quan hệ ngược vào `User`)

**Interfaces:**
- Consumes: model `User` đã có từ Phase 1.
- Produces: các model `CV, Profile, Experience, Education, Skill, Project` trong Prisma Client; quan hệ `User.cvs`.

- [ ] **Step 1: Thêm quan hệ ngược vào model User**

Trong `prisma/schema.prisma`, thêm dòng `cvs CV[]` vào trong `model User` (đặt sau `createdAt`):
```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String
  role         Role     @default(CANDIDATE)
  createdAt    DateTime @default(now())
  cvs          CV[]
}
```

- [ ] **Step 2: Thêm 6 model mới**

Thêm vào cuối `prisma/schema.prisma`:
```prisma
model CV {
  id          String       @id @default(cuid())
  userId      String
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  title       String       @default("CV chưa đặt tên")
  profile     Profile?
  experiences Experience[]
  educations  Education[]
  skills      Skill[]
  projects    Project[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}

model Profile {
  id       String @id @default(cuid())
  cvId     String @unique
  cv       CV     @relation(fields: [cvId], references: [id], onDelete: Cascade)
  fullName String
  headline String @default("")
  email    String @default("")
  phone    String @default("")
  summary  String @default("")
}

model Experience {
  id          String @id @default(cuid())
  cvId        String
  cv          CV     @relation(fields: [cvId], references: [id], onDelete: Cascade)
  company     String
  position    String
  startDate   String @default("")
  endDate     String @default("")
  description String @default("")
  order       Int    @default(0)
}

model Education {
  id        String @id @default(cuid())
  cvId      String
  cv        CV     @relation(fields: [cvId], references: [id], onDelete: Cascade)
  school    String
  major     String @default("")
  startDate String @default("")
  endDate   String @default("")
  order     Int    @default(0)
}

model Skill {
  id    String @id @default(cuid())
  cvId  String
  cv    CV     @relation(fields: [cvId], references: [id], onDelete: Cascade)
  name  String
  level String @default("")
  order Int    @default(0)
}

model Project {
  id          String @id @default(cuid())
  cvId        String
  cv          CV     @relation(fields: [cvId], references: [id], onDelete: Cascade)
  name        String
  description String @default("")
  tech        String @default("")
  link        String @default("")
  order       Int    @default(0)
}
```

- [ ] **Step 3: Đẩy schema lên Neon + generate client**

```bash
npx prisma db push
```
Expected: "Your database is now in sync with your Prisma schema"; các bảng `CV, Profile, Experience, Education, Skill, Project` được tạo; Prisma Client được generate lại. (Bỏ qua thông báo "Update available 6 -> 7".)

- [ ] **Step 4: Xác nhận type mới đã có**

Run: `npx tsc --noEmit`
Expected: không lỗi (Prisma Client đã có `prisma.cV`, `prisma.profile`, ...).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Prisma models for CV and sub-sections"
```

---

### Task 2: Cài shadcn/ui + component cơ bản

**Files:**
- Create: `components.json` (do shadcn sinh ra)
- Create: `lib/utils.ts` (do shadcn sinh ra — hàm `cn`)
- Create: `components/ui/button.tsx`, `components/ui/input.tsx`, `components/ui/textarea.tsx`, `components/ui/label.tsx`, `components/ui/card.tsx`, `components/ui/sonner.tsx`
- Modify: `app/layout.tsx` (thêm `<Toaster />`)

**Interfaces:**
- Consumes: (không có)
- Produces: các component `Button, Input, Textarea, Label, Card (CardHeader/CardTitle/CardContent), Toaster, toast` để các task sau import từ `@/components/ui/*` và `sonner`.

- [ ] **Step 1: Khởi tạo shadcn/ui**

```bash
npx shadcn@latest init -d
```
`-d` dùng thiết lập mặc định (base color neutral). Lệnh tạo `components.json`, `lib/utils.ts` và cập nhật `app/globals.css`. Nếu được hỏi, chấp nhận mặc định.

- [ ] **Step 2: Thêm các component cần dùng**

```bash
npx shadcn@latest add button input textarea label card sonner
```
Expected: các file xuất hiện trong `components/ui/`.

- [ ] **Step 3: Gắn Toaster vào layout**

Trong `app/layout.tsx`, import và render `<Toaster />` ngay trước thẻ đóng `</body>`:
```tsx
import { Toaster } from "@/components/ui/sonner";
```
Và trong JSX, trước `</body>`:
```tsx
        {children}
        <Toaster />
```

- [ ] **Step 4: Kiểm tra build**

Run: `npx tsc --noEmit && npm run build`
Expected: build thành công, không lỗi type.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: set up shadcn/ui with base components"
```

---

### Task 3: Zod schema + chuẩn hóa dữ liệu CV (TDD)

**Files:**
- Create: `lib/cv/types.ts`
- Create: `lib/cv/normalize.ts`
- Create: `lib/cv/schema.ts`
- Test: `lib/cv/__tests__/normalize.test.ts`
- Test: `lib/cv/__tests__/schema.test.ts`

**Interfaces:**
- Consumes: (không có)
- Produces:
  - Từ `lib/cv/types.ts`: type `CvInput = { title: string; profile: ProfileInput; experiences: ExperienceInput[]; educations: EducationInput[]; skills: SkillInput[]; projects: ProjectInput[] }` với
    `ProfileInput = { fullName: string; headline: string; email: string; phone: string; summary: string }`,
    `ExperienceInput = { company: string; position: string; startDate: string; endDate: string; description: string }`,
    `EducationInput = { school: string; major: string; startDate: string; endDate: string }`,
    `SkillInput = { name: string; level: string }`,
    `ProjectInput = { name: string; description: string; tech: string; link: string }`.
  - Từ `lib/cv/normalize.ts`: `normalizeCv(input: CvInput): CvInput` — trim mọi chuỗi, loại bỏ các dòng rỗng hoàn toàn trong experiences/educations/skills/projects.
  - Từ `lib/cv/schema.ts`: `cvSchema` (Zod) validate `CvInput`, và `emptyCv(): CvInput` trả về CV rỗng mẫu.

- [ ] **Step 1: Tạo types**

Create `lib/cv/types.ts`:
```ts
export type ProfileInput = {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  summary: string;
};

export type ExperienceInput = {
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  description: string;
};

export type EducationInput = {
  school: string;
  major: string;
  startDate: string;
  endDate: string;
};

export type SkillInput = { name: string; level: string };

export type ProjectInput = {
  name: string;
  description: string;
  tech: string;
  link: string;
};

export type CvInput = {
  title: string;
  profile: ProfileInput;
  experiences: ExperienceInput[];
  educations: EducationInput[];
  skills: SkillInput[];
  projects: ProjectInput[];
};
```

- [ ] **Step 2: Viết test cho normalize (failing)**

Create `lib/cv/__tests__/normalize.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { normalizeCv } from "../normalize";
import type { CvInput } from "../types";

const base: CvInput = {
  title: "  CV của tôi  ",
  profile: { fullName: "  Manh  ", headline: "", email: "", phone: "", summary: "" },
  experiences: [
    { company: "  FPT  ", position: "Dev", startDate: "", endDate: "", description: "" },
    { company: "", position: "", startDate: "", endDate: "", description: "" },
  ],
  educations: [{ school: "", major: "", startDate: "", endDate: "" }],
  skills: [{ name: "  React  ", level: "" }, { name: "", level: "" }],
  projects: [{ name: "", description: "", tech: "", link: "" }],
};

describe("normalizeCv", () => {
  it("trim cac chuoi", () => {
    const r = normalizeCv(base);
    expect(r.title).toBe("CV của tôi");
    expect(r.profile.fullName).toBe("Manh");
    expect(r.experiences[0].company).toBe("FPT");
    expect(r.skills[0].name).toBe("React");
  });

  it("loai bo dong rong hoan toan", () => {
    const r = normalizeCv(base);
    expect(r.experiences).toHaveLength(1);
    expect(r.educations).toHaveLength(0);
    expect(r.skills).toHaveLength(1);
    expect(r.projects).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Chạy test để xác nhận FAIL**

Run: `npx vitest run lib/cv/__tests__/normalize.test.ts`
Expected: FAIL "Cannot find module '../normalize'".

- [ ] **Step 4: Viết normalize.ts**

Create `lib/cv/normalize.ts`:
```ts
import type {
  CvInput,
  EducationInput,
  ExperienceInput,
  ProjectInput,
  SkillInput,
} from "./types";

const t = (s: string) => s.trim();

function notEmpty(values: string[]): boolean {
  return values.some((v) => t(v).length > 0);
}

export function normalizeCv(input: CvInput): CvInput {
  return {
    title: t(input.title),
    profile: {
      fullName: t(input.profile.fullName),
      headline: t(input.profile.headline),
      email: t(input.profile.email),
      phone: t(input.profile.phone),
      summary: t(input.profile.summary),
    },
    experiences: input.experiences
      .map(
        (e): ExperienceInput => ({
          company: t(e.company),
          position: t(e.position),
          startDate: t(e.startDate),
          endDate: t(e.endDate),
          description: t(e.description),
        }),
      )
      .filter((e) =>
        notEmpty([e.company, e.position, e.startDate, e.endDate, e.description]),
      ),
    educations: input.educations
      .map(
        (e): EducationInput => ({
          school: t(e.school),
          major: t(e.major),
          startDate: t(e.startDate),
          endDate: t(e.endDate),
        }),
      )
      .filter((e) => notEmpty([e.school, e.major, e.startDate, e.endDate])),
    skills: input.skills
      .map((s): SkillInput => ({ name: t(s.name), level: t(s.level) }))
      .filter((s) => notEmpty([s.name, s.level])),
    projects: input.projects
      .map(
        (p): ProjectInput => ({
          name: t(p.name),
          description: t(p.description),
          tech: t(p.tech),
          link: t(p.link),
        }),
      )
      .filter((p) => notEmpty([p.name, p.description, p.tech, p.link])),
  };
}
```

- [ ] **Step 5: Chạy test để xác nhận PASS**

Run: `npx vitest run lib/cv/__tests__/normalize.test.ts`
Expected: 2 test PASS.

- [ ] **Step 6: Viết test cho schema (failing)**

Create `lib/cv/__tests__/schema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { cvSchema, emptyCv } from "../schema";

describe("cvSchema", () => {
  it("chap nhan CV hop le", () => {
    const r = cvSchema.safeParse({
      title: "CV",
      profile: { fullName: "Manh", headline: "", email: "", phone: "", summary: "" },
      experiences: [{ company: "FPT", position: "Dev", startDate: "", endDate: "", description: "" }],
      educations: [],
      skills: [{ name: "React", level: "" }],
      projects: [],
    });
    expect(r.success).toBe(true);
  });

  it("tu choi khi thieu fullName", () => {
    const r = cvSchema.safeParse({
      title: "CV",
      profile: { fullName: "", headline: "", email: "", phone: "", summary: "" },
      experiences: [],
      educations: [],
      skills: [],
      projects: [],
    });
    expect(r.success).toBe(false);
  });

  it("tu choi experience thieu company", () => {
    const r = cvSchema.safeParse({
      title: "CV",
      profile: { fullName: "Manh", headline: "", email: "", phone: "", summary: "" },
      experiences: [{ company: "", position: "Dev", startDate: "", endDate: "", description: "" }],
      educations: [],
      skills: [],
      projects: [],
    });
    expect(r.success).toBe(false);
  });

  it("emptyCv tra ve CV rong hop le ve cau truc", () => {
    const e = emptyCv();
    expect(e.profile.fullName).toBe("");
    expect(e.experiences).toEqual([]);
    expect(e.skills).toEqual([]);
  });
});
```

- [ ] **Step 7: Chạy test để xác nhận FAIL**

Run: `npx vitest run lib/cv/__tests__/schema.test.ts`
Expected: FAIL "Cannot find module '../schema'".

- [ ] **Step 8: Viết schema.ts**

Create `lib/cv/schema.ts`:
```ts
import { z } from "zod";
import type { CvInput } from "./types";

const profileSchema = z.object({
  fullName: z.string().min(1, "Vui lòng nhập họ tên"),
  headline: z.string(),
  email: z.string(),
  phone: z.string(),
  summary: z.string(),
});

const experienceSchema = z.object({
  company: z.string().min(1, "Thiếu tên công ty"),
  position: z.string().min(1, "Thiếu vị trí"),
  startDate: z.string(),
  endDate: z.string(),
  description: z.string(),
});

const educationSchema = z.object({
  school: z.string().min(1, "Thiếu tên trường"),
  major: z.string(),
  startDate: z.string(),
  endDate: z.string(),
});

const skillSchema = z.object({
  name: z.string().min(1, "Thiếu tên kỹ năng"),
  level: z.string(),
});

const projectSchema = z.object({
  name: z.string().min(1, "Thiếu tên dự án"),
  description: z.string(),
  tech: z.string(),
  link: z.string(),
});

export const cvSchema = z.object({
  title: z.string(),
  profile: profileSchema,
  experiences: z.array(experienceSchema),
  educations: z.array(educationSchema),
  skills: z.array(skillSchema),
  projects: z.array(projectSchema),
});

export function emptyCv(): CvInput {
  return {
    title: "CV chưa đặt tên",
    profile: { fullName: "", headline: "", email: "", phone: "", summary: "" },
    experiences: [],
    educations: [],
    skills: [],
    projects: [],
  };
}
```

- [ ] **Step 9: Chạy toàn bộ test**

Run: `npm test`
Expected: tất cả test PASS (gồm cả test Phase 1).

- [ ] **Step 10: Commit**

```bash
git add lib/cv
git commit -m "feat: add CV Zod schema and normalize with tests"
```

---

### Task 4: Server Actions tạo/xóa CV + danh sách CV trên dashboard

**Files:**
- Create: `lib/cv/actions.ts`
- Modify: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `prisma` từ `@/lib/db/prisma`; `auth` từ `@/auth`; `normalizeCv`, `cvSchema` từ `lib/cv`.
- Produces:
  - `createCv(): Promise<void>` — tạo CV rỗng cho user hiện tại + Profile rỗng, rồi `redirect("/cv/<id>")`.
  - `deleteCv(formData: FormData): Promise<void>` — xóa CV (id lấy từ `formData.get("id")`) nếu thuộc user hiện tại, rồi `revalidatePath("/dashboard")`.
  - `saveCv(cvId: string, input: CvInput): Promise<{ ok: boolean; error?: string }>` — (dùng ở Task 5).

- [ ] **Step 1: Viết actions.ts (createCv + deleteCv + saveCv)**

Create `lib/cv/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { cvSchema } from "./schema";
import { normalizeCv } from "./normalize";
import type { CvInput } from "./types";

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  return userId;
}

export async function createCv(): Promise<void> {
  const userId = await requireUserId();
  const cv = await prisma.cV.create({
    data: {
      userId,
      title: "CV chưa đặt tên",
      profile: { create: { fullName: "" } },
    },
    select: { id: true },
  });
  redirect(`/cv/${cv.id}`);
}

export async function deleteCv(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  await prisma.cV.deleteMany({ where: { id, userId } });
  revalidatePath("/dashboard");
}

export async function saveCv(
  cvId: string,
  input: CvInput,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();

  const owned = await prisma.cV.findFirst({
    where: { id: cvId, userId },
    select: { id: true },
  });
  if (!owned) return { ok: false, error: "Không tìm thấy CV" };

  const data = normalizeCv(input);
  const parsed = cvSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  await prisma.$transaction(async (tx) => {
    await tx.cV.update({
      where: { id: cvId },
      data: { title: data.title || "CV chưa đặt tên" },
    });
    await tx.profile.upsert({
      where: { cvId },
      create: { cvId, ...data.profile },
      update: { ...data.profile },
    });

    await tx.experience.deleteMany({ where: { cvId } });
    await tx.experience.createMany({
      data: data.experiences.map((e, i) => ({ ...e, cvId, order: i })),
    });

    await tx.education.deleteMany({ where: { cvId } });
    await tx.education.createMany({
      data: data.educations.map((e, i) => ({ ...e, cvId, order: i })),
    });

    await tx.skill.deleteMany({ where: { cvId } });
    await tx.skill.createMany({
      data: data.skills.map((s, i) => ({ ...s, cvId, order: i })),
    });

    await tx.project.deleteMany({ where: { cvId } });
    await tx.project.createMany({
      data: data.projects.map((p, i) => ({ ...p, cvId, order: i })),
    });
  });

  revalidatePath(`/cv/${cvId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
```

- [ ] **Step 2: Bổ sung `id` vào session (nếu chưa có)**

Auth.js JWT mặc định KHÔNG đưa `user.id` vào session. Cần thêm callbacks trong `auth.ts` để `session.user.id` có giá trị. Mở `auth.ts` và thêm khối `callbacks` vào object cấu hình `NextAuth({ ... })` (ngay sau `providers: [...]`):
```ts
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
```

- [ ] **Step 3: Khai báo type cho `session.user.id`**

Create `types/next-auth.d.ts`:
```ts
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}
```

- [ ] **Step 4: Viết lại dashboard hiển thị danh sách CV**

Replace nội dung `app/dashboard/page.tsx`:
```tsx
import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import { createCv, deleteCv } from "@/lib/cv/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cvs = await prisma.cV.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
  });

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Xin chào, {session.user.name}</h1>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button variant="outline" size="sm">Đăng xuất</Button>
        </form>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">CV của bạn</h2>
        <form action={createCv}>
          <Button type="submit">+ Tạo CV mới</Button>
        </form>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {cvs.length === 0 && (
          <p className="text-gray-500">Chưa có CV nào. Bấm “Tạo CV mới” để bắt đầu.</p>
        )}
        {cvs.map((cv) => (
          <Card key={cv.id}>
            <CardContent className="flex items-center justify-between py-4">
              <Link href={`/cv/${cv.id}`} className="font-medium hover:underline">
                {cv.title}
              </Link>
              <form action={deleteCv}>
                <input type="hidden" name="id" value={cv.id} />
                <Button variant="ghost" size="sm" type="submit">Xóa</Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Kiểm tra type + build**

Run: `npx tsc --noEmit && npm run build`
Expected: không lỗi type, build thành công.

- [ ] **Step 6: Commit**

```bash
git add lib/cv/actions.ts app/dashboard/page.tsx auth.ts types/next-auth.d.ts
git commit -m "feat: add CV create/delete actions and dashboard list"
```

---

### Task 5: Trang sửa CV `/cv/[id]` + lưu cả CV

**Files:**
- Create: `app/cv/[id]/page.tsx` (server component nạp dữ liệu)
- Create: `app/cv/[id]/CvEditor.tsx` (client component: form nhiều card)

**Interfaces:**
- Consumes: `saveCv` từ `@/lib/cv/actions`; `CvInput` từ `@/lib/cv/types`; `auth`, `prisma`; component shadcn.
- Produces: luồng sửa + lưu CV hoạt động; nút "Xuất PDF" trỏ tới `/api/cv/[id]/pdf` (route làm ở Task 6).

- [ ] **Step 1: Viết server component nạp CV**

Create `app/cv/[id]/page.tsx`:
```tsx
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/db/prisma";
import type { CvInput } from "@/lib/cv/types";
import CvEditor from "./CvEditor";

export default async function CvPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cv = await prisma.cV.findFirst({
    where: { id, userId: session.user.id },
    include: {
      profile: true,
      experiences: { orderBy: { order: "asc" } },
      educations: { orderBy: { order: "asc" } },
      skills: { orderBy: { order: "asc" } },
      projects: { orderBy: { order: "asc" } },
    },
  });
  if (!cv) notFound();

  const initial: CvInput = {
    title: cv.title,
    profile: {
      fullName: cv.profile?.fullName ?? "",
      headline: cv.profile?.headline ?? "",
      email: cv.profile?.email ?? "",
      phone: cv.profile?.phone ?? "",
      summary: cv.profile?.summary ?? "",
    },
    experiences: cv.experiences.map((e) => ({
      company: e.company,
      position: e.position,
      startDate: e.startDate,
      endDate: e.endDate,
      description: e.description,
    })),
    educations: cv.educations.map((e) => ({
      school: e.school,
      major: e.major,
      startDate: e.startDate,
      endDate: e.endDate,
    })),
    skills: cv.skills.map((s) => ({ name: s.name, level: s.level })),
    projects: cv.projects.map((p) => ({
      name: p.name,
      description: p.description,
      tech: p.tech,
      link: p.link,
    })),
  };

  return <CvEditor cvId={cv.id} initial={initial} />;
}
```

- [ ] **Step 2: Viết client component CvEditor**

Create `app/cv/[id]/CvEditor.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { saveCv } from "@/lib/cv/actions";
import type { CvInput } from "@/lib/cv/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CvEditor({
  cvId,
  initial,
}: {
  cvId: string;
  initial: CvInput;
}) {
  const [cv, setCv] = useState<CvInput>(initial);
  const [pending, startTransition] = useTransition();

  function setProfile<K extends keyof CvInput["profile"]>(
    key: K,
    value: string,
  ) {
    setCv((c) => ({ ...c, profile: { ...c.profile, [key]: value } }));
  }

  // Helpers cho danh sách (experiences/educations/skills/projects)
  function addRow<T>(key: keyof CvInput, empty: T) {
    setCv((c) => ({ ...c, [key]: [...(c[key] as T[]), empty] }));
  }
  function removeRow(key: keyof CvInput, idx: number) {
    setCv((c) => ({
      ...c,
      [key]: (c[key] as unknown[]).filter((_, i) => i !== idx),
    }));
  }
  function setRow<T>(key: keyof CvInput, idx: number, field: keyof T, value: string) {
    setCv((c) => ({
      ...c,
      [key]: (c[key] as T[]).map((row, i) =>
        i === idx ? { ...row, [field]: value } : row,
      ),
    }));
  }

  function onSave() {
    startTransition(async () => {
      const res = await saveCv(cvId, cv);
      if (res.ok) toast.success("Đã lưu CV");
      else toast.error(res.error ?? "Lưu thất bại");
    });
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm underline">← Về dashboard</Link>
        <div className="flex gap-2">
          <a href={`/api/cv/${cvId}/pdf`}>
            <Button variant="outline">Xuất PDF</Button>
          </a>
          <Button onClick={onSave} disabled={pending}>
            {pending ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </div>

      <Input
        className="mb-4 text-lg font-semibold"
        value={cv.title}
        onChange={(e) => setCv((c) => ({ ...c, title: e.target.value }))}
        placeholder="Tên CV"
      />

      {/* Profile */}
      <Card className="mb-4">
        <CardHeader><CardTitle>Thông tin cá nhân</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <div><Label>Họ tên</Label>
            <Input value={cv.profile.fullName} onChange={(e) => setProfile("fullName", e.target.value)} /></div>
          <div><Label>Chức danh</Label>
            <Input value={cv.profile.headline} onChange={(e) => setProfile("headline", e.target.value)} /></div>
          <div><Label>Email</Label>
            <Input value={cv.profile.email} onChange={(e) => setProfile("email", e.target.value)} /></div>
          <div><Label>Điện thoại</Label>
            <Input value={cv.profile.phone} onChange={(e) => setProfile("phone", e.target.value)} /></div>
          <div><Label>Giới thiệu bản thân</Label>
            <Textarea value={cv.profile.summary} onChange={(e) => setProfile("summary", e.target.value)} /></div>
        </CardContent>
      </Card>

      {/* Experiences */}
      <Card className="mb-4">
        <CardHeader><CardTitle>Kinh nghiệm làm việc</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          {cv.experiences.map((e, i) => (
            <div key={i} className="grid gap-2 border-b pb-3 last:border-0">
              <Input placeholder="Công ty" value={e.company}
                onChange={(ev) => setRow<CvInput["experiences"][number]>("experiences", i, "company", ev.target.value)} />
              <Input placeholder="Vị trí" value={e.position}
                onChange={(ev) => setRow<CvInput["experiences"][number]>("experiences", i, "position", ev.target.value)} />
              <div className="flex gap-2">
                <Input placeholder="Từ (2023-01)" value={e.startDate}
                  onChange={(ev) => setRow<CvInput["experiences"][number]>("experiences", i, "startDate", ev.target.value)} />
                <Input placeholder="Đến (2024-06)" value={e.endDate}
                  onChange={(ev) => setRow<CvInput["experiences"][number]>("experiences", i, "endDate", ev.target.value)} />
              </div>
              <Textarea placeholder="Mô tả công việc" value={e.description}
                onChange={(ev) => setRow<CvInput["experiences"][number]>("experiences", i, "description", ev.target.value)} />
              <Button variant="ghost" size="sm" className="justify-self-start"
                onClick={() => removeRow("experiences", i)}>Xóa</Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="justify-self-start"
            onClick={() => addRow("experiences", { company: "", position: "", startDate: "", endDate: "", description: "" })}>
            + Thêm kinh nghiệm
          </Button>
        </CardContent>
      </Card>

      {/* Educations */}
      <Card className="mb-4">
        <CardHeader><CardTitle>Học vấn</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          {cv.educations.map((e, i) => (
            <div key={i} className="grid gap-2 border-b pb-3 last:border-0">
              <Input placeholder="Trường" value={e.school}
                onChange={(ev) => setRow<CvInput["educations"][number]>("educations", i, "school", ev.target.value)} />
              <Input placeholder="Ngành" value={e.major}
                onChange={(ev) => setRow<CvInput["educations"][number]>("educations", i, "major", ev.target.value)} />
              <div className="flex gap-2">
                <Input placeholder="Từ" value={e.startDate}
                  onChange={(ev) => setRow<CvInput["educations"][number]>("educations", i, "startDate", ev.target.value)} />
                <Input placeholder="Đến" value={e.endDate}
                  onChange={(ev) => setRow<CvInput["educations"][number]>("educations", i, "endDate", ev.target.value)} />
              </div>
              <Button variant="ghost" size="sm" className="justify-self-start"
                onClick={() => removeRow("educations", i)}>Xóa</Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="justify-self-start"
            onClick={() => addRow("educations", { school: "", major: "", startDate: "", endDate: "" })}>
            + Thêm học vấn
          </Button>
        </CardContent>
      </Card>

      {/* Skills */}
      <Card className="mb-4">
        <CardHeader><CardTitle>Kỹ năng</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          {cv.skills.map((s, i) => (
            <div key={i} className="flex gap-2">
              <Input placeholder="Tên kỹ năng" value={s.name}
                onChange={(ev) => setRow<CvInput["skills"][number]>("skills", i, "name", ev.target.value)} />
              <Input placeholder="Mức độ" value={s.level}
                onChange={(ev) => setRow<CvInput["skills"][number]>("skills", i, "level", ev.target.value)} />
              <Button variant="ghost" size="sm" onClick={() => removeRow("skills", i)}>Xóa</Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="justify-self-start"
            onClick={() => addRow("skills", { name: "", level: "" })}>
            + Thêm kỹ năng
          </Button>
        </CardContent>
      </Card>

      {/* Projects */}
      <Card className="mb-4">
        <CardHeader><CardTitle>Dự án</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          {cv.projects.map((p, i) => (
            <div key={i} className="grid gap-2 border-b pb-3 last:border-0">
              <Input placeholder="Tên dự án" value={p.name}
                onChange={(ev) => setRow<CvInput["projects"][number]>("projects", i, "name", ev.target.value)} />
              <Textarea placeholder="Mô tả" value={p.description}
                onChange={(ev) => setRow<CvInput["projects"][number]>("projects", i, "description", ev.target.value)} />
              <Input placeholder="Công nghệ (React, Node...)" value={p.tech}
                onChange={(ev) => setRow<CvInput["projects"][number]>("projects", i, "tech", ev.target.value)} />
              <Input placeholder="Link" value={p.link}
                onChange={(ev) => setRow<CvInput["projects"][number]>("projects", i, "link", ev.target.value)} />
              <Button variant="ghost" size="sm" className="justify-self-start"
                onClick={() => removeRow("projects", i)}>Xóa</Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="justify-self-start"
            onClick={() => addRow("projects", { name: "", description: "", tech: "", link: "" })}>
            + Thêm dự án
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 3: Kiểm tra type + build**

Run: `npx tsc --noEmit && npm run build`
Expected: không lỗi type, build thành công.

- [ ] **Step 4: Kiểm tra thủ công (cần đăng nhập)**

```bash
npm run dev
```
1. Đăng nhập → dashboard → "Tạo CV mới" → vào `/cv/<id>`.
2. Nhập họ tên, thêm 1 kinh nghiệm (công ty + vị trí), 1 kỹ năng → bấm **Lưu** → thấy toast "Đã lưu CV".
3. Tải lại trang → dữ liệu vẫn còn (đã lưu DB).
4. Về dashboard → thấy CV; bấm Xóa → CV biến mất.

- [ ] **Step 5: Commit**

```bash
git add app/cv
git commit -m "feat: add CV editor page with save"
```

---

### Task 6: Xuất PDF (react-pdf) hỗ trợ tiếng Việt

**Files:**
- Create: `lib/pdf/fonts/Roboto-Regular.ttf`, `lib/pdf/fonts/Roboto-Bold.ttf` (tải về)
- Create: `lib/pdf/CvDocument.tsx`
- Create: `app/api/cv/[id]/pdf/route.ts`

**Interfaces:**
- Consumes: `prisma`, `auth`; dữ liệu CV từ DB.
- Produces: `GET /api/cv/[id]/pdf` trả file PDF tải về.

- [ ] **Step 1: Cài @react-pdf/renderer**

```bash
npm install @react-pdf/renderer
```

- [ ] **Step 2: Tải font Roboto (hỗ trợ tiếng Việt)**

Font mặc định của react-pdf (Helvetica) KHÔNG hiển thị được dấu tiếng Việt. Tải Roboto:
```bash
mkdir -p lib/pdf/fonts
curl -L -o lib/pdf/fonts/Roboto-Regular.ttf https://github.com/google/fonts/raw/main/apache/roboto/static/Roboto-Regular.ttf
curl -L -o lib/pdf/fonts/Roboto-Bold.ttf https://github.com/google/fonts/raw/main/apache/roboto/static/Roboto-Bold.ttf
```
Expected: 2 file `.ttf` xuất hiện, mỗi file vài trăm KB. Kiểm tra: `ls -la lib/pdf/fonts` (không phải file 0 byte / trang HTML lỗi).

- [ ] **Step 3: Viết CvDocument.tsx**

Create `lib/pdf/CvDocument.tsx`:
```tsx
import path from "path";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { CvInput } from "@/lib/cv/types";

Font.register({
  family: "Roboto",
  fonts: [
    { src: path.join(process.cwd(), "lib/pdf/fonts/Roboto-Regular.ttf") },
    { src: path.join(process.cwd(), "lib/pdf/fonts/Roboto-Bold.ttf"), fontWeight: "bold" },
  ],
});

const s = StyleSheet.create({
  page: { fontFamily: "Roboto", fontSize: 11, padding: 40, color: "#111" },
  name: { fontSize: 22, fontWeight: "bold" },
  headline: { fontSize: 12, color: "#555", marginBottom: 2 },
  contact: { fontSize: 10, color: "#555", marginBottom: 12 },
  sectionTitle: {
    fontSize: 13, fontWeight: "bold", marginTop: 14, marginBottom: 6,
    borderBottom: "1 solid #ccc", paddingBottom: 2,
  },
  itemTitle: { fontWeight: "bold" },
  itemSub: { color: "#555", fontSize: 10, marginBottom: 2 },
  text: { marginBottom: 4, lineHeight: 1.4 },
  skillRow: { marginBottom: 2 },
});

function dateRange(a: string, b: string): string {
  if (!a && !b) return "";
  return [a, b].filter(Boolean).join(" - ");
}

export function CvDocument({ cv }: { cv: CvInput }) {
  const p = cv.profile;
  const contact = [p.email, p.phone].filter(Boolean).join("  •  ");
  return (
    <Document>
      <Page style={s.page}>
        <Text style={s.name}>{p.fullName || "Chưa có tên"}</Text>
        {p.headline ? <Text style={s.headline}>{p.headline}</Text> : null}
        {contact ? <Text style={s.contact}>{contact}</Text> : null}
        {p.summary ? <Text style={s.text}>{p.summary}</Text> : null}

        {cv.experiences.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>Kinh nghiệm làm việc</Text>
            {cv.experiences.map((e, i) => (
              <View key={i} wrap={false} style={{ marginBottom: 6 }}>
                <Text style={s.itemTitle}>{e.position} — {e.company}</Text>
                {dateRange(e.startDate, e.endDate) ? (
                  <Text style={s.itemSub}>{dateRange(e.startDate, e.endDate)}</Text>
                ) : null}
                {e.description ? <Text style={s.text}>{e.description}</Text> : null}
              </View>
            ))}
          </View>
        )}

        {cv.educations.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>Học vấn</Text>
            {cv.educations.map((e, i) => (
              <View key={i} wrap={false} style={{ marginBottom: 6 }}>
                <Text style={s.itemTitle}>{e.school}</Text>
                <Text style={s.itemSub}>
                  {[e.major, dateRange(e.startDate, e.endDate)].filter(Boolean).join("  •  ")}
                </Text>
              </View>
            ))}
          </View>
        )}

        {cv.skills.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>Kỹ năng</Text>
            {cv.skills.map((sk, i) => (
              <Text key={i} style={s.skillRow}>
                • {sk.name}{sk.level ? ` (${sk.level})` : ""}
              </Text>
            ))}
          </View>
        )}

        {cv.projects.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>Dự án</Text>
            {cv.projects.map((pr, i) => (
              <View key={i} wrap={false} style={{ marginBottom: 6 }}>
                <Text style={s.itemTitle}>{pr.name}</Text>
                {pr.tech ? <Text style={s.itemSub}>{pr.tech}</Text> : null}
                {pr.description ? <Text style={s.text}>{pr.description}</Text> : null}
                {pr.link ? <Text style={s.itemSub}>{pr.link}</Text> : null}
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
```

- [ ] **Step 4: Viết route xuất PDF**

Create `app/api/cv/[id]/pdf/route.ts`:
```ts
import { renderToBuffer } from "@react-pdf/renderer";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { CvDocument } from "@/lib/pdf/CvDocument";
import type { CvInput } from "@/lib/cv/types";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Chưa đăng nhập", { status: 401 });
  }

  const cv = await prisma.cV.findFirst({
    where: { id, userId: session.user.id },
    include: {
      profile: true,
      experiences: { orderBy: { order: "asc" } },
      educations: { orderBy: { order: "asc" } },
      skills: { orderBy: { order: "asc" } },
      projects: { orderBy: { order: "asc" } },
    },
  });
  if (!cv) return new Response("Không tìm thấy CV", { status: 404 });

  const data: CvInput = {
    title: cv.title,
    profile: {
      fullName: cv.profile?.fullName ?? "",
      headline: cv.profile?.headline ?? "",
      email: cv.profile?.email ?? "",
      phone: cv.profile?.phone ?? "",
      summary: cv.profile?.summary ?? "",
    },
    experiences: cv.experiences.map((e) => ({
      company: e.company, position: e.position,
      startDate: e.startDate, endDate: e.endDate, description: e.description,
    })),
    educations: cv.educations.map((e) => ({
      school: e.school, major: e.major, startDate: e.startDate, endDate: e.endDate,
    })),
    skills: cv.skills.map((sk) => ({ name: sk.name, level: sk.level })),
    projects: cv.projects.map((pr) => ({
      name: pr.name, description: pr.description, tech: pr.tech, link: pr.link,
    })),
  };

  const buffer = await renderToBuffer(<CvDocument cv={data} />);
  const safeTitle = (cv.title || "cv").replace(/[^a-zA-Z0-9-_]+/g, "_");

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeTitle}.pdf"`,
    },
  });
}
```

- [ ] **Step 5: Kiểm tra type + build**

Run: `npx tsc --noEmit && npm run build`
Expected: không lỗi. (Route dùng JSX trong `.tsx`? Không — route là `.ts` nhưng có JSX `<CvDocument />`. Đổi phần mở rộng file route thành đúng: file PHẢI là `app/api/cv/[id]/pdf/route.tsx` để chứa JSX.)

> **Lưu ý quan trọng:** vì route handler dùng JSX (`<CvDocument .../>`), đặt tên file là **`route.tsx`** (không phải `route.ts`). Nếu đã tạo `route.ts`, đổi tên: `git mv app/api/cv/[id]/pdf/route.ts app/api/cv/[id]/pdf/route.tsx` (hoặc `mv` nếu chưa track).

- [ ] **Step 6: Kiểm tra thủ công tải PDF**

```bash
npm run dev
```
1. Đăng nhập → mở một CV đã có dữ liệu (họ tên có dấu tiếng Việt, vd "Nguyễn Đức Mạnh").
2. Bấm **Xuất PDF** → file `.pdf` tải về.
3. Mở file: kiểm tra **tiếng Việt hiển thị đúng dấu**, các mục Kinh nghiệm/Học vấn/Kỹ năng/Dự án hiện đầy đủ.

- [ ] **Step 7: Commit**

```bash
git add lib/pdf app/api/cv package.json package-lock.json
git commit -m "feat: add CV PDF export with Vietnamese font support"
```

---

## Self-Review

**Spec coverage:**
- Model `CV` + 5 model con, `onDelete: Cascade`, ngày dạng chuỗi, `order` → Task 1. ✓
- shadcn/ui (Input, Textarea, Button, Card, Label, Toaster) → Task 2. ✓
- `cvSchema` (Zod dùng chung), quy tắc validate tối thiểu, chuẩn hóa/loại dòng rỗng, TDD → Task 3. ✓
- Server Actions createCv/deleteCv/saveCv, transaction "xóa rồi tạo lại", kiểm tra quyền → Task 4. ✓
- Danh sách CV trên dashboard (tạo/mở/xóa) → Task 4. ✓
- Trang sửa `/cv/[id]`, một trang nhiều card, Thêm/Xóa dòng, lưu cả CV, toast → Task 5. ✓
- Xuất PDF react-pdf, template sạch, route trả file, kiểm tra quyền, hỗ trợ tiếng Việt → Task 6. ✓
- Chỉ chủ sở hữu truy cập (session `userId`) → Task 4, 5, 6. ✓
- Test TDD cho logic thuần (schema, normalize); không E2E → Task 3 + kiểm tra thủ công. ✓

*(Mục 10 spec — nâng cấp UI Phase 1 sang shadcn — đánh dấu "tùy chọn", cố ý bỏ khỏi plan này để giữ phạm vi gọn; làm sau nếu muốn.)*

**Placeholder scan:** Không có TBD/TODO; mọi step có code hoặc lệnh cụ thể. ✓

**Type consistency:** `CvInput` và các type con (`ProfileInput`, `ExperienceInput`, ...) định nghĩa ở Task 3, dùng nhất quán ở Task 4, 5, 6. `saveCv(cvId, input)`, `createCv()`, `deleteCv(formData)` khai báo ở Task 4, dùng đúng ở Task 4, 5. `CvDocument({ cv })` định nghĩa Task 6, dùng trong route Task 6. `session.user.id` bổ sung ở Task 4 (callbacks + `types/next-auth.d.ts`), dùng ở Task 4, 5, 6. ✓

**Lưu ý runtime đã tính:** Next 16 `params` là Promise (await ở Task 5, 6); file route chứa JSX phải là `.tsx` (Task 6 Step 5); font tiếng Việt cho PDF (Task 6 Step 2).
