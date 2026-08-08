# CV Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho ứng viên chọn 1 trong 3 mẫu CV (classic/modern/sidebar) áp cho cả xem trước và PDF, giữ nguyên dữ liệu CV.

**Architecture:** Thêm cột `template` trên CV + hằng `lib/cv/templates.ts` (TDD). Hai renderer (`CvDocument` react-pdf, `CvPreview` HTML) nhận prop `template` và render 1 trong 3 layout, dùng chung `cv-format` + các list-item dùng chung. Mẫu là lớp trình bày, tách khỏi `CvInput`; truyền qua `saveCv`/route PDF/CvEditor.

**Tech Stack:** Next.js 16, React 19, `@react-pdf/renderer`, Prisma 6 (Neon), Tailwind v4, Vitest.

## Global Constraints

- Prisma **pinned v6**; thay đổi schema DUY NHẤT là thêm cột `template String @default("classic")`; đồng bộ bằng `npm run db:push` (không migration tay).
- Vitest: unit-test **logic thuần** (`templates.ts`) + mở rộng test PDF cho 3 mẫu; component/route không unit-test.
- **Không đổi output PDF của mẫu `classic`** so với hiện tại (regression) — chỉ tách nhánh, giữ nguyên style/cấu trúc classic.
- **Không đổi** auth, AI, realtime, phân quyền; `CvInput` giữ nguyên (template là prop riêng).
- `className` dùng **dấu nháy thẳng ASCII**. Màu nhấn CV = indigo thương hiệu `#4f46e5` (PDF) / `indigo-600`/`indigo-50`/`indigo-100` (preview) — ngoại lệ hợp lệ cho "giấy" CV (giống nền slate/white đã có).
- Nội dung tiếng Việt; **SmartHire**. Windows: `npm test`, `npm run lint`, `npm run build`, `npm run db:push`.

---

## File Structure

**Tạo mới:**
- `lib/cv/templates.ts` + `lib/cv/__tests__/templates.test.ts`
- `components/cv/preview/sections.tsx` (list-item dùng chung cho preview)
- `components/cv/preview/ClassicPreview.tsx`, `ModernPreview.tsx`, `SidebarPreview.tsx`

**Sửa:**
- `prisma/schema.prisma` (thêm `template`)
- `lib/pdf/CvDocument.tsx` (3 layout, prop `template`)
- `lib/pdf/__tests__/CvDocument.test.tsx` (render 3 mẫu)
- `components/cv/CvPreview.tsx` (thành switch điều phối)
- `lib/cv/actions.ts` (`saveCv` thêm tham số `template`)
- `app/cv/[id]/page.tsx` (đọc + truyền `initialTemplate`)
- `app/cv/[id]/CvEditor.tsx` (state + bộ chọn mẫu + truyền template)
- `app/api/cv/[id]/pdf/route.tsx` (đọc + truyền template)

---

### Task 1: `templates.ts` (TDD) + cột `template`

**Files:**
- Create: `lib/cv/templates.ts`, `lib/cv/__tests__/templates.test.ts`
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `type CvTemplate = "classic" | "modern" | "sidebar"`; `CV_TEMPLATES: readonly { id: CvTemplate; label: string; description: string }[]`; `isCvTemplate(v): v is CvTemplate`; `normalizeTemplate(v): CvTemplate`.

- [ ] **Step 1: Viết test thất bại**

