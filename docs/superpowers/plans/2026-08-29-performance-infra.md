# Gói D — Performance & Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate company logos from DB bytes to Vercel Blob, replace all `revalidatePath` with `revalidateTag`, and switch raw `<img>` tags in company views to `next/image`.

**Architecture:** Three independent improvements applied sequentially: (1) Blob storage replaces the binary-in-DB pattern for logos; (2) cache tags enable surgical invalidation across routes; (3) `next/image` leverages the new proper CDN URLs. No schema migrations required — `logoUrl/logoData/logoMime` columns stay nullable.

**Tech Stack:** `@vercel/blob` (put/del), `unstable_cache`/`revalidateTag` from `next/cache`, `next/image`, Vitest, Prisma 6, Next.js 16.

## Global Constraints

- Prisma MUST stay on v6 — do not upgrade.
- Every DB command must have `NODE_OPTIONS=--dns-result-order=ipv4first` if run standalone (already set in project scripts).
- No inline SQL string interpolation — parameterized queries only.
- Server Actions must self-guard (no reliance on proxy.ts); existing `requireRole`/`requireUser` calls must NOT be removed.
- No comments in code unless the WHY is non-obvious to any reader.
- No test files for route handlers or React components — only pure logic gets unit tests.
- Run `npm test` after each task; all 265 tests must stay green.
- Run `npx tsc --noEmit` after each task; zero new TypeScript errors.
- `npm run build` must pass before final commit.

---

## File Map

| File | Action | Task |
|------|--------|------|
| `package.json` | modify — add `@vercel/blob`, `db:migrate-logos` script | 1 |
| `.env.example` | modify — add `BLOB_READ_WRITE_TOKEN` entry | 1 |
| `next.config.ts` | modify — add `images.remotePatterns` | 1 |
| `lib/company/actions.ts` | modify — replace DB bytes upload with `put()`/`del()` | 1 |
| `scripts/migrate-logos.ts` | create — one-time idempotent migration script | 2 |
| `app/api/company/[id]/logo/route.ts` | modify — redirect to blob URL if set, else serve legacy bytes | 2 |
| `lib/cache/tags.ts` | create — `CACHE_TAGS` constants | 3 |
| `lib/cache/__tests__/tags.test.ts` | create — unit test for constants shape | 3 |
| `lib/cv/actions.ts` | modify — 3× revalidatePath → revalidateTag | 3 |
| `lib/applications/actions.ts` | modify — 4× revalidatePath → revalidateTag | 3 |
| `lib/jobs/actions.ts` | modify — 1× revalidatePath → revalidateTag | 3 |
| `lib/jobs/saved-actions.ts` | modify — 2× revalidatePath → revalidateTag | 3 |
| `lib/company/actions.ts` | modify — 1× revalidatePath → revalidateTag | 3 |
| `lib/notifications/actions.ts` | modify — 2× revalidatePath → revalidateTag | 3 |
| `lib/notifications/poll.ts` | modify — wrap in `unstable_cache` 60s TTL | 3 |
| `components/companies/CompanyCard.tsx` | modify — `<img>` → `<Image>` | 4 |
| `app/companies/[id]/page.tsx` | modify — `<img>` → `<Image>` | 4 |

---

## Task 1: Vercel Blob setup + logo upload action

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `next.config.ts`
- Modify: `lib/company/actions.ts`

**Interfaces:**
- Produces: `BLOB_READ_WRITE_TOKEN` env var (used by `@vercel/blob`); `logoUrl` in DB is now a `https://…vercel-storage.com/…` URL for new uploads; old `/api/company/[id]/logo` URLs still valid (handled in Task 2).

- [ ] **Step 1: Install `@vercel/blob`**

```bash
npm install @vercel/blob
```

Expected: package installed, `package.json` updated with `"@vercel/blob": "^0.x.x"` in dependencies.

- [ ] **Step 2: Add `db:migrate-logos` script to `package.json`**

In `package.json`, inside the `"scripts"` object, add after the last existing script:

```json
"db:migrate-logos": "npx tsx scripts/migrate-logos.ts"
```

- [ ] **Step 3: Add `BLOB_READ_WRITE_TOKEN` to `.env.example`**

Open `.env.example`. At the end of the file, append:

