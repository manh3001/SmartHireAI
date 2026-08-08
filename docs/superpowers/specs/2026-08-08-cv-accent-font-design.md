# Tùy chỉnh màu nhấn & font cho CV — Thiết kế

**Ngày:** 2026-08-08
**Trạng thái:** Đã duyệt (brainstorming)

## Mục tiêu

Cho ứng viên chọn **màu nhấn** (bảng preset) và **font** (bộ 3) áp cho cả xem trước (HTML) lẫn PDF, giữ nguyên dữ liệu CV và nối tiếp tính năng CV templates. Mở rộng, không thay thế: mặc định trùng khít giao diện hiện tại nên CV cũ render y hệt.

## Phạm vi (quyết định khi brainstorm)

- **Màu nhấn:** bảng **preset** (không color picker tự do). 6 màu, mỗi màu có hex cố định + 2 tint dẫn xuất.
- **Font:** bộ **3 font** — Roboto (mặc định, đã có), Be Vietnam Pro (sans, hỗ trợ tiếng Việt), Lora (serif, hỗ trợ tiếng Việt). Mỗi font mới = 2 file TTF (Regular + Bold) bundle vào `lib/pdf/fonts/`.
- **Classic giữ trung tính:** màu nhấn chỉ hiển thị ở mẫu **modern/sidebar**; classic không dùng accent (bảo toàn bất biến classic). **Font áp cho mọi mẫu.**
- Preview nạp font qua **`next/font/google`** (Be_Vietnam_Pro, Lora).
- **KHÔNG** làm: color picker tự do; accent trên classic; đổi `CvInput`/AI/auth/realtime.

## Dữ liệu — Prisma (2 cột mới trên `model CV`)

Theo đúng pattern cột `template` hiện có:

```prisma
  accent      String       @default("indigo")
  font        String       @default("roboto")
```

Đồng bộ bằng `npm run db:push` (cột có default → an toàn, không migration tay). Không đụng `CvInput` (accent/font là prop trình bày, như template).

## Hằng số + validator (hàm thuần, có test)

### `lib/cv/accents.ts`

```ts
export type CvAccent = "indigo" | "blue" | "emerald" | "rose" | "amber" | "slate";

export type AccentDef = {
  id: CvAccent;
  label: string;   // tiếng Việt
  hex: string;     // màu nhấn chính (PDF + preview)
  soft: string;    // nền nhạt (sidebar trái)
  onDark: string;  // chữ nhạt trên nền accent (header modern)
};
```

`CV_ACCENTS` (đúng thứ tự, id duy nhất):

| id | label | hex | soft | onDark |
|---|---|---|---|---|
| indigo | Chàm | `#4f46e5` | `#eef2ff` | `#e0e7ff` |
| blue | Xanh dương | `#2563eb` | `#eff6ff` | `#dbeafe` |
| emerald | Lục | `#059669` | `#ecfdf5` | `#d1fae5` |
| rose | Đỏ mận | `#e11d48` | `#fff1f2` | `#ffe4e6` |
| amber | Cam | `#d97706` | `#fffbeb` | `#fef3c7` |
| slate | Xám than | `#334155` | `#f1f5f9` | `#e2e8f0` |

Hàm: `isCvAccent(v): v is CvAccent`; `normalizeAccent(v): CvAccent` (lạ/null/undefined → `"indigo"`); `accentById(id: CvAccent): AccentDef`.

**Lưu ý bất biến:** dòng `indigo` (`#4f46e5`/`#eef2ff`/`#e0e7ff`) trùng khít hằng số PDF hiện tại (`ACCENT`, `sbLeft` bg, `modern*` onDark) → mặc định giữ output cũ.

### `lib/cv/fonts.ts`

```ts
export type CvFont = "roboto" | "bevietnam" | "lora";

export type FontDef = {
  id: CvFont;
  label: string;
  pdfFamily: string;  // tên family đã Font.register cho react-pdf
  cssStack: string;   // font-family cho preview HTML
};
```

`CV_FONTS`:

| id | label | pdfFamily | cssStack |
|---|---|---|---|
| roboto | Roboto (mặc định) | `Roboto` | `'Roboto', sans-serif` |
| bevietnam | Be Vietnam Pro | `Be Vietnam Pro` | `'Be Vietnam Pro', sans-serif` |
| lora | Lora (serif) | `Lora` | `'Lora', serif` |

Hàm: `isCvFont`, `normalizeFont` (→ `"roboto"`), `fontById(id): FontDef`.

## PDF — `lib/pdf/CvDocument.tsx`