`lib/cv/__tests__/templates.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CV_TEMPLATES, isCvTemplate, normalizeTemplate } from "../templates";

describe("cv templates", () => {
  it("đúng 3 mẫu, id duy nhất, theo thứ tự", () => {
    const ids = CV_TEMPLATES.map((t) => t.id);
    expect(ids).toEqual(["classic", "modern", "sidebar"]);
    expect(new Set(ids).size).toBe(3);
  });
  it("isCvTemplate nhận id hợp lệ, từ chối giá trị lạ", () => {
    expect(isCvTemplate("classic")).toBe(true);
    expect(isCvTemplate("sidebar")).toBe(true);
    expect(isCvTemplate("xxx")).toBe(false);
    expect(isCvTemplate(null)).toBe(false);
    expect(isCvTemplate(123)).toBe(false);
  });
  it("normalizeTemplate: hợp lệ giữ nguyên; lạ/rỗng/null/undefined -> classic", () => {
    expect(normalizeTemplate("modern")).toBe("modern");
    expect(normalizeTemplate("")).toBe("classic");
    expect(normalizeTemplate("nope")).toBe("classic");
    expect(normalizeTemplate(undefined)).toBe("classic");
    expect(normalizeTemplate(null)).toBe("classic");
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn fail**

Run: `npm test -- templates`
Expected: FAIL ("Cannot find module '../templates'").

- [ ] **Step 3: Cài đặt `lib/cv/templates.ts`**

```ts
export type CvTemplate = "classic" | "modern" | "sidebar";

export const CV_TEMPLATES = [
  { id: "classic", label: "Classic", description: "Một cột, gọn gàng, trung tính." },
  { id: "modern", label: "Modern", description: "Dải header màu nhấn, một cột." },
  { id: "sidebar", label: "Sidebar", description: "Hai cột: liên hệ & kỹ năng bên trái." },
] as const satisfies readonly { id: CvTemplate; label: string; description: string }[];

const IDS = new Set<string>(CV_TEMPLATES.map((t) => t.id));

export function isCvTemplate(v: unknown): v is CvTemplate {
  return typeof v === "string" && IDS.has(v);
}

export function normalizeTemplate(v: unknown): CvTemplate {
  return isCvTemplate(v) ? v : "classic";
}
```

- [ ] **Step 4: Chạy test để chắc chắn pass**

Run: `npm test -- templates`
Expected: PASS.

- [ ] **Step 5: Thêm cột `template` vào Prisma + đồng bộ DB**

Trong `prisma/schema.prisma`, `model CV`, thêm sau dòng `title`:

```prisma
  template    String       @default("classic")
```

Run: `npm run db:push`
Expected: "Your database is now in sync" (cột có default, an toàn).

- [ ] **Step 6: Commit**

```bash
git add lib/cv/templates.ts lib/cv/__tests__/templates.test.ts prisma/schema.prisma
git commit -m "feat(cv): CvTemplate constants/validators + template column"
```

---

### Task 2: `CvDocument` 3 layout (prop `template`) + test PDF 3 mẫu

**Files:**
- Modify: `lib/pdf/CvDocument.tsx`, `lib/pdf/__tests__/CvDocument.test.tsx`

**Interfaces:**
- Consumes: `CvTemplate` (Task 1); `dateRange`/`contactLine`/`eduSubLine`.
- Produces: `export function CvDocument({ cv, template }: { cv: CvInput; template?: CvTemplate })` (mặc định `"classic"`).

- [ ] **Step 1: Viết lại `lib/pdf/CvDocument.tsx`**

Thay toàn bộ file bằng (giữ `Font.register`; nhánh `classic` giữ style/cấu trúc cũ; thêm `modern`/`sidebar`):

```tsx
import path from "path";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import type { CvInput } from "@/lib/cv/types";
import type { CvTemplate } from "@/lib/cv/templates";
import { dateRange, contactLine, eduSubLine } from "@/lib/cv/cv-format";

Font.register({
  family: "Roboto",
  fonts: [
    { src: path.join(process.cwd(), "lib/pdf/fonts/Roboto-Regular.ttf") },
    { src: path.join(process.cwd(), "lib/pdf/fonts/Roboto-Bold.ttf"), fontWeight: "bold" },
  ],
});

const ACCENT = "#4f46e5";

