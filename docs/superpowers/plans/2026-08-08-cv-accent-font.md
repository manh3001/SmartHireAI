# Tùy chỉnh màu nhấn & font CV — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho ứng viên chọn màu nhấn (6 preset) và font (Roboto/Be Vietnam Pro/Lora) áp cho preview HTML + PDF, mặc định trùng khít hiện tại nên CV cũ render y hệt.

**Architecture:** Thêm cột `CV.accent`/`CV.font` + hằng thuần `lib/cv/accents.ts`/`lib/cv/fonts.ts` (TDD). PDF (`CvDocument`) đổi StyleSheet tĩnh → `makeStyles(accent, fontFamily)` + đăng ký thêm 2 họ font TTF. Preview HTML dùng inline style từ accent + `fontFamily` từ CSS var (nạp qua `next/font/google`). Truyền accent/font qua `saveCv`/page/route/`CvEditor` (swatch màu + nút font).

**Tech Stack:** Next.js 16, React 19, `@react-pdf/renderer`, Prisma 6 (Neon), Tailwind v4, Vitest, `next/font/google`.

## Global Constraints

- Prisma **pinned v6**; thay đổi schema DUY NHẤT là thêm 2 cột `accent String @default("indigo")` + `font String @default("roboto")`; đồng bộ bằng `npm run db:push` (không migration tay).
- Vitest: unit-test **logic thuần** (`accents.ts`, `fonts.ts`) + mở rộng test PDF; component/route/page không unit-test.
- **Mặc định `indigo`/`roboto` phải giữ output PDF + preview y hệt hiện tại** (regression): giá trị indigo = `#4f46e5`/`#eef2ff`/`#e0e7ff`, font PDF `Roboto`; preview mặc định KHÔNG override `fontFamily` (giữ font app hiện tại).
- **Classic giữ trung tính**: accent chỉ tác động modern/sidebar; font áp mọi mẫu.
- Không đổi `CvInput`, AI, auth, realtime, phân quyền.
- `className` **nháy thẳng ASCII**; nội dung tiếng Việt; **SmartHire**. Windows: `npm test`, `npm run lint`, `npm run build`, `npm run db:push`.

## File Structure

**Tạo mới:**
- `lib/cv/accents.ts` + `lib/cv/__tests__/accents.test.ts` — type/hằng/validator màu nhấn.
- `lib/cv/fonts.ts` + `lib/cv/__tests__/fonts.test.ts` — type/hằng/validator font.
- 4 TTF trong `lib/pdf/fonts/`: `BeVietnamPro-Regular.ttf`, `BeVietnamPro-Bold.ttf`, `Lora-Regular.ttf`, `Lora-Bold.ttf`.

**Sửa:**
- `prisma/schema.prisma` (2 cột trên `model CV`)
- `lib/pdf/CvDocument.tsx` + `lib/pdf/__tests__/CvDocument.test.tsx`
- `components/cv/CvPreview.tsx`, `components/cv/preview/ModernPreview.tsx`, `components/cv/preview/SidebarPreview.tsx`
- `app/layout.tsx` (next/font)
- `lib/cv/actions.ts`, `app/cv/[id]/page.tsx`, `app/cv/[id]/CvEditor.tsx`, `app/api/cv/[id]/pdf/route.tsx`

---

### Task 1: Hằng `accents.ts` + `fonts.ts` (TDD) + 2 cột

**Files:**
- Create: `lib/cv/accents.ts`, `lib/cv/__tests__/accents.test.ts`, `lib/cv/fonts.ts`, `lib/cv/__tests__/fonts.test.ts`
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces:
  - `type CvAccent = "indigo"|"blue"|"emerald"|"rose"|"amber"|"slate"`; `type AccentDef = { id: CvAccent; label: string; hex: string; soft: string; onDark: string }`; `CV_ACCENTS: readonly AccentDef[]`; `isCvAccent(v): v is CvAccent`; `normalizeAccent(v): CvAccent`; `accentById(id: CvAccent): AccentDef`.
  - `type CvFont = "roboto"|"bevietnam"|"lora"`; `type FontDef = { id: CvFont; label: string; pdfFamily: string; cssStack: string }`; `CV_FONTS: readonly FontDef[]`; `isCvFont(v): v is CvFont`; `normalizeFont(v): CvFont`; `fontById(id: CvFont): FontDef`.

- [ ] **Step 1: Viết test thất bại — accents**