```
# Vercel Blob (logo storage). Get from vercel.com → Storage → Blob → Connect.
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
```

- [ ] **Step 4: Update `next.config.ts` — add `images.remotePatterns`**

Full replacement of `next.config.ts`:

```ts
import type { NextConfig } from "next";
import { buildCsp } from "./lib/security/csp";

const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "Content-Security-Policy", value: buildCsp({ isProd }) },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 5: Update `lib/company/actions.ts` — use Vercel Blob for logo storage**

Full replacement of `lib/company/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { put, del } from "@vercel/blob";
import prisma from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { companySchema } from "./schema";
import { validateLogo } from "./logo";

export async function upsertCompanyProfile(formData: FormData): Promise<void> {
  const session = await requireRole("RECRUITER");

  const parsed = companySchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    website: String(formData.get("website") ?? "").trim(),
    location: String(formData.get("location") ?? "").trim(),
  });
  if (!parsed.success) redirect("/company/edit");

  const removeLogo = formData.get("removeLogo") === "1";
  const logo = formData.get("logo");

  const profile = await prisma.companyProfile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...parsed.data },
    update: { ...parsed.data },
    select: { id: true, logoUrl: true },
  });

  if (removeLogo) {
    if (profile.logoUrl?.includes("vercel-storage.com")) {
      try { await del(profile.logoUrl); } catch { /* non-fatal */ }
    }
    await prisma.companyProfile.update({
      where: { id: profile.id },
      data: { logoData: null, logoMime: null, logoUrl: "" },
    });
  } else if (logo instanceof File && logo.size > 0) {
    const check = validateLogo({ type: logo.type, size: logo.size });
    if (!check.ok) {
      redirect("/company/edit?error=" + encodeURIComponent(check.error));
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      redirect("/company/edit?error=" + encodeURIComponent("Chưa cấu hình BLOB_READ_WRITE_TOKEN"));
    }
    if (profile.logoUrl?.includes("vercel-storage.com")) {
      try { await del(profile.logoUrl); } catch { /* non-fatal */ }
    }
    const buffer = Buffer.from(await logo.arrayBuffer());
    const blob = await put(`logos/${profile.id}`, buffer, {
      access: "public",
      contentType: logo.type,
    });
    await prisma.companyProfile.update({
      where: { id: profile.id },
      data: { logoUrl: blob.url, logoData: null, logoMime: null },
    });
  }

  revalidatePath("/company/edit");
  redirect("/dashboard");
}
```

Note: `revalidatePath` is kept here and will be replaced by `revalidateTag` in Task 3.

- [ ] **Step 6: Type check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 7: Run tests**

```bash
npm test
```

Expected: 265 tests pass (0 failures). The existing `lib/company/__tests__/logo.test.ts` tests `validateLogo`/`isLogoMime` pure functions — these are unaffected.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .env.example next.config.ts lib/company/actions.ts
git commit -m "feat(perf): migrate logo upload to Vercel Blob (put/del)"
```

---

## Task 2: Migration script + API route fallback

**Files:**
- Create: `scripts/migrate-logos.ts`
- Modify: `app/api/company/[id]/logo/route.ts`

**Interfaces:**
- Consumes: `@vercel/blob` (from Task 1), `logoUrl` field in DB
- Produces: all existing `logoData` rows migrated to Vercel Blob; API route redirects to blob URL for migrated rows, serves bytes as legacy fallback

- [ ] **Step 1: Create `scripts/migrate-logos.ts`**

```ts
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { put } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.companyProfile.findMany({
    where: { logoData: { not: null } },
    select: { id: true, logoData: true, logoMime: true, logoUrl: true },
  });

  console.log(`Found ${companies.length} companies with logoData to migrate.`);
  if (companies.length === 0) { console.log("Nothing to do."); return; }

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const company of companies) {
    if (company.logoUrl?.includes("vercel-storage.com")) {
      console.log(`  SKIP  ${company.id} (already migrated)`);
      skipped++;
      continue;
    }
    if (!company.logoData || !company.logoMime) {
      console.log(`  SKIP  ${company.id} (missing data/mime)`);
      skipped++;
      continue;
    }
    try {
      const buffer = Buffer.from(company.logoData);
      const blob = await put(`logos/${company.id}`, buffer, {
        access: "public",
        contentType: company.logoMime,
      });
      await prisma.companyProfile.update({
        where: { id: company.id },
        data: { logoUrl: blob.url, logoData: null, logoMime: null },
      });
      console.log(`  OK    ${company.id} → ${blob.url}`);
      migrated++;
    } catch (err) {
      console.error(`  FAIL  ${company.id}:`, err);
      failed++;
    }
  }

  console.log(`\nDone. migrated=${migrated} skipped=${skipped} failed=${failed}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**To run the script** (requires `BLOB_READ_WRITE_TOKEN` in `.env.local`):

