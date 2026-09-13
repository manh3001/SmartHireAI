# Làm tươi cache tin + chuẩn hoá tag blog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bust cache tag `jobs` khi tạo/xóa/ẩn-hiện tin (để /salaries tươi ngay) và chuẩn hoá tag blog (trim).

**Architecture:** Thêm `revalidateTag(CACHE_TAGS.jobs, "max")` vào 4 action đổi trạng thái công khai của tin (2 file); sửa `allTags`/`filterByTag` trim tag. Không tính năng mới, không schema.

**Tech Stack:** Next.js 16 (`revalidateTag`), Prisma 6, vitest.

## Global Constraints

- Chỉ thêm `revalidateTag(CACHE_TAGS.jobs, "max")` (mẫu `revalidateTag(CACHE_TAGS.dashboard, "max")` sẵn có). KHÔNG bust cache ở route đếm view.
- `lib/blog/filter.ts` giữ thuần. prisma default `@/lib/db/prisma`. Tiếng Việt.
- Baseline 433 tests giữ xanh. Test `npx vitest run`; typecheck `npx tsc --noEmit`; lint `npm run lint` (0 error).

---

### Task 1: Chuẩn hoá tag blog (trim)

**Files:**
- Modify: `lib/blog/filter.ts`
- Modify: `lib/blog/__tests__/filter.test.ts`

**Interfaces:**
- Produces: `allTags`/`filterByTag` chuẩn hoá bằng `.trim()` (chữ ký không đổi).

- [ ] **Step 1: Thêm test thất bại**

Thêm vào `lib/blog/__tests__/filter.test.ts` (trong file, dùng helper `post(slug, tag)` sẵn có):
```ts
describe("chuẩn hoá tag (trim)", () => {
  it("allTags gộp 'CV ' và 'CV'; filterByTag khớp bất kể khoảng trắng", () => {
    const posts = [post("a", "CV "), post("b", "CV")];
    expect(allTags(posts)).toEqual(["CV"]);
    expect(filterByTag(posts, "CV").map((p) => p.slug)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Chạy test — phải fail**

Run: `npx vitest run lib/blog/__tests__/filter.test.ts`
Expected: FAIL (`allTags` trả `["CV ", "CV"]` / `filterByTag` chỉ khớp `"b"`).

- [ ] **Step 3: Sửa `lib/blog/filter.ts`**

Thay 2 hàm bằng:
```ts
export function allTags(posts: PostMeta[]): string[] {
  const set = new Set<string>();
  for (const p of posts) {
    const t = p.tag.trim();
    if (t) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "vi"));
}

export function filterByTag(posts: PostMeta[], tag: string | undefined): PostMeta[] {
  if (!tag) return posts;
  return posts.filter((p) => p.tag.trim() === tag);
}
```
(giữ nguyên `import type { PostMeta } from "./post";` ở đầu file.)

- [ ] **Step 4: Chạy test — phải pass**

Run: `npx vitest run lib/blog/__tests__/filter.test.ts`
Expected: PASS (test cũ + case trim mới).

- [ ] **Step 5: Typecheck + test toàn bộ**

Run: `npx tsc --noEmit` → Expected: không lỗi.
Run: `npx vitest run` → Expected: 433 + 1 = 434 PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/blog/filter.ts lib/blog/__tests__/filter.test.ts
git commit -m "fix(blog): chuẩn hoá tag (trim) trong allTags/filterByTag"
```

---

### Task 2: Làm tươi cache tag `jobs` khi đổi tin

**Files:**
- Modify: `lib/jobs/actions.ts`
- Modify: `lib/admin/actions.ts`

- [ ] **Step 1: `lib/jobs/actions.ts` — create + delete**

Trong `createJobDescription`, ngay TRƯỚC dòng `redirect("/dashboard");`, thêm:
```ts
  revalidateTag(CACHE_TAGS.jobs, "max");
```
Trong `deleteJobDescription`, ngay SAU dòng `revalidateTag(CACHE_TAGS.dashboard, "max");`, thêm:
```ts
  revalidateTag(CACHE_TAGS.jobs, "max");
```
(`revalidateTag` và `CACHE_TAGS` đã được import sẵn ở file này — không thêm import.)

- [ ] **Step 2: `lib/admin/actions.ts` — imports**

Ở đầu file (đang có `import { revalidatePath } from "next/cache";`), sửa/bổ sung thành:
```ts
import { revalidatePath, revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/tags";
```
(giữ các import khác nguyên vẹn.)

- [ ] **Step 3: `lib/admin/actions.ts` — deleteJobAsAdmin + setJobPublicAsAdmin**

Trong `deleteJobAsAdmin`, ngay SAU `revalidatePath("/admin/jobs");`, thêm:
```ts
  revalidateTag(CACHE_TAGS.jobs, "max");
```
Trong `setJobPublicAsAdmin`, ngay SAU `revalidatePath("/admin/jobs");`, thêm:
```ts
  revalidateTag(CACHE_TAGS.jobs, "max");
```

- [ ] **Step 4: Typecheck + test + lint**

Run: `npx tsc --noEmit` → Expected: không lỗi.
Run: `npx vitest run` → Expected: 434 (không đổi).
Run: `npm run lint` → Expected: 0 error (không import thừa — `revalidatePath` và `revalidateTag` đều được dùng).

- [ ] **Step 5: Commit**

```bash
git add lib/jobs/actions.ts lib/admin/actions.ts
git commit -m "fix(jobs): revalidateTag(jobs) khi tạo/xóa/ẩn-hiện tin (làm tươi /salaries)"
```

---

### Task 3: Kiểm chứng cuối

**Files:** (không sửa; chỉ chạy)

- [ ] **Step 1: Lint + typecheck + test đầy đủ**

Run:
```bash
npx tsc --noEmit
npm run lint
npx vitest run
```
Expected: tsc sạch; `npm run lint` 0 error; vitest 434 PASS.

## Self-Review

- **Spec coverage:** allTags/filterByTag trim + test (Task 1) ✅ · revalidateTag jobs ở createJobDescription/deleteJobDescription (Task 2) ✅ · deleteJobAsAdmin/setJobPublicAsAdmin + imports (Task 2) ✅ · KHÔNG đụng route view (không có trong plan) ✅ · kiểm chứng (Task 3) ✅.
- **Placeholder scan:** không có TBD/TODO; mọi step có code/lệnh.
- **Type consistency:** `revalidateTag(CACHE_TAGS.jobs, "max")` đúng chữ ký mẫu sẵn có; `allTags`/`filterByTag` chữ ký không đổi; import admin gộp `revalidatePath, revalidateTag`.