`lib/cv/__tests__/accents.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CV_ACCENTS, isCvAccent, normalizeAccent, accentById } from "../accents";

describe("cv accents", () => {
  it("đúng 6 màu, id duy nhất, theo thứ tự", () => {
    const ids = CV_ACCENTS.map((a) => a.id);
    expect(ids).toEqual(["indigo", "blue", "emerald", "rose", "amber", "slate"]);
    expect(new Set(ids).size).toBe(6);
  });
  it("mỗi màu có hex/soft/onDark dạng #rrggbb", () => {
    for (const a of CV_ACCENTS) {
      for (const c of [a.hex, a.soft, a.onDark]) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
  it("indigo trùng hằng số PDF hiện tại (bảo toàn output)", () => {
    const indigo = accentById("indigo");
    expect(indigo.hex).toBe("#4f46e5");
    expect(indigo.soft).toBe("#eef2ff");
    expect(indigo.onDark).toBe("#e0e7ff");
  });
  it("isCvAccent nhận id hợp lệ, từ chối lạ", () => {
    expect(isCvAccent("rose")).toBe(true);
    expect(isCvAccent("xxx")).toBe(false);
    expect(isCvAccent(null)).toBe(false);
    expect(isCvAccent(7)).toBe(false);
  });
  it("normalizeAccent: hợp lệ giữ nguyên; lạ/rỗng/null/undefined -> indigo", () => {
    expect(normalizeAccent("emerald")).toBe("emerald");
    expect(normalizeAccent("")).toBe("indigo");
    expect(normalizeAccent("nope")).toBe("indigo");
    expect(normalizeAccent(undefined)).toBe("indigo");
    expect(normalizeAccent(null)).toBe("indigo");
  });
  it("accentById trả đúng def", () => {
    expect(accentById("rose").label).toBe("Đỏ mận");
  });
});
```

- [ ] **Step 2: Viết test thất bại — fonts**

`lib/cv/__tests__/fonts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CV_FONTS, isCvFont, normalizeFont, fontById } from "../fonts";

describe("cv fonts", () => {
  it("đúng 3 font, id duy nhất, theo thứ tự", () => {
    const ids = CV_FONTS.map((f) => f.id);
    expect(ids).toEqual(["roboto", "bevietnam", "lora"]);
    expect(new Set(ids).size).toBe(3);
  });
  it("roboto mặc định: pdfFamily Roboto, cssStack rỗng (giữ font app)", () => {
    const r = fontById("roboto");
    expect(r.pdfFamily).toBe("Roboto");
    expect(r.cssStack).toBe("");
  });
  it("lora là serif, bevietnam là sans (pdfFamily khớp Font.register)", () => {
    expect(fontById("lora").pdfFamily).toBe("Lora");
    expect(fontById("bevietnam").pdfFamily).toBe("Be Vietnam Pro");
  });
  it("isCvFont nhận id hợp lệ, từ chối lạ", () => {
    expect(isCvFont("lora")).toBe(true);
    expect(isCvFont("comic")).toBe(false);
    expect(isCvFont(null)).toBe(false);
  });
  it("normalizeFont: hợp lệ giữ nguyên; lạ/null/undefined -> roboto", () => {
    expect(normalizeFont("bevietnam")).toBe("bevietnam");
    expect(normalizeFont("nope")).toBe("roboto");
    expect(normalizeFont(undefined)).toBe("roboto");
    expect(normalizeFont(null)).toBe("roboto");
  });
});
```

- [ ] **Step 3: Chạy test để chắc chắn fail**

Run: `npm test -- accents fonts`
Expected: FAIL ("Cannot find module '../accents'"/'../fonts').

- [ ] **Step 4: Cài đặt `lib/cv/accents.ts`**

```ts
export type CvAccent = "indigo" | "blue" | "emerald" | "rose" | "amber" | "slate";

export type AccentDef = {
  id: CvAccent;
  label: string;
  hex: string;
  soft: string;
  onDark: string;
};

export const CV_ACCENTS = [
  { id: "indigo", label: "Chàm", hex: "#4f46e5", soft: "#eef2ff", onDark: "#e0e7ff" },
  { id: "blue", label: "Xanh dương", hex: "#2563eb", soft: "#eff6ff", onDark: "#dbeafe" },
  { id: "emerald", label: "Lục", hex: "#059669", soft: "#ecfdf5", onDark: "#d1fae5" },
  { id: "rose", label: "Đỏ mận", hex: "#e11d48", soft: "#fff1f2", onDark: "#ffe4e6" },
  { id: "amber", label: "Cam", hex: "#d97706", soft: "#fffbeb", onDark: "#fef3c7" },
  { id: "slate", label: "Xám than", hex: "#334155", soft: "#f1f5f9", onDark: "#e2e8f0" },
] as const satisfies readonly AccentDef[];

const ACCENT_IDS = new Set<string>(CV_ACCENTS.map((a) => a.id));

export function isCvAccent(v: unknown): v is CvAccent {
  return typeof v === "string" && ACCENT_IDS.has(v);
}

export function normalizeAccent(v: unknown): CvAccent {
  return isCvAccent(v) ? v : "indigo";
}

export function accentById(id: CvAccent): AccentDef {
  return CV_ACCENTS.find((a) => a.id === id) ?? CV_ACCENTS[0];
}
```

- [ ] **Step 5: Cài đặt `lib/cv/fonts.ts`**