const s = StyleSheet.create({
  page: { fontFamily: "Roboto", fontSize: 11, color: "#111" },
  pad: { padding: 40 },
  name: { fontSize: 22, fontWeight: "bold" },
  headline: { fontSize: 12, color: "#555", marginBottom: 2 },
  contact: { fontSize: 10, color: "#555", marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: "bold", marginTop: 14, marginBottom: 6, borderBottom: "1 solid #ccc", paddingBottom: 2 },
  itemTitle: { fontWeight: "bold" },
  itemSub: { color: "#555", fontSize: 10, marginBottom: 2 },
  text: { marginBottom: 4, lineHeight: 1.4 },
  skillRow: { marginBottom: 2 },
  modernHeader: { backgroundColor: ACCENT, padding: 28 },
  modernName: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  modernHeadline: { fontSize: 12, color: "#e0e7ff", marginTop: 2 },
  modernContact: { fontSize: 10, color: "#e0e7ff", marginTop: 6 },
  modernBody: { padding: 32, paddingTop: 20 },
  modernSectionTitle: { fontSize: 13, fontWeight: "bold", color: ACCENT, marginTop: 14, marginBottom: 6 },
  row: { flexDirection: "row" },
  sbLeft: { width: "34%", backgroundColor: "#eef2ff", padding: 20 },
  sbRight: { width: "66%", padding: 24 },
  sbName: { fontSize: 18, fontWeight: "bold" },
  sbHeadline: { fontSize: 11, color: "#555", marginBottom: 8 },
  sbLeftTitle: { fontSize: 11, fontWeight: "bold", color: ACCENT, marginTop: 14, marginBottom: 4 },
  sbLeftText: { fontSize: 10, color: "#333", marginBottom: 3, lineHeight: 1.3 },
  sbRightTitle: { fontSize: 13, fontWeight: "bold", color: ACCENT, marginTop: 12, marginBottom: 6 },
});

function ExperienceItems({ cv }: { cv: CvInput }) {
  return (
    <>
      {cv.experiences.map((e, i) => (
        <View key={i} wrap={false} style={{ marginBottom: 6 }}>
          <Text style={s.itemTitle}>{e.position} — {e.company}</Text>
          {dateRange(e.startDate, e.endDate) ? <Text style={s.itemSub}>{dateRange(e.startDate, e.endDate)}</Text> : null}
          {e.description ? <Text style={s.text}>{e.description}</Text> : null}
        </View>
      ))}
    </>
  );
}
function EducationItems({ cv }: { cv: CvInput }) {
  return (
    <>
      {cv.educations.map((e, i) => (
        <View key={i} wrap={false} style={{ marginBottom: 6 }}>
          <Text style={s.itemTitle}>{e.school}</Text>
          <Text style={s.itemSub}>{eduSubLine(e.major, dateRange(e.startDate, e.endDate))}</Text>
        </View>
      ))}
    </>
  );
}
function ProjectItems({ cv }: { cv: CvInput }) {
  return (
    <>
      {cv.projects.map((pr, i) => (
        <View key={i} wrap={false} style={{ marginBottom: 6 }}>
          <Text style={s.itemTitle}>{pr.name}</Text>
          {pr.tech ? <Text style={s.itemSub}>{pr.tech}</Text> : null}
          {pr.description ? <Text style={s.text}>{pr.description}</Text> : null}
          {pr.link ? <Text style={s.itemSub}>{pr.link}</Text> : null}
        </View>
      ))}
    </>
  );
}
function SkillLines({ cv }: { cv: CvInput }) {
  return (
    <>
      {cv.skills.map((sk, i) => (
        <Text key={i} style={s.skillRow}>• {sk.name}{sk.level ? ` (${sk.level})` : ""}</Text>
      ))}
    </>
  );
}

function ClassicPage({ cv }: { cv: CvInput }) {
  const p = cv.profile;
  const contact = contactLine(p.email, p.phone);
  return (
    <Page style={[s.page, s.pad]}>
      <Text style={s.name}>{p.fullName || "Chưa có tên"}</Text>
      {p.headline ? <Text style={s.headline}>{p.headline}</Text> : null}
      {contact ? <Text style={s.contact}>{contact}</Text> : null}
      {p.summary ? <Text style={s.text}>{p.summary}</Text> : null}
      {cv.experiences.length > 0 && (<View><Text style={s.sectionTitle}>Kinh nghiệm làm việc</Text><ExperienceItems cv={cv} /></View>)}
      {cv.educations.length > 0 && (<View><Text style={s.sectionTitle}>Học vấn</Text><EducationItems cv={cv} /></View>)}
      {cv.skills.length > 0 && (<View><Text style={s.sectionTitle}>Kỹ năng</Text><SkillLines cv={cv} /></View>)}
      {cv.projects.length > 0 && (<View><Text style={s.sectionTitle}>Dự án</Text><ProjectItems cv={cv} /></View>)}
    </Page>
  );
}

