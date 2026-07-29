# Làm đẹp UI (xanh dương & trắng) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp toàn bộ giao diện thành sản phẩm SaaS tông xanh dương + trắng (thương hiệu "SmartHire"), không đổi logic.

**Architecture:** Đặt màu primary = xanh dương qua biến CSS shadcn trong `globals.css` để nút/Card/Input tự theo tông xanh. Thêm component `Navbar` (server, gọi `auth()`) gắn vào các trang có session và trang chủ. Các trang còn lại chỉnh JSX + class Tailwind. Không đụng `lib/`, `app/api/`, `prisma/`, test.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS v4, shadcn/ui, lucide-react.

## Global Constraints

- **Thuần giao diện:** KHÔNG sửa `lib/`, `app/api/`, `prisma/`, hay bất kỳ file test nào.
- Giữ nguyên props/luồng dữ liệu của mọi component; chỉ đổi JSX/class.
- Primary color: blue-600 `#2563EB` = `oklch(0.546 0.245 262.881)`.
- Thương hiệu hiển thị: **SmartHire**.
- Icon dùng `lucide-react` (đã có sẵn).
- Sau mỗi task: `npx tsc --noEmit && npm run build` sạch.
- Cuối cùng: `npm test` vẫn 34/34 PASS (không đụng test).
- Mỗi task kết thúc bằng một commit.

---

### Task 1: Đặt theme màu xanh dương

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: (không có)
- Produces: biến `--primary`, `--ring` màu xanh → nút/Input/Card của shadcn tự động theo tông xanh.

- [ ] **Step 1: Đổi biến primary + ring trong `:root`**

Trong `app/globals.css`, khối `:root`, thay 2 dòng:
```css
  --primary: oklch(0.205 0 0);
```
thành:
```css
  --primary: oklch(0.546 0.245 262.881);
```
và:
```css
  --ring: oklch(0.708 0 0);
```
thành:
```css
  --ring: oklch(0.546 0.245 262.881);
```
(Giữ nguyên `--primary-foreground: oklch(0.985 0 0)` = trắng.)

- [ ] **Step 2: Build kiểm tra**