```ts
export type CvFont = "roboto" | "bevietnam" | "lora";

export type FontDef = {
  id: CvFont;
  label: string;
  pdfFamily: string;
  cssStack: string;
};

export const CV_FONTS = [
  { id: "roboto", label: "Roboto (mặc định)", pdfFamily: "Roboto", cssStack: "" },
  { id: "bevietnam", label: "Be Vietnam Pro", pdfFamily: "Be Vietnam Pro", cssStack: "var(--font-be-vietnam-pro), sans-serif" },
  { id: "lora", label: "Lora (serif)", pdfFamily: "Lora", cssStack: "var(--font-lora), serif" },
] as const satisfies readonly FontDef[];

const FONT_IDS = new Set<string>(CV_FONTS.map((f) => f.id));

export function isCvFont(v: unknown): v is CvFont {
  return typeof v === "string" && FONT_IDS.has(v);
}

export function normalizeFont(v: unknown): CvFont {
  return isCvFont(v) ? v : "roboto";
}

export function fontById(id: CvFont): FontDef {
  return CV_FONTS.find((f) => f.id === id) ?? CV_FONTS[0];
}
```

- [ ] **Step 6: Chạy test để chắc chắn pass**

Run: `npm test -- accents fonts`
Expected: PASS.

- [ ] **Step 7: Thêm 2 cột vào Prisma + đồng bộ DB**

Trong `prisma/schema.prisma`, `model CV`, ngay SAU dòng `template String @default("classic")`, thêm:

```prisma
  accent      String       @default("indigo")
  font        String       @default("roboto")
```

Run: `npm run db:push`
Expected: "Your database is now in sync" (cột có default, an toàn).

- [ ] **Step 8: Commit**

```bash
git add lib/cv/accents.ts lib/cv/fonts.ts lib/cv/__tests__/accents.test.ts lib/cv/__tests__/fonts.test.ts prisma/schema.prisma
git commit -m "feat(cv): accent + font constants/validators + CV columns"
```

---

### Task 2: Bundle 4 file TTF (Be Vietnam Pro + Lora)

**Files:**
- Create: `lib/pdf/fonts/BeVietnamPro-Regular.ttf`, `lib/pdf/fonts/BeVietnamPro-Bold.ttf`, `lib/pdf/fonts/Lora-Regular.ttf`, `lib/pdf/fonts/Lora-Bold.ttf`

**Interfaces:** (tài nguyên nhị phân; Task 3 `Font.register` trỏ tới các đường dẫn này.)

- [ ] **Step 1: Tải 4 file TTF static (đã xác minh URL trả về TTF hợp lệ, magic `00010000`)**

Chạy (bash, tại repo root):

```bash
cd lib/pdf/fonts
curl -sL -o BeVietnamPro-Regular.ttf "https://cdn.jsdelivr.net/npm/@expo-google-fonts/be-vietnam-pro/BeVietnamPro_400Regular.ttf"
curl -sL -o BeVietnamPro-Bold.ttf    "https://cdn.jsdelivr.net/npm/@expo-google-fonts/be-vietnam-pro/BeVietnamPro_700Bold.ttf"
curl -sL -o Lora-Regular.ttf         "https://cdn.jsdelivr.net/npm/@expo-google-fonts/lora/Lora_400Regular.ttf"
curl -sL -o Lora-Bold.ttf            "https://cdn.jsdelivr.net/npm/@expo-google-fonts/lora/Lora_700Bold.ttf"
cd ../../..
```

- [ ] **Step 2: Xác minh 4 file là TTF hợp lệ (magic bytes + kích thước)**

Run:
```bash
for f in BeVietnamPro-Regular BeVietnamPro-Bold Lora-Regular Lora-Bold; do
  p="lib/pdf/fonts/$f.ttf"; sz=$(stat -c%s "$p"); magic=$(xxd -p -l4 "$p");
  echo "$f size=$sz magic=$magic";
done
```
Expected: mỗi file `magic=00010000` và `size` > 100000 (≈130KB–210KB). Nếu bất kỳ file nào `magic` khác (ví dụ `3c21` = HTML) hoặc size < 5000 → tải hỏng: **STATUS BLOCKED**, báo controller (không commit file rác).

- [ ] **Step 3: Commit**

```bash
git add lib/pdf/fonts/BeVietnamPro-Regular.ttf lib/pdf/fonts/BeVietnamPro-Bold.ttf lib/pdf/fonts/Lora-Regular.ttf lib/pdf/fonts/Lora-Bold.ttf
git commit -m "feat(cv): bundle Be Vietnam Pro + Lora TTF fonts for PDF"
```

---

### Task 3: PDF `CvDocument` — style động theo accent + font

**Files:**
- Modify: `lib/pdf/CvDocument.tsx`, `lib/pdf/__tests__/CvDocument.test.tsx`

**Interfaces:**
- Consumes: `CvAccent`/`AccentDef`/`normalizeAccent`/`accentById` (Task 1); `CvFont`/`normalizeFont`/`fontById` (Task 1); TTF (Task 2); `CvTemplate`; `dateRange`/`contactLine`/`eduSubLine`.
- Produces: `CvDocument({ cv, template?, accent?, font? }: { cv: CvInput; template?: CvTemplate; accent?: CvAccent; font?: CvFont })` (mặc định `classic`/`indigo`/`roboto`).