function ModernPage({ cv }: { cv: CvInput }) {
  const p = cv.profile;
  const contact = contactLine(p.email, p.phone);
  return (
    <Page style={s.page}>
      <View style={s.modernHeader}>
        <Text style={s.modernName}>{p.fullName || "Chưa có tên"}</Text>
        {p.headline ? <Text style={s.modernHeadline}>{p.headline}</Text> : null}
        {contact ? <Text style={s.modernContact}>{contact}</Text> : null}
      </View>
      <View style={s.modernBody}>
        {p.summary ? <Text style={s.text}>{p.summary}</Text> : null}
        {cv.experiences.length > 0 && (<View><Text style={s.modernSectionTitle}>Kinh nghiệm làm việc</Text><ExperienceItems cv={cv} /></View>)}
        {cv.educations.length > 0 && (<View><Text style={s.modernSectionTitle}>Học vấn</Text><EducationItems cv={cv} /></View>)}
        {cv.skills.length > 0 && (<View><Text style={s.modernSectionTitle}>Kỹ năng</Text><SkillLines cv={cv} /></View>)}
        {cv.projects.length > 0 && (<View><Text style={s.modernSectionTitle}>Dự án</Text><ProjectItems cv={cv} /></View>)}
      </View>
    </Page>
  );
}

function SidebarPage({ cv }: { cv: CvInput }) {
  const p = cv.profile;
  return (
    <Page style={s.page}>
      <View style={s.row}>
        <View style={s.sbLeft}>
          <Text style={s.sbName}>{p.fullName || "Chưa có tên"}</Text>
          {p.headline ? <Text style={s.sbHeadline}>{p.headline}</Text> : null}
          <Text style={s.sbLeftTitle}>Liên hệ</Text>
          {p.email ? <Text style={s.sbLeftText}>{p.email}</Text> : null}
          {p.phone ? <Text style={s.sbLeftText}>{p.phone}</Text> : null}
          {cv.skills.length > 0 && (
            <View>
              <Text style={s.sbLeftTitle}>Kỹ năng</Text>
              {cv.skills.map((sk, i) => (
                <Text key={i} style={s.sbLeftText}>• {sk.name}{sk.level ? ` (${sk.level})` : ""}</Text>
              ))}
            </View>
          )}
        </View>
        <View style={s.sbRight}>
          {p.summary ? <Text style={s.text}>{p.summary}</Text> : null}
          {cv.experiences.length > 0 && (<View><Text style={s.sbRightTitle}>Kinh nghiệm làm việc</Text><ExperienceItems cv={cv} /></View>)}
          {cv.educations.length > 0 && (<View><Text style={s.sbRightTitle}>Học vấn</Text><EducationItems cv={cv} /></View>)}
          {cv.projects.length > 0 && (<View><Text style={s.sbRightTitle}>Dự án</Text><ProjectItems cv={cv} /></View>)}
        </View>
      </View>
    </Page>
  );
}

export function CvDocument({ cv, template = "classic" }: { cv: CvInput; template?: CvTemplate }) {
  return (
    <Document>
      {template === "modern" ? <ModernPage cv={cv} /> : template === "sidebar" ? <SidebarPage cv={cv} /> : <ClassicPage cv={cv} />}
    </Document>
  );
}
```

- [ ] **Step 2: Mở rộng test PDF cho 3 mẫu**

Trong `lib/pdf/__tests__/CvDocument.test.tsx`, GIỮ test hiện có (render mặc định), thêm:

```tsx
  it.each(["classic", "modern", "sidebar"] as const)(
    "render mẫu %s ra PDF hợp lệ",
    async (tpl) => {
      const buffer = await renderToBuffer(<CvDocument cv={sample} template={tpl} />);
      expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
      expect(buffer.length).toBeGreaterThan(2000);
    },
  );