Run: `npm run build`
Expected: build thành công. (Nút shadcn giờ có nền xanh.)

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "style: set primary theme color to blue"
```

---

### Task 2: Component Navbar

**Files:**
- Create: `components/Navbar.tsx`

**Interfaces:**
- Consumes: `auth`, `signOut` từ `@/auth`; `Button` từ `@/components/ui/button`.
- Produces: `<Navbar />` (async server component, không nhận props) — thanh điều hướng dính trên cùng, hiển thị logo "SmartHire" + trạng thái đăng nhập.

- [ ] **Step 1: Viết Navbar**

Create `components/Navbar.tsx`:
```tsx
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export default async function Navbar() {
  const session = await auth();
  const loggedIn = !!session?.user;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link
          href={loggedIn ? "/dashboard" : "/"}
          className="flex items-center gap-1.5 text-lg font-bold text-blue-600"
        >
          <Sparkles className="h-5 w-5" />
          SmartHire
        </Link>
        <nav className="flex items-center gap-2">
          {loggedIn ? (
            <>
              <span className="hidden text-sm text-slate-600 sm:inline">
                {session!.user!.name}
              </span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <Button variant="outline" size="sm">Đăng xuất</Button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login"><Button variant="ghost" size="sm">Đăng nhập</Button></Link>
              <Link href="/register"><Button size="sm">Đăng ký</Button></Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Kiểm tra type**

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 3: Commit**

```bash
git add components/Navbar.tsx
git commit -m "feat: add shared Navbar component"
```

---

### Task 3: Làm lại trang chủ (hero + thẻ tính năng)

**Files:**
- Modify: `app/page.tsx` (thay toàn bộ)

**Interfaces:**
- Consumes: `Navbar` từ `@/components/Navbar`; `Button`, `Card` từ shadcn; icon từ `lucide-react`; `Link`.
- Produces: trang chủ mới.

- [ ] **Step 1: Thay nội dung `app/page.tsx`**

Replace toàn bộ `app/page.tsx`:
```tsx
import Link from "next/link";
import { FileText, Sparkles, Download } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: FileText,
    title: "Tạo CV chuyên nghiệp",
    desc: "Điền thông tin theo mẫu có cấu trúc, chỉnh sửa dễ dàng, lưu nhiều phiên bản.",
  },
  {
    icon: Sparkles,
    title: "AI đánh giá theo JD",
    desc: "Dán mô tả công việc, AI chấm điểm độ phù hợp, chỉ ra điểm mạnh/yếu và kỹ năng còn thiếu.",
  },
  {
    icon: Download,
    title: "Xuất PDF đẹp",
    desc: "Tải CV ra PDF hỗ trợ tiếng Việt, sẵn sàng gửi nhà tuyển dụng.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-b from-blue-50 to-white">
          <div className="mx-auto max-w-3xl px-4 py-24 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Nền tảng CV thông minh <span className="text-blue-600">SmartHire</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
              Tạo CV, để AI đánh giá độ phù hợp với công việc, và cải thiện hồ sơ của bạn — tất cả trong một nơi.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Link href="/register"><Button size="lg">Bắt đầu miễn phí</Button></Link>
              <Link href="/login"><Button size="lg" variant="outline">Đăng nhập</Button></Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-5xl px-4 py-16">
          <div className="grid gap-6 sm:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title} className="border-slate-200">
                <CardContent className="pt-6">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Build kiểm tra**

Run: `npx tsc --noEmit && npm run build`
Expected: không lỗi.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "style: redesign home page with hero and feature cards"
```

---

### Task 4: Làm lại trang Đăng nhập & Đăng ký

**Files:**
- Modify: `app/login/page.tsx` (thay toàn bộ)
- Modify: `app/register/page.tsx` (thay toàn bộ)

**Interfaces:**
- Consumes: `Button`, `Input` từ shadcn; icon `Sparkles`; `signIn` từ `next-auth/react`; `useRouter`.
- Produces: trang đăng nhập/đăng ký giao diện mới (giữ nguyên logic submit).

- [ ] **Step 1: Thay `app/login/page.tsx`**

Replace toàn bộ:
```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Email hoặc mật khẩu không đúng");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-1.5 text-xl font-bold text-blue-600">
          <Sparkles className="h-6 w-6" /> SmartHire
        </Link>
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="mb-6 text-center text-2xl font-bold text-slate-900">Đăng nhập</h1>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Input name="email" type="email" placeholder="Email" required />
            <Input name="password" type="password" placeholder="Mật khẩu" required />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading} className="mt-1">
              {loading ? "Đang xử lý..." : "Đăng nhập"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-600">
            Chưa có tài khoản?{" "}
            <Link href="/register" className="font-medium text-blue-600 hover:underline">Đăng ký</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Thay `app/register/page.tsx`**

Replace toàn bộ:
```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        name: form.get("name"),
        password: form.get("password"),
      }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/login");
    } else {
      const data = await res.json();
      setError(data.error ?? "Đăng ký thất bại");
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-1.5 text-xl font-bold text-blue-600">
          <Sparkles className="h-6 w-6" /> SmartHire
        </Link>
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="mb-6 text-center text-2xl font-bold text-slate-900">Đăng ký</h1>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Input name="name" placeholder="Họ tên" required />
            <Input name="email" type="email" placeholder="Email" required />
            <Input name="password" type="password" placeholder="Mật khẩu (>= 8 ký tự)" required />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading} className="mt-1">
              {loading ? "Đang xử lý..." : "Đăng ký"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-600">
            Đã có tài khoản?{" "}
            <Link href="/login" className="font-medium text-blue-600 hover:underline">Đăng nhập</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build kiểm tra**

Run: `npx tsc --noEmit && npm run build`
Expected: không lỗi.

- [ ] **Step 4: Commit**

```bash
git add app/login/page.tsx app/register/page.tsx
git commit -m "style: redesign login and register pages"
```

---

### Task 5: Làm lại Dashboard

**Files:**
- Modify: `app/dashboard/page.tsx` (thay toàn bộ)

**Interfaces:**
- Consumes: `Navbar`; `auth`; `prisma`; `createCv`, `deleteCv` từ `@/lib/cv/actions`; `Button`, `Card`; icon; `Link`.
- Produces: dashboard mới (giữ nguyên logic createCv/deleteCv).

- [ ] **Step 1: Thay `app/dashboard/page.tsx`**

Replace toàn bộ:
```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import prisma from "@/lib/db/prisma";
import { createCv, deleteCv } from "@/lib/cv/actions";
import Navbar from "@/components/Navbar";
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
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">CV của bạn</h1>
            <p className="text-sm text-slate-500">Xin chào, {session.user.name}</p>
          </div>
          <form action={createCv}>
            <Button type="submit">
              <Plus className="mr-1 h-4 w-4" /> Tạo CV mới
            </Button>
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
                  <Button variant="ghost" size="sm" type="submit" className="text-slate-500 hover:text-red-600">
                    Xóa
                  </Button>
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

- [ ] **Step 2: Build kiểm tra**

Run: `npx tsc --noEmit && npm run build`
Expected: không lỗi.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "style: redesign dashboard with navbar and CV cards"
```

---

### Task 6: Tinh chỉnh trình sửa CV & trang đánh giá

**Files:**
- Modify: `app/cv/[id]/CvEditor.tsx` (đổi vài class)
- Modify: `app/cv/[id]/evaluate/EvaluateClient.tsx` (đổi vài class)

**Interfaces:**
- Consumes: (không có mới)
- Produces: hai trang này theo tông xanh, không đổi logic.

- [ ] **Step 1: Cho nền xám nhạt + tiêu đề mục màu xanh trong CvEditor**

Trong `app/cv/[id]/CvEditor.tsx`, đổi dòng mở `main`:
```tsx
    <main className="mx-auto max-w-3xl p-8">
```
thành:
```tsx
    <main className="mx-auto min-h-full max-w-3xl bg-slate-50 p-8">
```

Và cho tất cả tiêu đề mục màu xanh: đổi **mọi** `<CardTitle>` — thêm class `className="text-blue-700"`. Có 5 chỗ, sửa lần lượt từng dòng:
```tsx
        <CardHeader><CardTitle>Thông tin cá nhân</CardTitle></CardHeader>
```
→
```tsx
        <CardHeader><CardTitle className="text-blue-700">Thông tin cá nhân</CardTitle></CardHeader>
```
Làm tương tự cho: `Kinh nghiệm làm việc`, `Học vấn`, `Kỹ năng`, `Dự án`.

- [ ] **Step 2: Cho trang đánh giá nền xám + badge từ khóa + vòng tròn điểm**

Trong `app/cv/[id]/evaluate/EvaluateClient.tsx`:

(a) Đổi dòng mở `main`:
```tsx
    <main className="mx-auto max-w-3xl p-8">
```
→
```tsx
    <main className="mx-auto min-h-full max-w-3xl bg-slate-50 p-8">
```

(b) Bọc điểm số trong vòng tròn màu. Thay khối:
```tsx
            <div className="text-center">
              <div className={`text-5xl font-bold ${colorClass[scoreColor(result.overallScore)]}`}>
                {result.overallScore}
                <span className="text-xl text-gray-400">/100</span>
              </div>
              <p className="mt-2 text-gray-600">{result.summary}</p>
            </div>
```
bằng:
```tsx
            <div className="flex flex-col items-center text-center">
              <div className={`flex h-28 w-28 flex-col items-center justify-center rounded-full border-4 ${ringClass[scoreColor(result.overallScore)]}`}>
                <span className={`text-4xl font-bold ${colorClass[scoreColor(result.overallScore)]}`}>
                  {result.overallScore}
                </span>
                <span className="text-xs text-slate-400">/100</span>
              </div>
              <p className="mt-3 max-w-xl text-slate-600">{result.summary}</p>
            </div>
```

(c) Thêm bảng màu viền vòng tròn ngay sau `const colorClass` (gần đầu file):
```tsx
const ringClass: Record<"red" | "yellow" | "green", string> = {
  red: "border-red-200",
  yellow: "border-yellow-200",
  green: "border-green-200",
};
```

(d) Đổi hai dòng từ khóa thành badge. Thay khối:
```tsx
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="font-semibold">Từ khóa khớp: </span>
                {result.matchedKeywords.join(", ") || "—"}
              </div>
              <div>
                <span className="font-semibold">Từ khóa còn thiếu: </span>
                {result.missingKeywords.join(", ") || "—"}
              </div>
            </div>
```
bằng:
```tsx
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="mb-1 font-semibold text-slate-700">Từ khóa khớp</p>
                <div className="flex flex-wrap gap-1">
                  {result.matchedKeywords.length === 0 && <span className="text-slate-400">—</span>}
                  {result.matchedKeywords.map((k, i) => (
                    <span key={i} className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">{k}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 font-semibold text-slate-700">Từ khóa còn thiếu</p>
                <div className="flex flex-wrap gap-1">
                  {result.missingKeywords.length === 0 && <span className="text-slate-400">—</span>}
                  {result.missingKeywords.map((k, i) => (
                    <span key={i} className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">{k}</span>
                  ))}
                </div>
              </div>
            </div>
```

- [ ] **Step 3: Build + toàn bộ test**

Run: `npx tsc --noEmit && npm run build && npm test`
Expected: build sạch; test **34/34 PASS** (không đụng test).

- [ ] **Step 4: Kiểm tra thủ công bằng mắt**

```bash
npm run dev
```
Xem: trang chủ hero xanh, đăng nhập/ký card giữa nền gradient, dashboard có navbar + card CV, trang đánh giá có vòng tròn điểm + badge từ khóa. Tông xanh/trắng đồng bộ, không vỡ layout.

- [ ] **Step 5: Commit**

```bash
git add app/cv
git commit -m "style: polish CV editor and evaluation page"
```

---

## Self-Review

**Spec coverage:**
- Theme màu xanh qua biến CSS → Task 1. ✓
- Navbar chung → Task 2, gắn vào home (Task 3), dashboard (Task 5). ✓
- Trang chủ hero + 3 thẻ tính năng → Task 3. ✓
- Login/register card giữa nền gradient + logo → Task 4. ✓
- Dashboard navbar + CV card đẹp → Task 5. ✓
- CvEditor tiêu đề xanh + nền + thanh nút → Task 6 Step 1. ✓
- Evaluate vòng tròn điểm + badge từ khóa → Task 6 Step 2. ✓
- Không đụng logic/API/test; giữ props → Global Constraints, mọi task chỉ đổi JSX/class. ✓
- Build sạch + test 34/34 → Task 6 Step 3. ✓

**Placeholder scan:** Không có TBD/TODO; mọi step có code/lệnh cụ thể. ✓

**Type consistency:** `Navbar` (Task 2) dùng ở Task 3, 5. `scoreColor`/`colorClass` sẵn có; thêm `ringClass` cùng kiểu `Record<"red"|"yellow"|"green", string>` (Task 6). Không đổi tên hàm/prop nào. ✓

**Lưu ý:** Login/register KHÔNG dùng Navbar (theo spec — chỉ logo giữa trang). Navbar chỉ ở home + dashboard (+ có thể thêm vào trang CV sau nếu muốn, ngoài phạm vi tối thiểu).