- [ ] **Step 1: Thay toàn bộ `lib/pdf/CvDocument.tsx`**

```tsx
import path from "path";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import type { CvInput } from "@/lib/cv/types";
import type { CvTemplate } from "@/lib/cv/templates";
import { normalizeAccent, accentById, type AccentDef } from "@/lib/cv/accents";
import { normalizeFont, fontById } from "@/lib/cv/fonts";
import type { CvAccent } from "@/lib/cv/accents";
import type { CvFont } from "@/lib/cv/fonts";
import { dateRange, contactLine, eduSubLine } from "@/lib/cv/cv-format";

Font.register({
  family: "Roboto",
  fonts: [
    { src: path.join(process.cwd(), "lib/pdf/fonts/Roboto-Regular.ttf") },
    { src: path.join(process.cwd(), "lib/pdf/fonts/Roboto-Bold.ttf"), fontWeight: "bold" },
  ],
});
Font.register({
  family: "Be Vietnam Pro",
  fonts: [
    { src: path.join(process.cwd(), "lib/pdf/fonts/BeVietnamPro-Regular.ttf") },
    { src: path.join(process.cwd(), "lib/pdf/fonts/BeVietnamPro-Bold.ttf"), fontWeight: "bold" },
  ],
});
Font.register({
  family: "Lora",
  fonts: [
    { src: path.join(process.cwd(), "lib/pdf/fonts/Lora-Regular.ttf") },
    { src: path.join(process.cwd(), "lib/pdf/fonts/Lora-Bold.ttf"), fontWeight: "bold" },
  ],
});

function makeStyles(accent: AccentDef, fontFamily: string) {
  return StyleSheet.create({
    page: { fontFamily, fontSize: 11, color: "#111" },
    pad: { padding: 40 },
    name: { fontSize: 22, fontWeight: "bold" },
    headline: { fontSize: 12, color: "#555", marginBottom: 2 },
    contact: { fontSize: 10, color: "#555", marginBottom: 12 },
    sectionTitle: { fontSize: 13, fontWeight: "bold", marginTop: 14, marginBottom: 6, borderBottom: "1 solid #ccc", paddingBottom: 2 },
    itemTitle: { fontWeight: "bold" },
    itemSub: { color: "#555", fontSize: 10, marginBottom: 2 },
    text: { marginBottom: 4, lineHeight: 1.4 },
    skillRow: { marginBottom: 2 },
    modernHeader: { backgroundColor: accent.hex, padding: 28 },
    modernName: { fontSize: 22, fontWeight: "bold", color: "#fff" },
    modernHeadline: { fontSize: 12, color: accent.onDark, marginTop: 2 },
    modernContact: { fontSize: 10, color: accent.onDark, marginTop: 6 },
    modernBody: { padding: 32, paddingTop: 20 },
    modernSectionTitle: { fontSize: 13, fontWeight: "bold", color: accent.hex, marginTop: 14, marginBottom: 6 },
    row: { flexDirection: "row" },
    sbLeft: { width: "34%", backgroundColor: accent.soft, padding: 20 },
    sbRight: { width: "66%", padding: 24 },
    sbName: { fontSize: 18, fontWeight: "bold" },
    sbHeadline: { fontSize: 11, color: "#555", marginBottom: 8 },
    sbLeftTitle: { fontSize: 11, fontWeight: "bold", color: accent.hex, marginTop: 14, marginBottom: 4 },
    sbLeftText: { fontSize: 10, color: "#333", marginBottom: 3, lineHeight: 1.3 },
    sbRightTitle: { fontSize: 13, fontWeight: "bold", color: accent.hex, marginTop: 12, marginBottom: 6 },
  });
}

type CvStyles = ReturnType<typeof makeStyles>;

function ExperienceItems({ cv, s }: { cv: CvInput; s: CvStyles }) {
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
function EducationItems({ cv, s }: { cv: CvInput; s: CvStyles }) {
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
function ProjectItems({ cv, s }: { cv: CvInput; s: CvStyles }) {
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
function SkillLines({ cv, s }: { cv: CvInput; s: CvStyles }) {
  return (
    <>
      {cv.skills.map((sk, i) => (
        <Text key={i} style={s.skillRow}>• {sk.name}{sk.level ? ` (${sk.level})` : ""}</Text>
      ))}
    </>
  );
}

function ClassicPage({ cv, s }: { cv: CvInput; s: CvStyles }) {
  const p = cv.profile;
  const contact = contactLine(p.email, p.phone);
  return (
    <Page style={[s.page, s.pad]}>
      <Text style={s.name}>{p.fullName || "Chưa có tên"}</Text>
      {p.headline ? <Text style={s.headline}>{p.headline}</Text> : null}
      {contact ? <Text style={s.contact}>{contact}</Text> : null}
      {p.summary ? <Text style={s.text}>{p.summary}</Text> : null}
      {cv.experiences.length > 0 && (<View><Text style={s.sectionTitle}>Kinh nghiệm làm việc</Text><ExperienceItems cv={cv} s={s} /></View>)}
      {cv.educations.length > 0 && (<View><Text style={s.sectionTitle}>Học vấn</Text><EducationItems cv={cv} s={s} /></View>)}
      {cv.skills.length > 0 && (<View><Text style={s.sectionTitle}>Kỹ năng</Text><SkillLines cv={cv} s={s} /></View>)}
      {cv.projects.length > 0 && (<View><Text style={s.sectionTitle}>Dự án</Text><ProjectItems cv={cv} s={s} /></View>)}
    </Page>
  );
}

function ModernPage({ cv, s }: { cv: CvInput; s: CvStyles }) {
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
        {cv.experiences.length > 0 && (<View><Text style={s.modernSectionTitle}>Kinh nghiệm làm việc</Text><ExperienceItems cv={cv} s={s} /></View>)}
        {cv.educations.length > 0 && (<View><Text style={s.modernSectionTitle}>Học vấn</Text><EducationItems cv={cv} s={s} /></View>)}
        {cv.skills.length > 0 && (<View><Text style={s.modernSectionTitle}>Kỹ năng</Text><SkillLines cv={cv} s={s} /></View>)}
        {cv.projects.length > 0 && (<View><Text style={s.modernSectionTitle}>Dự án</Text><ProjectItems cv={cv} s={s} /></View>)}
      </View>
    </Page>
  );
}

function SidebarPage({ cv, s }: { cv: CvInput; s: CvStyles }) {
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
          {cv.experiences.length > 0 && (<View><Text style={s.sbRightTitle}>Kinh nghiệm làm việc</Text><ExperienceItems cv={cv} s={s} /></View>)}
          {cv.educations.length > 0 && (<View><Text style={s.sbRightTitle}>Học vấn</Text><EducationItems cv={cv} s={s} /></View>)}
          {cv.projects.length > 0 && (<View><Text style={s.sbRightTitle}>Dự án</Text><ProjectItems cv={cv} s={s} /></View>)}
        </View>
      </View>
    </Page>
  );
}

export function CvDocument({
  cv,
  template = "classic",
  accent = "indigo",
  font = "roboto",
}: {
  cv: CvInput;
  template?: CvTemplate;
  accent?: CvAccent;
  font?: CvFont;
}) {
  const a = accentById(normalizeAccent(accent));
  const family = fontById(normalizeFont(font)).pdfFamily;
  const s = makeStyles(a, family);
  return (
    <Document>
      {template === "modern" ? <ModernPage cv={cv} s={s} /> : template === "sidebar" ? <SidebarPage cv={cv} s={s} /> : <ClassicPage cv={cv} s={s} />}
    </Document>
  );
}
```