```

- [ ] **Step 3: Chạy test**

Run: `npm test -- CvDocument`
Expected: PASS (test cũ + 3 case mới). Nếu react-pdf lỗi style (ví dụ `borderBottom` shorthand), sửa cho hợp lệ nhưng giữ layout classic tương đương.

- [ ] **Step 4: Commit**

```bash
git add lib/pdf/CvDocument.tsx lib/pdf/__tests__/CvDocument.test.tsx
git commit -m "feat(cv): CvDocument renders classic/modern/sidebar templates (+ PDF tests)"
```

---

### Task 3: `CvPreview` 3 layout (HTML)

**Files:**
- Create: `components/cv/preview/sections.tsx`, `components/cv/preview/ClassicPreview.tsx`, `components/cv/preview/ModernPreview.tsx`, `components/cv/preview/SidebarPreview.tsx`
- Modify: `components/cv/CvPreview.tsx`

**Interfaces:**
- Consumes: `CvTemplate` (Task 1); `dateRange`/`contactLine`/`eduSubLine`.
- Produces: `CvPreview({ cv, template }: { cv: CvInput; template?: CvTemplate })` (mặc định `"classic"`); các preview con `({ cv }: { cv: CvInput })`; `ExperienceList`/`EducationList`/`ProjectList` từ `sections.tsx`.

- [ ] **Step 1: Tạo `components/cv/preview/sections.tsx` (list dùng chung)**

```tsx
import type { CvInput } from "@/lib/cv/types";
import { dateRange, eduSubLine } from "@/lib/cv/cv-format";

export function ExperienceList({ cv }: { cv: CvInput }) {
  return (
    <>
      {cv.experiences.map((e, i) => (
        <div key={i} className="mb-1.5">
          <div className="font-bold">{e.position} — {e.company}</div>
          {dateRange(e.startDate, e.endDate) && (
            <div className="text-[10px] text-slate-500">{dateRange(e.startDate, e.endDate)}</div>
          )}
          {e.description && <p>{e.description}</p>}
        </div>
      ))}
    </>
  );
}

export function EducationList({ cv }: { cv: CvInput }) {
  return (
    <>
      {cv.educations.map((e, i) => (
        <div key={i} className="mb-1.5">
          <div className="font-bold">{e.school}</div>
          <div className="text-[10px] text-slate-500">{eduSubLine(e.major, dateRange(e.startDate, e.endDate))}</div>
        </div>
      ))}
    </>
  );
}

export function ProjectList({ cv }: { cv: CvInput }) {
  return (
    <>
      {cv.projects.map((pr, i) => (
        <div key={i} className="mb-1.5">
          <div className="font-bold">{pr.name}</div>
          {pr.tech && <div className="text-[10px] text-slate-500">{pr.tech}</div>}
          {pr.description && <p>{pr.description}</p>}
          {pr.link && <div className="text-[10px] text-slate-500">{pr.link}</div>}
        </div>
      ))}
    </>
  );
}
```

- [ ] **Step 2: Tạo `ClassicPreview.tsx`**

```tsx
import type { CvInput } from "@/lib/cv/types";
import { contactLine } from "@/lib/cv/cv-format";
import { ExperienceList, EducationList, ProjectList } from "./sections";

