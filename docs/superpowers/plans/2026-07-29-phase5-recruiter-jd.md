# Phase 5: Nhà tuyển dụng đăng JD — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho NTD đăng JD công khai và ứng viên duyệt JD rồi đánh giá CV vào JD đó (tái dùng Phase 3), phân biệt vai trò từ lúc đăng ký.

**Architecture:** Thêm `isPublic` vào `JobDescription`; đăng ký chọn vai trò (`role`), đưa `role` vào session. Dashboard nhận biết vai trò. NTD đăng/xóa JD bằng Server Actions. Ứng viên xem `/jobs`, `/jobs/[id]`, chọn CV → gọi lại API đánh giá Phase 3. Logic thuần (schema đăng ký) test theo TDD.

**Tech Stack:** Next.js 16, TypeScript, Prisma 6, PostgreSQL (Neon), Auth.js v5, Zod, shadcn/ui, Vitest.

## Global Constraints

- Ngôn ngữ: TypeScript, `strict`.
- **Prisma giữ v6**; lệnh DB qua `npm run db:push` (ép IPv4). Nếu `npx prisma` lỗi P1001 → thêm `NODE_OPTIONS=--dns-result-order=ipv4first`. Nếu `generate` EPERM → dừng node rồi `npx prisma generate`.
- Next.js 16: `params` route/page động là `Promise` — `await params`.
- Vai trò: `CANDIDATE | RECRUITER` (enum `Role` đã có).
- JD công khai: `isPublic = true`; JD ứng viên tự dán (Phase 3) giữ `false`.
- Kiểm tra quyền: chỉ NTD đăng/xóa JD của mình; ứng viên chỉ đánh giá CV của mình.
- **Tái dùng Phase 3**: đánh giá JD công khai gọi lại API `/api/cv/[cvId]/evaluate` (không sửa route đó).
- Mỗi task kết thúc bằng một commit; test cũ vẫn PASS.

---

### Task 1: Thêm `isPublic` vào JobDescription

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: model `JobDescription` đã có.
- Produces: trường `isPublic Boolean @default(false)` trên `JobDescription`.

- [ ] **Step 1: Thêm trường**

Trong `model JobDescription`, thêm dòng sau `rawText String`:
```prisma
  isPublic    Boolean      @default(false)
```

- [ ] **Step 2: Đẩy schema + kiểm tra type**