```bash
npm run db:migrate-logos
```

Expected output example:
```
Found 3 companies with logoData to migrate.
  OK    clxyz123 → https://abc123.public.blob.vercel-storage.com/logos/clxyz123-XjK9.png
  OK    clxyz456 → https://abc123.public.blob.vercel-storage.com/logos/clxyz456-mNp2.jpeg
  SKIP  clxyz789 (already migrated)
Done. migrated=2 skipped=1 failed=0
```

- [ ] **Step 2: Update `app/api/company/[id]/logo/route.ts` — redirect to blob URL if migrated**

Full replacement of `app/api/company/[id]/logo/route.ts`:

```ts
import prisma from "@/lib/db/prisma";
import { isLogoMime } from "@/lib/company/logo";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const profile = await prisma.companyProfile.findUnique({
    where: { id },
    select: { logoData: true, logoMime: true, logoUrl: true },
  });

  if (profile?.logoUrl?.includes("vercel-storage.com")) {
    return new Response(null, {
      status: 301,
      headers: { Location: profile.logoUrl },
    });
  }

  if (!profile?.logoData || !profile.logoMime || !isLogoMime(profile.logoMime)) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(new Uint8Array(profile.logoData), {
    status: 200,
    headers: {
      "Content-Type": profile.logoMime,
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: 265 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate-logos.ts app/api/company/[id]/logo/route.ts
git commit -m "feat(perf): logo migration script + API route blob redirect fallback"
```

---

## Task 3: Cache tags — revalidatePath → revalidateTag + unstable_cache for Navbar

**Files:**
- Create: `lib/cache/tags.ts`
- Create: `lib/cache/__tests__/tags.test.ts`
- Modify: `lib/cv/actions.ts`
- Modify: `lib/applications/actions.ts`
- Modify: `lib/jobs/actions.ts`
- Modify: `lib/jobs/saved-actions.ts`
- Modify: `lib/company/actions.ts`
- Modify: `lib/notifications/actions.ts`
- Modify: `lib/notifications/poll.ts`

**Interfaces:**
- Produces: `CACHE_TAGS` object (used by all action files + poll.ts); all `revalidatePath` calls replaced with `revalidateTag`; `getNotificationSignal` cached 60s per userId.

- [ ] **Step 1: Write failing test for `CACHE_TAGS`**

Create `lib/cache/__tests__/tags.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CACHE_TAGS } from "../tags";

describe("CACHE_TAGS", () => {
  it("exports all 6 required tags", () => {
    const required = ["jobs", "company", "applications", "notifications", "cv", "dashboard"] as const;
    for (const key of required) {
      expect(CACHE_TAGS[key]).toBe(key);
    }
    expect(Object.keys(CACHE_TAGS)).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm test lib/cache/__tests__/tags.test.ts
```

Expected: FAIL — `Cannot find module '../tags'`.

- [ ] **Step 3: Create `lib/cache/tags.ts`**

```ts
export const CACHE_TAGS = {
  jobs: "jobs",
  company: "company",
  applications: "applications",
  notifications: "notifications",
  cv: "cv",
  dashboard: "dashboard",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npm test lib/cache/__tests__/tags.test.ts
```

Expected: PASS (1 test, 0 failures).

- [ ] **Step 5: Update `lib/cv/actions.ts`** — replace 3 revalidatePath calls

Change the import line at the top from:
```ts
import { revalidatePath } from "next/cache";
```
to:
```ts
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/tags";
```

Change line 36 (`deleteCv`):
```ts
  revalidatePath("/dashboard");
```
→
```ts
  revalidateTag(CACHE_TAGS.dashboard);
```