- [ ] **Step 2: Mở rộng test PDF cho accent+font**

Trong `lib/pdf/__tests__/CvDocument.test.tsx`, GIỮ 2 khối test hiện có, thêm khối:

```tsx
  it.each([
    { template: "modern", accent: "rose", font: "lora" },
    { template: "sidebar", accent: "emerald", font: "bevietnam" },
    { template: "classic", accent: "amber", font: "bevietnam" },
  ] as const)(
    "render với accent+font (%o) ra PDF hợp lệ",
    async ({ template, accent, font }) => {
      const buffer = await renderToBuffer(<CvDocument cv={sample} template={template} accent={accent} font={font} />);
      expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
      expect(buffer.length).toBeGreaterThan(2000);
    },
  );
```

- [ ] **Step 3: Chạy test**

Run: `npm test -- CvDocument`
Expected: PASS (test cũ + 3 case mới). Font mới đã đăng ký, render tiếng Việt không lỗi.

- [ ] **Step 4: Commit**

```bash
git add lib/pdf/CvDocument.tsx lib/pdf/__tests__/CvDocument.test.tsx
git commit -m "feat(cv): CvDocument dynamic accent + font in PDF"
```

---

### Task 4: Preview HTML theo accent + font + nạp font web

**Files:**
- Modify: `components/cv/CvPreview.tsx`, `components/cv/preview/ModernPreview.tsx`, `components/cv/preview/SidebarPreview.tsx`, `app/layout.tsx`

**Interfaces:**
- Consumes: `CvAccent`/`AccentDef`/`normalizeAccent`/`accentById`, `CvFont`/`normalizeFont`/`fontById` (Task 1); `CvTemplate`.
- Produces: `CvPreview({ cv, template?, accent?, font? })`; `ModernPreview({ cv, accent }: { cv: CvInput; accent: AccentDef })`; `SidebarPreview({ cv, accent }: { cv: CvInput; accent: AccentDef })`.

- [ ] **Step 1: Nạp 2 font web trong `app/layout.tsx`**

Thêm import font cạnh Geist:

```tsx
import { Be_Vietnam_Pro, Lora } from "next/font/google";
```

Sau khối `geistMono`, thêm:

```tsx
const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["vietnamese", "latin"],
  weight: ["400", "700"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["vietnamese", "latin"],
  weight: ["400", "700"],
});
```