- **Đăng ký font:** giữ `Font.register` Roboto; thêm 2 lần đăng ký cho Be Vietnam Pro và Lora (mỗi họ Regular + Bold `fontWeight: "bold"`), trỏ tới file TTF trong `lib/pdf/fonts/`.
- **Style động:** đổi `const s = StyleSheet.create({...})` tĩnh thành hàm `makeStyles(accent: AccentDef, fontFamily: string)` gọi bên trong render:
  - `page.fontFamily = fontFamily`.
  - Mọi chỗ dùng `ACCENT` → `accent.hex` (`modernHeader` bg, `modernSectionTitle`/`sbLeftTitle`/`sbRightTitle` color).
  - `sbLeft` backgroundColor `#eef2ff` → `accent.soft`.
  - `modernHeadline`/`modernContact` color `#e0e7ff` → `accent.onDark`.
  - Các màu trung tính khác (#111/#555/#ccc/#333/#fff) giữ nguyên.
- **Chữ ký:** `CvDocument({ cv, template = "classic", accent = "indigo", font = "roboto" }: { cv: CvInput; template?: CvTemplate; accent?: CvAccent; font?: CvFont })`. Bên trong: `const a = accentById(normalizeAccent(accent))`, `const family = fontById(normalizeFont(font)).pdfFamily`, `const s = makeStyles(a, family)`; truyền `s` xuống các Page component.
- **Classic:** dùng `s` với `fontFamily` đã đổi (font áp classic) nhưng ClassicPage không tham chiếu `accent.hex`/`soft`/`onDark` → accent vô hình ở classic (giữ trung tính).

## Preview HTML — `components/cv/preview/*` + `CvPreview.tsx`

- `CvPreview({ cv, template = "classic", accent = "indigo", font = "roboto" })` — chuẩn hóa rồi truyền `accentDef` + `cssStack` xuống các preview con; đặt `style={{ fontFamily: cssStack }}` trên wrapper "giấy".
- **ModernPreview:** thay `bg-indigo-600` → `style={{ backgroundColor: hex }}`; `text-indigo-100` → `style={{ color: onDark }}`; tiêu đề `text-indigo-600` → `style={{ color: hex }}`.
- **SidebarPreview:** `bg-indigo-50` → `style={{ backgroundColor: soft }}`; `text-indigo-600` → `style={{ color: hex }}`.
- **ClassicPreview:** giữ slate trung tính (accent không áp); chỉ nhận font qua wrapper cha.
- `sections.tsx` không dùng màu accent (chỉ slate) → không đổi màu; nếu cần nhận props thì giữ nguyên API.
- Giữ `className` nháy thẳng ASCII cho phần Tailwind tĩnh còn lại.

## Nạp font web cho preview — `app/layout.tsx`

Dùng `next/font/google`: import `Be_Vietnam_Pro`, `Lora` (subset `vietnamese`, weight 400/700), gắn `variable` hoặc class vào `<body>` để `cssStack` (`'Be Vietnam Pro'`, `'Lora'`) khớp tên family khả dụng. Roboto giữ như hiện tại.

## Nối end-to-end

- **`lib/cv/actions.ts`:** `saveCv(cvId, input, template?, accent?, font?)`; ghi `template: normalizeTemplate(template)`, `accent: normalizeAccent(accent)`, `font: normalizeFont(font)`.
- **`app/cv/[id]/page.tsx`:** đọc `cv.accent`, `cv.font` (scalar có sẵn); truyền `initialAccent={normalizeAccent(cv.accent)}`, `initialFont={normalizeFont(cv.font)}`.
- **`app/api/cv/[id]/pdf/route.tsx`:** `renderToBuffer(<CvDocument cv={data} template={...} accent={normalizeAccent(cv.accent)} font={normalizeFont(cv.font)} />)`.
- **`app/cv/[id]/CvEditor.tsx`:** state `accent`/`font` (khởi từ initial); 2 bộ chọn dưới bộ chọn mẫu — dải **swatch màu** (`CV_ACCENTS`, ô tròn nền `hex`, viền đậm khi chọn) + hàng **nút font** (`CV_FONTS`, giống bộ chọn template); preview truyền `accent`/`font`; `onSave` gọi `saveCv(cvId, cv, template, accent, font)`.

## Kiểm thử

- **Hàm thuần** (bắt buộc):
  - `lib/cv/__tests__/accents.test.ts`: đúng 6 màu, id duy nhất & đúng thứ tự; `isCvAccent` nhận id hợp lệ/từ chối lạ; `normalizeAccent` hợp lệ giữ nguyên, lạ/rỗng/null/undefined → `indigo`; `accentById("indigo").hex === "#4f46e5"`.
  - `lib/cv/__tests__/fonts.test.ts`: đúng 3 font, id duy nhất; `normalizeFont` lạ→`roboto`; `fontById("lora").pdfFamily === "Lora"`.
- **Mở rộng PDF** `lib/pdf/__tests__/CvDocument.test.tsx`: render vài tổ hợp (mặc định; `template=modern accent=rose font=lora`; `template=sidebar accent=emerald font=bevietnam`) → buffer bắt đầu `%PDF-`, length > 2000. Giữ test cũ.
- Component/route/page **không** unit-test.

## Ràng buộc chung

- Prisma **pinned v6**; chỉ thêm 2 cột (`accent`, `font`); `npm run db:push`.
- Không đổi `CvInput`, AI, auth, realtime, phân quyền.
- `className` **nháy thẳng ASCII**; nội dung tiếng Việt; thương hiệu **SmartHire**.
- Mặc định `indigo`/`roboto` phải giữ output PDF + preview **y hệt hiện tại** (regression classic/modern/sidebar mặc định).
- Windows: `npm test`, `npm run lint`, `npm run build`, `npm run db:push`.

## Files

**Tạo mới:**
- `lib/cv/accents.ts` + `lib/cv/__tests__/accents.test.ts`
- `lib/cv/fonts.ts` + `lib/cv/__tests__/fonts.test.ts`
- 4 file TTF: `lib/pdf/fonts/BeVietnamPro-Regular.ttf`, `BeVietnamPro-Bold.ttf`, `Lora-Regular.ttf`, `Lora-Bold.ttf` (tải Google Fonts).

**Sửa:**
- `prisma/schema.prisma` (2 cột)
- `lib/pdf/CvDocument.tsx` + `lib/pdf/__tests__/CvDocument.test.tsx`
- `components/cv/CvPreview.tsx`, `components/cv/preview/ModernPreview.tsx`, `components/cv/preview/SidebarPreview.tsx` (Classic/sections chỉ đổi nếu cần truyền props)
- `lib/cv/actions.ts`
- `app/cv/[id]/page.tsx`, `app/cv/[id]/CvEditor.tsx`
- `app/api/cv/[id]/pdf/route.tsx`
- `app/layout.tsx` (next/font)