Change lines 97–98 (`saveCv`):
```ts
  revalidatePath(`/cv/${cvId}`);
  revalidatePath("/dashboard");
```
→
```ts
  revalidateTag(CACHE_TAGS.cv);
  revalidateTag(CACHE_TAGS.dashboard);
```

- [ ] **Step 6: Update `lib/applications/actions.ts`** — replace 4 revalidatePath calls

Change the import line at the top from:
```ts
import { revalidatePath } from "next/cache";
```
to:
```ts
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/tags";
```

Change lines 168–169 (`submitApplication`, inside `if (outcome.ok)`):
```ts
    revalidatePath("/applications");
    revalidatePath(`/jobs/${input.jobId}`);
```
→
```ts
    revalidateTag(CACHE_TAGS.applications);
    revalidateTag(CACHE_TAGS.jobs);
```

Change line 218 (`withdrawApplication`, inside `if (outcome.ok)`):
```ts
  revalidatePath("/applications");
```
→
```ts
  revalidateTag(CACHE_TAGS.applications);
```

Change line 264 (`changeStatus`, inside `if (outcome.ok)`):
```ts
  if (outcome.ok) revalidatePath("/applications");
```
→
```ts
  if (outcome.ok) revalidateTag(CACHE_TAGS.applications);
```

- [ ] **Step 7: Update `lib/jobs/actions.ts`** — replace 1 revalidatePath call

Change the import line at the top from:
```ts
import { revalidatePath } from "next/cache";
```
to:
```ts
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/tags";
```

Change line 69 (`deleteJobDescription`):
```ts
  revalidatePath("/dashboard");
```
→
```ts
  revalidateTag(CACHE_TAGS.dashboard);
```

- [ ] **Step 8: Update `lib/jobs/saved-actions.ts`** — replace 2 revalidatePath calls

Full replacement of `lib/jobs/saved-actions.ts`:

```ts
"use server";

import { revalidateTag } from "next/cache";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { CACHE_TAGS } from "@/lib/cache/tags";

export async function toggleSaveJob(
  jobId: string,
): Promise<{ ok: true; saved: boolean } | { ok: false; error: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "CANDIDATE")
    return { ok: false, error: "Chỉ ứng viên mới lưu tin" };

  const job = await prisma.jobDescription.findFirst({
    where: { id: jobId, isPublic: true },
    select: { id: true },
  });
  if (!job) return { ok: false, error: "Không tìm thấy tin tuyển dụng" };

  const existing = await prisma.savedJob.findUnique({
    where: { userId_jobId: { userId, jobId } },
    select: { id: true },
  });

  let saved: boolean;
  if (existing) {
    await prisma.savedJob.delete({ where: { id: existing.id } });
    saved = false;
  } else {
    await prisma.savedJob.create({ data: { userId, jobId } });
    saved = true;
  }

  revalidateTag(CACHE_TAGS.jobs);
  return { ok: true, saved };
}
```

Note: two separate `revalidatePath("/jobs")` and `revalidatePath("/jobs/saved")` collapse into one `revalidateTag(CACHE_TAGS.jobs)` — both routes share the same tag.

- [ ] **Step 9: Update `lib/company/actions.ts`** — replace 1 revalidatePath call

The file was modified in Task 1. Apply these two changes to the Task 1 version:

Change the import line at the top from:
```ts
import { revalidatePath } from "next/cache";
```
to:
```ts
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/tags";
```

Change the revalidatePath call near the bottom of `upsertCompanyProfile`:
```ts
  revalidatePath("/company/edit");
```
→
```ts
  revalidateTag(CACHE_TAGS.company);
```

- [ ] **Step 10: Update `lib/notifications/actions.ts`** — replace 2 revalidatePath calls

Full replacement of `lib/notifications/actions.ts`:

```ts
"use server";

import { revalidateTag } from "next/cache";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { CACHE_TAGS } from "@/lib/cache/tags";

export async function markNotificationRead(id: string): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  await prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
  revalidateTag(CACHE_TAGS.notifications);
}

export async function markAllNotificationsRead(): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  revalidateTag(CACHE_TAGS.notifications);
}
```