```bash
npm run db:push
npx tsc --noEmit
```
Expected: "in sync"; không lỗi type. (Nếu `generate` EPERM: dừng node rồi `npx prisma generate`.)

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add isPublic to JobDescription"
```

---

### Task 2: Đăng ký có vai trò (TDD)

**Files:**
- Modify: `lib/auth/validation.ts`
- Modify: `lib/auth/register.ts`
- Modify: `lib/auth/__tests__/validation.test.ts`
- Modify: `lib/auth/__tests__/register.test.ts`
- Modify: `app/register/page.tsx`
- (API `app/api/register/route.ts` KHÔNG cần sửa — `data` truyền thẳng đã gồm `role`.)

**Interfaces:**
- Consumes: (không có)
- Produces:
  - `registerSchema` có thêm `role: "CANDIDATE" | "RECRUITER"` (mặc định `"CANDIDATE"`); `RegisterInput` gồm `role`.
  - `RegisterDeps.create` nhận thêm `role`; `registerUser` truyền `role`.

- [ ] **Step 1: Cập nhật test validation (thêm role)**

Trong `lib/auth/__tests__/validation.test.ts`, thêm vào cuối `describe("registerSchema", ...)` (trước dấu `})` đóng describe):
```ts
  it("mac dinh role la CANDIDATE khi thieu", () => {
    const r = registerSchema.safeParse({
      email: "a@b.com", name: "Manh", password: "matkhau123",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.role).toBe("CANDIDATE");
  });

  it("chap nhan role RECRUITER", () => {
    const r = registerSchema.safeParse({
      email: "a@b.com", name: "Manh", password: "matkhau123", role: "RECRUITER",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.role).toBe("RECRUITER");
  });

  it("tu choi role khong hop le", () => {
    const r = registerSchema.safeParse({
      email: "a@b.com", name: "Manh", password: "matkhau123", role: "ADMIN",
    });
    expect(r.success).toBe(false);
  });
```

- [ ] **Step 2: Chạy test xác nhận FAIL**

Run: `npx vitest run lib/auth/__tests__/validation.test.ts`
Expected: FAIL (role chưa có trong schema → `r.data.role` undefined / role RECRUITER không được giữ).

- [ ] **Step 3: Thêm role vào registerSchema**

Replace nội dung `lib/auth/validation.ts`:
```ts
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  name: z.string().min(1, "Tên không được để trống"),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
  role: z.enum(["CANDIDATE", "RECRUITER"]).default("CANDIDATE"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
```

- [ ] **Step 4: Chạy test validation xác nhận PASS**

Run: `npx vitest run lib/auth/__tests__/validation.test.ts`
Expected: tất cả PASS.

- [ ] **Step 5: Cập nhật test register (create nhận role)**

Trong `lib/auth/__tests__/register.test.ts`, sửa assertion trong test "tao user moi khi email chua ton tai":
```ts
    expect(d.create).toHaveBeenCalledWith({
      email: "a@b.com", name: "Manh", passwordHash: "hashed",
    });
```
thành:
```ts
    expect(d.create).toHaveBeenCalledWith({
      email: "a@b.com", name: "Manh", passwordHash: "hashed", role: "CANDIDATE",
    });
```

- [ ] **Step 6: Chạy test register xác nhận FAIL**

Run: `npx vitest run lib/auth/__tests__/register.test.ts`
Expected: FAIL (create chưa truyền role).

- [ ] **Step 7: Cập nhật register.ts truyền role**

Replace nội dung `lib/auth/register.ts`:
```ts
import { registerSchema, type RegisterInput } from "./validation";

export type RegisterDeps = {
  findByEmail: (email: string) => Promise<{ id: string } | null>;
  create: (data: {
    email: string;
    name: string;
    passwordHash: string;
    role: "CANDIDATE" | "RECRUITER";
  }) => Promise<{ id: string }>;
  hash: (p: string) => Promise<string>;
};

export type RegisterResult =
  | { ok: true; userId: string }
  | { ok: false; error: string };

export async function registerUser(
  input: RegisterInput,
  deps: RegisterDeps,
): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { email, name, password, role } = parsed.data;

  const existing = await deps.findByEmail(email);
  if (existing) return { ok: false, error: "Email đã được đăng ký" };

  const passwordHash = await deps.hash(password);
  const user = await deps.create({ email, name, passwordHash, role });
  return { ok: true, userId: user.id };
}
```

- [ ] **Step 8: Chạy toàn bộ test xác nhận PASS**

Run: `npm test`
Expected: tất cả PASS.

- [ ] **Step 9: Thêm chọn vai trò vào form đăng ký**

Trong `app/register/page.tsx`:

(a) Trong hàm `onSubmit`, thêm `role` vào body `fetch`. Đổi khối:
```tsx
      body: JSON.stringify({
        email: form.get("email"),
        name: form.get("name"),
        password: form.get("password"),
      }),
```
thành:
```tsx
      body: JSON.stringify({
        email: form.get("email"),
        name: form.get("name"),
        password: form.get("password"),
        role: form.get("role"),
      }),
```

(b) Thêm ô chọn vai trò vào form, ngay trước dòng `{error && ...}`:
```tsx
            <select
              name="role"
              defaultValue="CANDIDATE"
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="CANDIDATE">Tôi là Ứng viên</option>
              <option value="RECRUITER">Tôi là Nhà tuyển dụng</option>
            </select>
```

- [ ] **Step 10: Build + commit**

```bash
npx tsc --noEmit && npm run build
git add lib/auth app/register/page.tsx
git commit -m "feat: add role selection to registration"
```

---

### Task 3: Vai trò trong session + dashboard theo vai trò + đăng/xóa JD (NTD)

**Files:**
- Modify: `auth.ts` (đưa role vào token/session)
- Modify: `types/next-auth.d.ts` (khai báo role)
- Modify: `app/dashboard/page.tsx` (nhận biết vai trò)
- Create: `lib/jobs/actions.ts`
- Create: `app/jobs/new/page.tsx`
- Modify: `components/Navbar.tsx` (thêm link "Việc làm")

**Interfaces:**
- Consumes: `auth`, `prisma`, shadcn, `Navbar`.
- Produces:
  - `session.user.role: "CANDIDATE" | "RECRUITER"`.
  - `createJobDescription(formData: FormData): Promise<void>`, `deleteJobDescription(formData: FormData): Promise<void>` từ `lib/jobs/actions.ts`.

- [ ] **Step 1: Đưa role vào authorize + callbacks**

Trong `auth.ts`:

(a) Đổi dòng return trong `authorize`:
```ts
        return { id: user.id, email: user.email, name: user.name };
```
thành:
```ts
        return { id: user.id, email: user.email, name: user.name, role: user.role };
```

(b) Đổi khối `callbacks`:
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
thành:
```ts
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: "CANDIDATE" | "RECRUITER" }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as "CANDIDATE" | "RECRUITER") ?? "CANDIDATE";
      }
      return session;
    },
  },