Đổi className `<html>` để thêm 2 biến:

```tsx
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} ${beVietnamPro.variable} ${lora.variable} h-full antialiased`}
    >
```

- [ ] **Step 2: Viết lại `components/cv/CvPreview.tsx`**

```tsx
import type { CvInput } from "@/lib/cv/types";
import type { CvTemplate } from "@/lib/cv/templates";
import { normalizeAccent, accentById, type CvAccent } from "@/lib/cv/accents";
import { normalizeFont, fontById, type CvFont } from "@/lib/cv/fonts";
import ClassicPreview from "./preview/ClassicPreview";
import ModernPreview from "./preview/ModernPreview";
import SidebarPreview from "./preview/SidebarPreview";

// "Tờ giấy" CV: nền trắng bo góc + bóng; nội dung theo mẫu (slate + accent cố ý ngoài token).
export default function CvPreview({
  cv,
  template = "classic",
  accent = "indigo",
  font = "roboto",
}: {
  cv: CvInput;
  template?: CvTemplate;
  accent?: CvAccent;
  font?: CvFont;
}) {
  const a = accentById(normalizeAccent(accent));
  const stack = fontById(normalizeFont(font)).cssStack;
  return (
    <div
      className="mx-auto w-full max-w-[210mm] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
      style={stack ? { fontFamily: stack } : undefined}
    >
      {template === "modern" ? (
        <ModernPreview cv={cv} accent={a} />
      ) : template === "sidebar" ? (
        <SidebarPreview cv={cv} accent={a} />
      ) : (
        <ClassicPreview cv={cv} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Viết lại `components/cv/preview/ModernPreview.tsx`**

```tsx
import type { CvInput } from "@/lib/cv/types";
import type { AccentDef } from "@/lib/cv/accents";
import { contactLine } from "@/lib/cv/cv-format";
import { ExperienceList, EducationList, ProjectList } from "./sections";

function Title({ color, children }: { color: string; children: React.ReactNode }) {
  return <h2 className="mt-4 mb-1.5 text-[13px] font-bold" style={{ color }}>{children}</h2>;
}

export default function ModernPreview({ cv, accent }: { cv: CvInput; accent: AccentDef }) {
  const p = cv.profile;
  const contact = contactLine(p.email, p.phone);
  return (
    <div className="text-[11px] leading-relaxed text-slate-900">
      <div className="px-8 py-6 text-white" style={{ backgroundColor: accent.hex }}>
        <div className="text-[22px] font-bold">{p.fullName || "Chưa có tên"}</div>
        {p.headline && <div className="text-[12px]" style={{ color: accent.onDark }}>{p.headline}</div>}
        {contact && <div className="mt-1 text-[10px]" style={{ color: accent.onDark }}>{contact}</div>}
      </div>
      <div className="p-8">
        {p.summary && <p className="mb-1">{p.summary}</p>}
        {cv.experiences.length > 0 && (<section><Title color={accent.hex}>Kinh nghiệm làm việc</Title><ExperienceList cv={cv} /></section>)}
        {cv.educations.length > 0 && (<section><Title color={accent.hex}>Học vấn</Title><EducationList cv={cv} /></section>)}
        {cv.skills.length > 0 && (
          <section><Title color={accent.hex}>Kỹ năng</Title>
            {cv.skills.map((sk, i) => (<div key={i}>• {sk.name}{sk.level ? ` (${sk.level})` : ""}</div>))}
          </section>
        )}
        {cv.projects.length > 0 && (<section><Title color={accent.hex}>Dự án</Title><ProjectList cv={cv} /></section>)}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Viết lại `components/cv/preview/SidebarPreview.tsx`**

```tsx
import type { CvInput } from "@/lib/cv/types";
import type { AccentDef } from "@/lib/cv/accents";
import { ExperienceList, EducationList, ProjectList } from "./sections";

function Title({ color, children }: { color: string; children: React.ReactNode }) {
  return <h2 className="mt-3 mb-1.5 text-[13px] font-bold" style={{ color }}>{children}</h2>;
}

export default function SidebarPreview({ cv, accent }: { cv: CvInput; accent: AccentDef }) {
  const p = cv.profile;
  return (
    <div className="flex text-[11px] leading-relaxed text-slate-900">
      <div className="w-1/3 p-6" style={{ backgroundColor: accent.soft }}>
        <div className="text-[18px] font-bold">{p.fullName || "Chưa có tên"}</div>
        {p.headline && <div className="mb-2 text-[11px] text-slate-500">{p.headline}</div>}
        <h3 className="mt-3 mb-1 text-[11px] font-bold" style={{ color: accent.hex }}>Liên hệ</h3>
        {p.email && <div className="text-[10px] text-slate-600">{p.email}</div>}
        {p.phone && <div className="text-[10px] text-slate-600">{p.phone}</div>}
        {cv.skills.length > 0 && (
          <>
            <h3 className="mt-3 mb-1 text-[11px] font-bold" style={{ color: accent.hex }}>Kỹ năng</h3>
            {cv.skills.map((sk, i) => (
              <div key={i} className="text-[10px] text-slate-600">• {sk.name}{sk.level ? ` (${sk.level})` : ""}</div>
            ))}
          </>
        )}
      </div>
      <div className="w-2/3 p-6">
        {p.summary && <p className="mb-1">{p.summary}</p>}
        {cv.experiences.length > 0 && (<section><Title color={accent.hex}>Kinh nghiệm làm việc</Title><ExperienceList cv={cv} /></section>)}
        {cv.educations.length > 0 && (<section><Title color={accent.hex}>Học vấn</Title><EducationList cv={cv} /></section>)}
        {cv.projects.length > 0 && (<section><Title color={accent.hex}>Dự án</Title><ProjectList cv={cv} /></section>)}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify build + lint**

Run: `npm run lint` rồi `npm run build`
Expected: thành công. `CvEditor` vẫn gọi `<CvPreview cv={cv} template={template} />` (accent/font mặc định) — chưa vỡ; default preview không đổi (roboto → không set fontFamily).

- [ ] **Step 6: Commit**

```bash
git add components/cv/CvPreview.tsx components/cv/preview/ModernPreview.tsx components/cv/preview/SidebarPreview.tsx app/layout.tsx
git commit -m "feat(cv): CvPreview accent + font (inline styles + next/font)"
```

---

### Task 5: Nối accent+font end-to-end (saveCv, page, route, CvEditor)

**Files:**
- Modify: `lib/cv/actions.ts`, `app/cv/[id]/page.tsx`, `app/api/cv/[id]/pdf/route.tsx`, `app/cv/[id]/CvEditor.tsx`

**Interfaces:**
- Consumes: `normalizeAccent`/`CV_ACCENTS`/`CvAccent`, `normalizeFont`/`CV_FONTS`/`CvFont` (Task 1); `CvPreview` với prop `accent`/`font` (Task 4).
- Produces: `saveCv(cvId, input, template?, accent?, font?)` (thêm tham số 4 & 5, mặc định không có → indigo/roboto).

- [ ] **Step 1: `saveCv` nhận `accent`/`font`**

Trong `lib/cv/actions.ts`:
- Thêm import: `import { normalizeAccent, type CvAccent } from "./accents";` và `import { normalizeFont, type CvFont } from "./fonts";`
- Đổi chữ ký:

```ts
export async function saveCv(
  cvId: string,
  input: CvInput,
  template?: CvTemplate,
  accent?: CvAccent,
  font?: CvFont,
): Promise<{ ok: boolean; error?: string }> {
```

- Trong `tx.cV.update`, thêm 2 cột:

```ts
    await tx.cV.update({
      where: { id: cvId },
      data: {
        title: data.title || "CV chưa đặt tên",
        template: normalizeTemplate(template),
        accent: normalizeAccent(accent),
        font: normalizeFont(font),
      },
    });
```

- [ ] **Step 2: `app/cv/[id]/page.tsx` đọc + truyền initial**

- Thêm import: `import { normalizeAccent } from "@/lib/cv/accents";` và `import { normalizeFont } from "@/lib/cv/fonts";`
- Đổi dòng return cuối:

```tsx
  return (
    <CvEditor
      cvId={cv.id}
      initial={initial}
      initialTemplate={normalizeTemplate(cv.template)}
      initialAccent={normalizeAccent(cv.accent)}
      initialFont={normalizeFont(cv.font)}
    />
  );
```

(`cv.accent`/`cv.font` là scalar có sẵn từ `findFirst`.)

- [ ] **Step 3: Route PDF đọc + truyền accent/font**

Trong `app/api/cv/[id]/pdf/route.tsx`:
- Thêm import: `import { normalizeAccent } from "@/lib/cv/accents";` và `import { normalizeFont } from "@/lib/cv/fonts";`
- Đổi dòng render:

```tsx
  const buffer = await renderToBuffer(
    <CvDocument
      cv={data}
      template={normalizeTemplate(cv.template)}
      accent={normalizeAccent(cv.accent)}
      font={normalizeFont(cv.font)}
    />,
  );
```

- [ ] **Step 4: `CvEditor` — state + 2 bộ chọn + truyền xuống**

Trong `app/cv/[id]/CvEditor.tsx`:
- Thêm import: `import { CV_ACCENTS, type CvAccent } from "@/lib/cv/accents";` và `import { CV_FONTS, type CvFont } from "@/lib/cv/fonts";`
- Đổi props + state:

```tsx
export default function CvEditor({
  cvId,
  initial,
  initialTemplate,
  initialAccent,
  initialFont,
}: {
  cvId: string;
  initial: CvInput;
  initialTemplate: CvTemplate;
  initialAccent: CvAccent;
  initialFont: CvFont;
}) {
  const [cv, setCv] = useState<CvInput>(initial);
  const [template, setTemplate] = useState<CvTemplate>(initialTemplate);
  const [accent, setAccent] = useState<CvAccent>(initialAccent);
  const [font, setFont] = useState<CvFont>(initialFont);
  const [pending, startTransition] = useTransition();
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
```

- Đổi `onSave`:

```ts
      const res = await saveCv(cvId, cv, template, accent, font);
```

- Ngay SAU khối `{/* Bộ chọn mẫu CV */}` (kết thúc ở `</div>` của khối đó), thêm 2 khối chọn màu + font:

```tsx
      {/* Bộ chọn màu nhấn */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 pt-3">
        <span className="text-sm text-muted-foreground">Màu nhấn:</span>
        {CV_ACCENTS.map((a) => (
          <button
            key={a.id}
            type="button"
            title={a.label}
            aria-label={a.label}
            onClick={() => setAccent(a.id)}
            className={`h-6 w-6 rounded-full border-2 ${accent === a.id ? "border-foreground" : "border-transparent"}`}
            style={{ backgroundColor: a.hex }}
          />
        ))}
      </div>

      {/* Bộ chọn font */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 pt-3">
        <span className="text-sm text-muted-foreground">Font:</span>
        {CV_FONTS.map((f) => (
          <Button
            key={f.id}
            type="button"
            size="sm"
            variant={font === f.id ? "default" : "outline"}
            onClick={() => setFont(f.id)}
          >
            {f.label}
          </Button>
        ))}
      </div>
```

- Truyền vào preview (dòng trong cột phải):

```tsx
            <CvPreview cv={cv} template={template} accent={accent} font={font} />
```

- [ ] **Step 5: Verify build + lint**

Run: `npm run lint` rồi `npm run build`
Expected: thành công (type khớp: `initialAccent`/`initialFont` bắt buộc, page truyền vào).

- [ ] **Step 6: Commit**

```bash
git add lib/cv/actions.ts app/cv/[id]/page.tsx app/api/cv/[id]/pdf/route.tsx app/cv/[id]/CvEditor.tsx
git commit -m "feat(cv): wire accent + font through save, editor, preview, PDF"
```

---

### Task 6: Rà soát & kiểm thử tổng

**Files:** (rà soát)

- [ ] **Step 1: Chạy toàn bộ test**

Run: `npm test`
Expected: PASS (gồm `accents`, `fonts`, `CvDocument` accent+font).

- [ ] **Step 2: Build production**

Run: `npm run build`
Expected: thành công, không lỗi type.

- [ ] **Step 3: Chạy thử thủ công (khuyến nghị)**

Run: `npm run dev` — mở một CV: đổi màu nhấn (preview modern/sidebar đổi màu ngay; classic không đổi màu), đổi font (preview đổi font; Roboto giữ nguyên như trước), Lưu, rồi "Xuất PDF" xác nhận PDF đúng màu + font đã lưu, tiếng Việt hiển thị đủ dấu ở cả 3 font.

- [ ] **Step 4: Commit dọn dẹp nếu có**

```bash
git add -A
git commit -m "chore(cv): finalize accent + font feature"
```

---

## Self-Review (đã thực hiện khi viết plan)

- **Spec coverage:** hằng accents/fonts + 2 cột → Task 1; bundle TTF → Task 2; PDF động accent/font + test → Task 3; preview inline style + next/font → Task 4; nối saveCv/page/route/CvEditor + 2 bộ chọn → Task 5; kiểm thử → Task 6. ✅
- **Placeholder scan:** không TODO/TBD; mọi bước có code/lệnh cụ thể; URL font đã xác minh trả TTF hợp lệ (magic `00010000`).
- **Type consistency:** `CvAccent`/`AccentDef`/`normalizeAccent`/`accentById` và `CvFont`/`FontDef`/`normalizeFont`/`fontById` (Task 1) dùng nhất quán ở Task 3 (PDF), Task 4 (preview nhận `accent: AccentDef`), Task 5 (saveCv/page/route/editor). `CvDocument({cv,template?,accent?,font?})` & `CvPreview({cv,template?,accent?,font?})` cùng dạng, mặc định classic/indigo/roboto. `saveCv(cvId,input,template?,accent?,font?)` — nơi gọi duy nhất là `CvEditor` (cập nhật Task 5). `initialAccent`/`initialFont` bắt buộc ở `CvEditor`, page truyền `normalizeAccent(cv.accent)`/`normalizeFont(cv.font)`.
- **Bảo toàn mặc định:** `makeStyles(accentById("indigo"),"Roboto")` cho giá trị style trùng khít bản tĩnh cũ (indigo hex/soft/onDark khớp, fontFamily Roboto); preview roboto → không set `fontFamily` (giữ font app). Classic không tham chiếu accent → trung tính.
- **Thứ tự an toàn:** Task 3 phụ thuộc Task 1+2 (font TTF phải có trước khi `Font.register`); Task 4 phụ thuộc Task 1; Task 5 phụ thuộc 1/3/4. Task 2/3/4 để accent/font optional (mặc định) nên app không vỡ giữa chừng; Task 5 mới truyền giá trị thật + đổi chữ ký page (bắt buộc initial).