- [ ] **Step 11: Update `lib/notifications/poll.ts`** — wrap in `unstable_cache`

Full replacement of `lib/notifications/poll.ts`:

```ts
import { unstable_cache } from "next/cache";
import prisma from "@/lib/db/prisma";
import type { NotificationSignal } from "./poll-decision";
import { CACHE_TAGS } from "@/lib/cache/tags";

const getCachedSignal = unstable_cache(
  async (userId: string): Promise<NotificationSignal> => {
    const [unreadCount, latest] = await Promise.all([
      prisma.notification.count({ where: { userId, read: false } }),
      prisma.notification.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { id: true, message: true, link: true },
      }),
    ]);
    return { unreadCount, latest };
  },
  ["notification-signal"],
  { tags: [CACHE_TAGS.notifications], revalidate: 60 },
);

export async function getNotificationSignal(
  userId: string,
): Promise<NotificationSignal> {
  return getCachedSignal(userId);
}
```

- [ ] **Step 12: Type check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 13: Run full test suite**

```bash
npm test
```

Expected: 266 tests pass (265 original + 1 new tags test), 0 failures.

- [ ] **Step 14: Commit**

```bash
git add lib/cache/ lib/cv/actions.ts lib/applications/actions.ts lib/jobs/actions.ts lib/jobs/saved-actions.ts lib/company/actions.ts lib/notifications/actions.ts lib/notifications/poll.ts
git commit -m "feat(perf): replace revalidatePath with revalidateTag; cache Navbar notification query"
```

---

## Task 4: next/image for company logo displays

**Files:**
- Modify: `components/companies/CompanyCard.tsx`
- Modify: `app/companies/[id]/page.tsx`

**Interfaces:**
- Consumes: `logoUrl` from company data (now a Vercel Blob CDN URL after Task 1+2)
- Produces: optimized `<Image>` rendering for company logos in card and detail views

Note: `app/company/edit/page.tsx` keeps its raw `<img>` — it renders a `blob:` object URL created by `FileReader` for upload preview, which `next/image` cannot optimize (client-side object URL, no width/height).

- [ ] **Step 1: Update `components/companies/CompanyCard.tsx`**

Full replacement of `components/companies/CompanyCard.tsx`:

```tsx
import Link from "next/link";
import Image from "next/image";
import type { CompanyDirItem } from "@/lib/company/directory";
import CompanyAvatar from "@/components/CompanyAvatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function CompanyCard({ company }: { company: CompanyDirItem }) {
  return (
    <Link href={`/companies/${company.id}`} className="block">
      <Card className="h-full transition-colors hover:border-primary/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            {company.logoUrl ? (
              <Image
                src={company.logoUrl}
                alt={company.name}
                width={48}
                height={48}
                className="h-12 w-12 rounded-lg object-cover"
              />
            ) : (
              <CompanyAvatar name={company.name} className="h-12 w-12" />
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{company.name}</p>
              {company.location && (
                <p className="truncate text-sm text-muted-foreground">📍 {company.location}</p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {company.jobCount} tin đang tuyển
          </span>
          {company.description && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{company.description}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 2: Update `app/companies/[id]/page.tsx`**

Change the import block at the top — add `Image` import after existing imports:

```tsx
import Image from "next/image";
```

Replace the logo `<img>` block (lines 48–53 in the original):

```tsx
              {company.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={company.logoUrl} alt={company.name} className="h-14 w-14 rounded-lg object-cover" />
              ) : (
```

→

```tsx
              {company.logoUrl ? (
                <Image
                  src={company.logoUrl}
                  alt={company.name}
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-lg object-cover"
                />
              ) : (
```

Note: the `// eslint-disable-next-line` comment is removed because `next/image` is the correct component here.

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

Expected: zero errors. If `next/image` reports a domain error, verify `next.config.ts` has the correct `remotePatterns` from Task 1.

- [ ] **Step 4: Run full test suite + build**

```bash
npm test && npm run build
```

Expected: 266 tests pass, build succeeds with no warnings about missing image config.

- [ ] **Step 5: Commit**

```bash
git add components/companies/CompanyCard.tsx app/companies/[id]/page.tsx
git commit -m "feat(perf): replace raw img with next/image for company logos"
```