```

- [ ] **Step 2: Khai báo role trong type session**

Replace nội dung `types/next-auth.d.ts`:
```ts
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: "CANDIDATE" | "RECRUITER" } & DefaultSession["user"];
  }
}
```

- [ ] **Step 3: Viết Server Actions cho JD**

Create `lib/jobs/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";

export async function createJobDescription(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "RECRUITER") redirect("/dashboard");

  const title = String(formData.get("title") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const rawText = String(formData.get("rawText") ?? "").trim();
  if (!rawText) redirect("/jobs/new");

  await prisma.jobDescription.create({
    data: { userId: session.user.id, title, company, rawText, isPublic: true },
  });
  redirect("/dashboard");
}

export async function deleteJobDescription(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const id = String(formData.get("id") ?? "");
  await prisma.jobDescription.deleteMany({ where: { id, userId: session.user.id } });
  revalidatePath("/dashboard");
}
```

- [ ] **Step 4: Dashboard nhận biết vai trò**

Replace nội dung `app/dashboard/page.tsx`:
```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, Plus, Briefcase } from "lucide-react";
import prisma from "@/lib/db/prisma";
import { createCv, deleteCv } from "@/lib/cv/actions";
import { deleteJobDescription } from "@/lib/jobs/actions";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const isRecruiter = session.user.role === "RECRUITER";

  if (isRecruiter) {
    const jobs = await prisma.jobDescription.findMany({
      where: { userId: session.user.id, isPublic: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, company: true, createdAt: true },
    });
    return (
      <div className="flex min-h-full flex-col bg-slate-50">
        <Navbar />
        <main className="mx-auto w-full max-w-3xl flex-1 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Tin tuyển dụng của bạn</h1>
              <p className="text-sm text-slate-500">Xin chào, {session.user.name}</p>
            </div>
            <Link href="/jobs/new"><Button><Plus className="mr-1 h-4 w-4" /> Đăng JD</Button></Link>
          </div>
          <div className="flex flex-col gap-3">
            {jobs.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center text-slate-500">
                  Chưa có tin nào. Bấm “Đăng JD” để đăng tin tuyển dụng.
                </CardContent>
              </Card>
            )}
            {jobs.map((j) => (
              <Card key={j.id} className="border-slate-200">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                      <Briefcase className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="font-medium text-slate-900">{j.title || "(chưa có tiêu đề)"}</div>
                      <div className="text-xs text-slate-400">
                        {j.company || "—"} · {new Date(j.createdAt).toLocaleDateString("vi-VN")}
                      </div>
                    </div>
                  </div>
                  <form action={deleteJobDescription}>
                    <input type="hidden" name="id" value={j.id} />
                    <Button variant="ghost" size="sm" type="submit" className="text-slate-500 hover:text-red-600">Xóa</Button>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    );
  }

  const cvs = await prisma.cV.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
  });
  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">CV của bạn</h1>
            <p className="text-sm text-slate-500">Xin chào, {session.user.name}</p>
          </div>
          <form action={createCv}>
            <Button type="submit"><Plus className="mr-1 h-4 w-4" /> Tạo CV mới</Button>
          </form>
        </div>
        <div className="flex flex-col gap-3">
          {cvs.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-slate-500">
                Chưa có CV nào. Bấm “Tạo CV mới” để bắt đầu.
              </CardContent>
            </Card>
          )}
          {cvs.map((cv) => (
            <Card key={cv.id} className="border-slate-200 transition-colors hover:border-blue-300 hover:bg-blue-50/40">
              <CardContent className="flex items-center justify-between py-4">
                <Link href={`/cv/${cv.id}`} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block font-medium text-slate-900 hover:text-blue-600">{cv.title}</span>
                    <span className="block text-xs text-slate-400">
                      Cập nhật {new Date(cv.updatedAt).toLocaleDateString("vi-VN")}
                    </span>
                  </span>
                </Link>
                <form action={deleteCv}>
                  <input type="hidden" name="id" value={cv.id} />
                  <Button variant="ghost" size="sm" type="submit" className="text-slate-500 hover:text-red-600">Xóa</Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Trang đăng JD (NTD)**

Create `app/jobs/new/page.tsx`:
```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { createJobDescription } from "@/lib/jobs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewJobPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "RECRUITER") redirect("/dashboard");

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Về dashboard</Link>
        <Card className="mt-3">
          <CardHeader><CardTitle className="text-blue-700">Đăng tin tuyển dụng</CardTitle></CardHeader>
          <CardContent>
            <form action={createJobDescription} className="grid gap-3">
              <div><Label>Tiêu đề vị trí</Label>
                <Input name="title" placeholder="VD: Frontend Developer" required /></div>
              <div><Label>Công ty</Label>
                <Input name="company" placeholder="VD: ACME" /></div>
              <div><Label>Mô tả công việc (JD)</Label>
                <Textarea name="rawText" rows={10} placeholder="Dán nội dung mô tả công việc..." required /></div>
              <Button type="submit" className="justify-self-start">Đăng tin</Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
```

- [ ] **Step 6: Thêm link "Việc làm" vào Navbar**

Trong `components/Navbar.tsx`, trong nhánh `loggedIn ? (...)`, thêm link trước `<span ...>{session!.user!.name}</span>`:
```tsx
              <Link href="/jobs" className="hidden text-sm font-medium text-slate-600 hover:text-blue-600 sm:inline">
                Việc làm
              </Link>
```

- [ ] **Step 7: Build + commit**

```bash
npx tsc --noEmit && npm run build
git add auth.ts types/next-auth.d.ts app/dashboard/page.tsx lib/jobs/actions.ts app/jobs/new/page.tsx components/Navbar.tsx
git commit -m "feat: recruiter role in session, JD posting, role-aware dashboard"
```

---

### Task 4: Duyệt JD công khai + đánh giá CV vào JD (ứng viên)

**Files:**
- Create: `app/jobs/page.tsx`
- Create: `app/jobs/[id]/page.tsx`
- Create: `app/jobs/[id]/EvaluateFromJob.tsx`

**Interfaces:**
- Consumes: `auth`, `prisma`, `Navbar`, shadcn; API `/api/cv/[cvId]/evaluate` (Phase 3).
- Produces: danh sách JD công khai + trang chi tiết + đánh giá CV vào JD.

- [ ] **Step 1: Danh sách JD công khai**

Create `app/jobs/page.tsx`:
```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";

export default async function JobsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const jobs = await prisma.jobDescription.findMany({
    where: { isPublic: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, company: true, rawText: true, createdAt: true },
  });

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <h1 className="mb-4 text-2xl font-bold text-slate-900">Tin tuyển dụng</h1>
        <div className="flex flex-col gap-3">
          {jobs.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-slate-500">Chưa có tin tuyển dụng nào.</CardContent>
            </Card>
          )}
          {jobs.map((j) => (
            <Link key={j.id} href={`/jobs/${j.id}`}>
              <Card className="border-slate-200 transition-colors hover:border-blue-300 hover:bg-blue-50/40">
                <CardContent className="flex items-start gap-3 py-4">
                  <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <Briefcase className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="font-medium text-slate-900">{j.title || "(chưa có tiêu đề)"}</div>
                    <div className="text-xs text-slate-400">{j.company || "—"}</div>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{j.rawText}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Chi tiết JD + (ứng viên) đánh giá**

Create `app/jobs/[id]/page.tsx`:
```tsx
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EvaluateFromJob from "./EvaluateFromJob";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const job = await prisma.jobDescription.findFirst({
    where: { id, isPublic: true },
    select: { id: true, title: true, company: true, rawText: true },
  });
  if (!job) notFound();

  const isCandidate = session.user.role === "CANDIDATE";
  const cvs = isCandidate
    ? await prisma.cV.findMany({
        where: { userId: session.user.id },
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true },
      })
    : [];

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <Link href="/jobs" className="text-sm text-blue-600 hover:underline">← Về danh sách</Link>
        <Card className="mt-3">
          <CardHeader>
            <CardTitle className="text-blue-700">{job.title || "(chưa có tiêu đề)"}</CardTitle>
            <p className="text-sm text-slate-500">{job.company || "—"}</p>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{job.rawText}</p>
          </CardContent>
        </Card>

        {isCandidate && (
          <EvaluateFromJob
            jobId={job.id}
            jdText={job.rawText}
            jdTitle={job.title}
            jdCompany={job.company}
            cvs={cvs}
          />
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Client đánh giá CV vào JD (tái dùng Phase 3)**

Create `app/jobs/[id]/EvaluateFromJob.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EvaluateFromJob({
  jdText,
  jdTitle,
  jdCompany,
  cvs,
}: {
  jobId: string;
  jdText: string;
  jdTitle: string;
  jdCompany: string;
  cvs: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [cvId, setCvId] = useState(cvs[0]?.id ?? "");
  const [loading, setLoading] = useState(false);

  async function onEvaluate() {
    if (!cvId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cv/${cvId}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdText, jdTitle, jdCompany }),
      });
      if (res.ok) {
        toast.success("Đã đánh giá xong");
        router.push(`/cv/${cvId}/evaluate`);
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Đánh giá thất bại");
      }
    } catch {
      toast.error("Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader><CardTitle className="text-blue-700">Đánh giá CV của bạn với tin này</CardTitle></CardHeader>
      <CardContent className="grid gap-3">
        {cvs.length === 0 ? (
          <p className="text-sm text-slate-500">Bạn chưa có CV nào. Hãy tạo CV trước ở dashboard.</p>
        ) : (
          <>
            <select
              value={cvId}
              onChange={(e) => setCvId(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {cvs.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            <Button onClick={onEvaluate} disabled={loading || !cvId} className="justify-self-start">
              {loading ? "Đang đánh giá..." : "Đánh giá bằng AI"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Build + toàn bộ test**

```bash
npx tsc --noEmit && npm run build && npm test
```
Expected: build sạch; route `/jobs`, `/jobs/[id]`, `/jobs/new` xuất hiện; test **PASS** (số test không đổi so với Task 2 — không thêm test mới ở Task 3–4).

- [ ] **Step 5: Kiểm tra thủ công (2 tài khoản)**

```bash
npm run dev
```
1. Đăng ký một tài khoản **Nhà tuyển dụng** → dashboard hiện "Tin tuyển dụng" → Đăng JD (Frontend Developer...).
2. Đăng xuất, đăng ký một tài khoản **Ứng viên** → tạo CV có dữ liệu.
3. Bấm "Việc làm" (navbar) → thấy JD của NTD → mở JD → chọn CV → "Đánh giá bằng AI" → chuyển tới trang đánh giá, thấy điểm.
4. NTD xóa JD → biến mất khỏi /jobs.

- [ ] **Step 6: Commit**

```bash
git add app/jobs
git commit -m "feat: public job listing and evaluate CV against posted JD"
```

---

## Self-Review

**Spec coverage:**
- `isPublic` trên JobDescription → Task 1. ✓
- Đăng ký chọn vai trò (`registerSchema` + `registerUser` + form) TDD → Task 2. ✓
- Role vào session → Task 3 (auth.ts + type). ✓
- Dashboard nhận biết vai trò → Task 3 Step 4. ✓
- NTD đăng/xóa JD (Server Actions) + trang `/jobs/new` → Task 3. ✓
- Ứng viên duyệt `/jobs`, xem `/jobs/[id]`, đánh giá CV vào JD (tái dùng Phase 3) → Task 4. ✓
- Quyền: NTD-only đăng/xóa; ứng viên chỉ CV của mình → Task 3 (actions guard), Task 4 (evaluate qua API Phase 3 đã kiểm tra owner). ✓
- Link điều hướng "Việc làm" → Task 3 Step 6. ✓
- Test cũ vẫn PASS; TDD phần schema/register → Task 2, Task 4 Step 4. ✓

**Placeholder scan:** Không có TBD/TODO; mọi step có code/lệnh cụ thể. ✓

**Type consistency:** `role: "CANDIDATE" | "RECRUITER"` nhất quán ở `registerSchema` (Task 2), `RegisterDeps.create` (Task 2), session type (Task 3), guard trong actions/pages (Task 3, 4). `createJobDescription`/`deleteJobDescription` khai báo Task 3, dùng ở dashboard + jobs/new (Task 3). `EvaluateFromJob` props định nghĩa Task 4 Step 3, dùng ở page Task 4 Step 2 (truyền `jobId`, `jdText`, `jdTitle`, `jdCompany`, `cvs`). API `/api/cv/[cvId]/evaluate` body `{ jdText, jdTitle, jdCompany }` khớp Phase 3. ✓

**Lưu ý runtime đã tính:** API route register không cần sửa (data truyền thẳng gồm role); role vào session cần đăng nhập lại (JWT mới); `params` là Promise; Neon IPv4 qua npm script; JD ứng viên tự dán (Phase 3) giữ `isPublic=false` nên không hiện ở `/jobs`.