function Title({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-4 mb-1.5 border-b border-slate-300 pb-1 text-[13px] font-bold text-slate-800">{children}</h2>;
}

export default function ClassicPreview({ cv }: { cv: CvInput }) {
  const p = cv.profile;
  const contact = contactLine(p.email, p.phone);
  return (
    <div className="p-8 text-[11px] leading-relaxed text-slate-900">
      <div className="text-[22px] font-bold">{p.fullName || "Chưa có tên"}</div>
      {p.headline && <div className="text-[12px] text-slate-500">{p.headline}</div>}
      {contact && <div className="mb-2 text-[10px] text-slate-500">{contact}</div>}
      {p.summary && <p className="mb-1">{p.summary}</p>}
      {cv.experiences.length > 0 && (<section><Title>Kinh nghiệm làm việc</Title><ExperienceList cv={cv} /></section>)}
      {cv.educations.length > 0 && (<section><Title>Học vấn</Title><EducationList cv={cv} /></section>)}
      {cv.skills.length > 0 && (
        <section><Title>Kỹ năng</Title>
          {cv.skills.map((sk, i) => (<div key={i}>• {sk.name}{sk.level ? ` (${sk.level})` : ""}</div>))}
        </section>
      )}
      {cv.projects.length > 0 && (<section><Title>Dự án</Title><ProjectList cv={cv} /></section>)}
    </div>
  );
}
```

- [ ] **Step 3: Tạo `ModernPreview.tsx`**

```tsx
import type { CvInput } from "@/lib/cv/types";
import { contactLine } from "@/lib/cv/cv-format";
import { ExperienceList, EducationList, ProjectList } from "./sections";

function Title({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-4 mb-1.5 text-[13px] font-bold text-indigo-600">{children}</h2>;
}

export default function ModernPreview({ cv }: { cv: CvInput }) {
  const p = cv.profile;
  const contact = contactLine(p.email, p.phone);
  return (
    <div className="text-[11px] leading-relaxed text-slate-900">
      <div className="bg-indigo-600 px-8 py-6 text-white">
        <div className="text-[22px] font-bold">{p.fullName || "Chưa có tên"}</div>
        {p.headline && <div className="text-[12px] text-indigo-100">{p.headline}</div>}
        {contact && <div className="mt-1 text-[10px] text-indigo-100">{contact}</div>}
      </div>
      <div className="p-8">
        {p.summary && <p className="mb-1">{p.summary}</p>}
        {cv.experiences.length > 0 && (<section><Title>Kinh nghiệm làm việc</Title><ExperienceList cv={cv} /></section>)}
        {cv.educations.length > 0 && (<section><Title>Học vấn</Title><EducationList cv={cv} /></section>)}
        {cv.skills.length > 0 && (
          <section><Title>Kỹ năng</Title>
            {cv.skills.map((sk, i) => (<div key={i}>• {sk.name}{sk.level ? ` (${sk.level})` : ""}</div>))}
          </section>
        )}
        {cv.projects.length > 0 && (<section><Title>Dự án</Title><ProjectList cv={cv} /></section>)}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Tạo `SidebarPreview.tsx`**

```tsx
import type { CvInput } from "@/lib/cv/types";
import { ExperienceList, EducationList, ProjectList } from "./sections";

function Title({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-3 mb-1.5 text-[13px] font-bold text-indigo-600">{children}</h2>;
}

export default function SidebarPreview({ cv }: { cv: CvInput }) {
  const p = cv.profile;
  return (
    <div className="flex text-[11px] leading-relaxed text-slate-900">
      <div className="w-1/3 bg-indigo-50 p-6">
        <div className="text-[18px] font-bold">{p.fullName || "Chưa có tên"}</div>
        {p.headline && <div className="mb-2 text-[11px] text-slate-500">{p.headline}</div>}
        <h3 className="mt-3 mb-1 text-[11px] font-bold text-indigo-600">Liên hệ</h3>
        {p.email && <div className="text-[10px] text-slate-600">{p.email}</div>}
        {p.phone && <div className="text-[10px] text-slate-600">{p.phone}</div>}
        {cv.skills.length > 0 && (
          <>
            <h3 className="mt-3 mb-1 text-[11px] font-bold text-indigo-600">Kỹ năng</h3>
            {cv.skills.map((sk, i) => (
              <div key={i} className="text-[10px] text-slate-600">• {sk.name}{sk.level ? ` (${sk.level})` : ""}</div>
            ))}
          </>
        )}
      </div>
      <div className="w-2/3 p-6">
        {p.summary && <p className="mb-1">{p.summary}</p>}
        {cv.experiences.length > 0 && (<section><Title>Kinh nghiệm làm việc</Title><ExperienceList cv={cv} /></section>)}
        {cv.educations.length > 0 && (<section><Title>Học vấn</Title><EducationList cv={cv} /></section>)}
        {cv.projects.length > 0 && (<section><Title>Dự án</Title><ProjectList cv={cv} /></section>)}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Viết lại `components/cv/CvPreview.tsx` thành switch**

```tsx
import type { CvInput } from "@/lib/cv/types";
import type { CvTemplate } from "@/lib/cv/templates";
import ClassicPreview from "./preview/ClassicPreview";
import ModernPreview from "./preview/ModernPreview";
import SidebarPreview from "./preview/SidebarPreview";

// "Tờ giấy" CV: nền trắng bo góc + bóng; nội dung theo mẫu (slate/indigo cố ý ngoài token).
export default function CvPreview({ cv, template = "classic" }: { cv: CvInput; template?: CvTemplate }) {
  return (
    <div className="mx-auto w-full max-w-[210mm] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      {template === "modern" ? (
        <ModernPreview cv={cv} />
      ) : template === "sidebar" ? (
        <SidebarPreview cv={cv} />
      ) : (
        <ClassicPreview cv={cv} />
      )}
    </div>
  );
}
```

- [ ] **Step 6: Verify build**

Run: `npm run lint` rồi `npm run build`
Expected: thành công. `CvEditor` vẫn gọi `<CvPreview cv={cv} />` (template mặc định classic) — chưa vỡ.

- [ ] **Step 7: Commit**

```bash
git add components/cv/preview/ components/cv/CvPreview.tsx
git commit -m "feat(cv): CvPreview renders classic/modern/sidebar (shared section lists)"
```

---

### Task 4: Nối template end-to-end (saveCv, page, route PDF, CvEditor + bộ chọn)

**Files:**
- Modify: `lib/cv/actions.ts`, `app/cv/[id]/page.tsx`, `app/api/cv/[id]/pdf/route.tsx`, `app/cv/[id]/CvEditor.tsx`

**Interfaces:**
- Consumes: `normalizeTemplate`/`CV_TEMPLATES`/`CvTemplate` (Task 1), `CvPreview` với prop `template` (Task 3).
- Produces: `saveCv(cvId, input, template)` (tham số thứ 3, mặc định không có → dùng classic).

- [ ] **Step 1: `saveCv` nhận `template`**

Trong `lib/cv/actions.ts`:
- Thêm import: `import { normalizeTemplate, type CvTemplate } from "./templates";`
- Đổi chữ ký + ghi template:

```ts
export async function saveCv(
  cvId: string,
  input: CvInput,
  template?: CvTemplate,
): Promise<{ ok: boolean; error?: string }> {
```

Trong `tx.cV.update`, thêm `template`:

```ts
    await tx.cV.update({
      where: { id: cvId },
      data: { title: data.title || "CV chưa đặt tên", template: normalizeTemplate(template) },
    });
```

- [ ] **Step 2: `app/cv/[id]/page.tsx` đọc + truyền `initialTemplate`**

- Thêm import: `import { normalizeTemplate } from "@/lib/cv/templates";`
- Truy vấn `cv` đã `include` quan hệ; `cv.template` là scalar có sẵn. Truyền vào editor:

```tsx
  return <CvEditor cvId={cv.id} initial={initial} initialTemplate={normalizeTemplate(cv.template)} />;
```

- [ ] **Step 3: Route PDF đọc + truyền template**

Trong `app/api/cv/[id]/pdf/route.tsx`:
- Thêm import: `import { normalizeTemplate } from "@/lib/cv/templates";`
- Đổi render:

```tsx
  const buffer = await renderToBuffer(<CvDocument cv={data} template={normalizeTemplate(cv.template)} />);
```

(`cv.template` có sẵn vì `findFirst` với `include` trả cả scalar.)

- [ ] **Step 4: `CvEditor` — state + bộ chọn mẫu + truyền template**

Trong `app/cv/[id]/CvEditor.tsx`:
- Thêm import: `import { CV_TEMPLATES, type CvTemplate } from "@/lib/cv/templates";`
- Đổi props + state:

```tsx
export default function CvEditor({
  cvId,
  initial,
  initialTemplate,
}: {
  cvId: string;
  initial: CvInput;
  initialTemplate: CvTemplate;
}) {
  const [cv, setCv] = useState<CvInput>(initial);
  const [template, setTemplate] = useState<CvTemplate>(initialTemplate);
  const [pending, startTransition] = useTransition();
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
```

- Đổi `onSave` truyền template:

```ts
      const res = await saveCv(cvId, cv, template);
```

- Thêm **bộ chọn mẫu** ngay dưới thanh hành động dính. Chèn sau `</div>` đóng thanh hành động (dòng có `{/* Thanh hành động dính */}` … kết thúc) và trước khối tab mobile:

```tsx
      {/* Bộ chọn mẫu CV */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 pt-3">
        <span className="text-sm text-muted-foreground">Mẫu CV:</span>
        {CV_TEMPLATES.map((t) => (
          <Button
            key={t.id}
            type="button"
            size="sm"
            variant={template === t.id ? "default" : "outline"}
            onClick={() => setTemplate(t.id)}
            title={t.description}
          >
            {t.label}
          </Button>
        ))}
      </div>
```

- Truyền template vào preview:

```tsx
            <CvPreview cv={cv} template={template} />
```

- [ ] **Step 5: Verify build**

Run: `npm run lint` rồi `npm run build`
Expected: thành công (type khớp: `initialTemplate` bắt buộc, page truyền vào).

- [ ] **Step 6: Commit**

```bash
git add lib/cv/actions.ts app/cv/[id]/page.tsx app/api/cv/[id]/pdf/route.tsx app/cv/[id]/CvEditor.tsx
git commit -m "feat(cv): wire template through save, editor picker, preview, and PDF export"
```

---

### Task 5: Rà soát & kiểm thử tổng

**Files:** (rà soát)

- [ ] **Step 1: Chạy toàn bộ test**

Run: `npm test`
Expected: PASS (gồm `templates` + `CvDocument` 3 mẫu).

- [ ] **Step 2: Build production**

Run: `npm run build`
Expected: thành công, không lỗi type.

- [ ] **Step 3: Chạy thử thủ công (khuyến nghị)**

Run: `npm run dev` — mở một CV, bấm lần lượt Classic/Modern/Sidebar (preview đổi ngay), Lưu, rồi "Xuất PDF" và xác nhận PDF đúng mẫu đã lưu.

- [ ] **Step 4: Commit dọn dẹp nếu có**

```bash
git add -A
git commit -m "chore(cv): finalize template feature"
```

---

## Self-Review (đã thực hiện khi viết plan)

- **Spec coverage:** dữ liệu (templates.ts + cột) → Task 1; CvDocument 3 layout + test PDF → Task 2; CvPreview 3 layout → Task 3; nối saveCv/page/route/CvEditor + bộ chọn → Task 4; kiểm thử → Task 5. ✅
- **Placeholder scan:** không có TODO/TBD; mọi bước có code hoặc lệnh cụ thể.
- **Type consistency:** `CvTemplate`/`normalizeTemplate`/`CV_TEMPLATES` (Task 1) dùng nhất quán ở Task 2–4. `CvDocument({cv, template?})` và `CvPreview({cv, template?})` cùng dạng, mặc định `"classic"` để callers cũ không vỡ trước khi Task 4 nối. `saveCv(cvId, input, template?)` — nơi gọi duy nhất là `CvEditor` (cập nhật ở Task 4). `initialTemplate` bắt buộc ở `CvEditor`, page truyền `normalizeTemplate(cv.template)`.
- **Ràng buộc classic bất biến:** `ClassicPage`/`ClassicPreview` giữ nguyên style/cấu trúc cũ; test PDF xác nhận cả 3 mẫu render hợp lệ.
- **Thứ tự an toàn:** Task 2 & 3 đặt prop `template` optional (mặc định classic) nên app không vỡ giữa chừng; Task 4 mới truyền giá trị thật.
