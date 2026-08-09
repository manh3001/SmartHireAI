# Thông báo việc làm (Job Alerts) — Design Spec

**Ngày:** 2026-08-09

## Mục tiêu

Cho ứng viên lưu bộ lọc việc làm thành "thông báo" (job alert). Khi nhà tuyển dụng đăng một tin công khai **mới** khớp tiêu chí, ứng viên nhận **thông báo trong ứng dụng** (tái dùng `Notification` + realtime poll sẵn có). Không dùng email, không cron.

## Quyết định thiết kế (đã chốt khi brainstorm)

- **Kênh:** chỉ in-app (không email). Tái dùng model `Notification` + `createNotification` + RealtimeProvider (poll 12s → toast/badge).
- **Định nghĩa alert:** lưu bộ lọc hiện tại từ trang `/jobs` (tái dùng `JobsFilter`).
- **Kích hoạt:** event-driven — ngay khi tạo tin công khai mới (`createJobDescription`). Không cron, không digest.
- **Khớp:** hàm thuần trong bộ nhớ `matchesAlert(job, criteria)` (unit-test kỹ), thay vì query DB mỗi alert.

## Phạm vi

**Trong phạm vi:** model `JobAlert`; hàm khớp thuần + nhãn; hook thông báo lúc tạo tin; nút "Lưu làm thông báo" ở `/jobs`; trang quản lý `/jobs/alerts` (liệt kê + xóa); server actions tạo/xóa alert; link điều hướng nhỏ ở `/jobs`.

**Ngoài phạm vi:** email; cron/digest định kỳ; bắn thông báo khi admin toggle lại công khai (tránh gửi trùng); backfill tin cũ đã đăng trước khi tạo alert (đã hiển thị ở `/jobs`); alert cho nhà tuyển dụng.

## Kiến trúc

### 1. Data model (`prisma/schema.prisma`)

Thêm model mới (đồng bộ bằng `npm run db:push`, an toàn vì chỉ thêm bảng):

```prisma
model JobAlert {
  id              String           @id @default(cuid())
  userId          String
  user            User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  label           String           @default("")
  term            String?
  category        String?
  location        String?
  employmentType  EmploymentType?
  experienceLevel ExperienceLevel?
  salaryMillions  Int?
  createdAt       DateTime         @default(now())

  @@index([userId])
}
```

Thêm quan hệ vào `model User`: `jobAlerts JobAlert[]`.

Các cột tiêu chí ánh xạ 1-1 với `JobsFilter` (cộng `location` để lọc riêng, vì `buildJobsWhere` hiện chỉ khớp location qua `term`). `label` là nhãn gợi nhớ, tự sinh từ tiêu chí nếu rỗng.

### 2. Logic khớp thuần (`lib/jobs/alerts.ts`)

```ts
export type AlertCriteria = {
  term?: string;
  category?: JobCategory;
  location?: string;
  employmentType?: EmploymentType;
  experienceLevel?: ExperienceLevel;
  salaryMillions?: number | null;
};

// Dữ liệu tin tối thiểu cần để khớp
export type MatchableJob = {
  title: string;
  company: string;
  rawText: string;
  location: string | null;
  skills: string;
  category: string | null;
  employmentType: EmploymentType | null;
  experienceLevel: ExperienceLevel | null;
  salaryMax: number | null;
  salaryNegotiable: boolean;
};

export function matchesAlert(job: MatchableJob, c: AlertCriteria): boolean;
export function alertLabel(c: AlertCriteria): string;
export function criteriaFromFilter(f: JobsFilter): AlertCriteria;
export function criteriaToQuery(c: AlertCriteria): Record<string, string>; // dựng querystring cho link /jobs
```

**`matchesAlert`** — AND các tiêu chí **có mặt** (tiêu chí rỗng/undefined bị bỏ qua ⇒ rỗng hết = khớp mọi tin):
- `term`: contains không phân biệt hoa/thường trên `title | company | rawText | location | skills` (y ngữ nghĩa nhánh OR của `buildJobsWhere`).
- `category` / `employmentType` / `experienceLevel`: so bằng đúng.
- `location`: contains không phân biệt hoa/thường trên `job.location` (khớp riêng, độc lập với `term`).
- `salaryMillions` (ngưỡng "từ"): khớp khi `job.salaryMax != null && job.salaryMax >= salaryMillions * 1_000_000` **HOẶC** `job.salaryNegotiable === true` (soi theo `salaryWhere`).

**`alertLabel`** — sinh nhãn tiếng Việt gọn nối bằng " · " (ví dụ `"React · Hà Nội · Toàn thời gian"`, dùng nhãn ngành/loại hình/cấp bậc tiếng Việt sẵn có). Rỗng hết → `"Tất cả việc làm"`.

**`criteriaFromFilter`** — chuẩn hóa `JobsFilter` (từ UI) thành `AlertCriteria` để lưu.

Toàn bộ là hàm thuần, không phụ thuộc Prisma/AI → test bằng Vitest.

### 3. Kích hoạt thông báo (`lib/jobs/alert-notify.ts`)

```ts
export async function notifyMatchingAlerts(job: {
  id: string; title: string; company: string; userId: string; /* + các trường MatchableJob */
}): Promise<void>;
```

- Nạp tất cả `JobAlert` (chọn `userId` + các cột tiêu chí).
- Lọc `matchesAlert(job, criteria)`.
- Gom `userId` vào `Set` (1 người nhận **1** thông báo/tin dù trùng nhiều alert); **loại `job.userId`** (người đăng tin).
- Với mỗi userId còn lại: `createNotification(userId, { message: "Tin mới khớp thông báo của bạn: <title> — <company>", link: "/jobs/<id>" })`.

Gọi trong `createJobDescription` ngay sau khi `prisma.jobDescription.create` thành công (tin tạo ra luôn `isPublic: true`). Bọc **try/catch nuốt lỗi** để lỗi thông báo không làm hỏng luồng đăng tin (giống guard của RealtimeProvider).

### 4. UI ứng viên

- **Server actions `lib/jobs/alert-actions.ts`:**
  - `createJobAlert(criteria)` — yêu cầu đăng nhập vai `CANDIDATE`; normalize criteria (`normalizeCategory`, ép enum hợp lệ, số lương ≥ 0); tạo `JobAlert` với `label = alertLabel(criteria)`; `revalidatePath("/jobs/alerts")`.
  - `deleteJobAlert(id)` — xóa theo `{ id, userId }` (chặn chéo người dùng); `revalidatePath("/jobs/alerts")`.
- **Nút "🔔 Lưu làm thông báo"** trong khu bộ lọc `/jobs` (`JobFilters`/`JobsBrowser`): gửi criteria từ filter hiện tại. Chỉ hiện với CANDIDATE đã đăng nhập. Cạnh đó là link nhỏ "Thông báo đã lưu" → `/jobs/alerts` (không đụng Navbar).
- **Trang `/jobs/alerts`** (auth-gate như `/jobs`): liệt kê alert của user, mỗi dòng hiện `label` + mô tả tiêu chí, nút "Xóa" và link "Xem việc khớp" → `/jobs?<querystring từ criteria>`.

### 5. Cấu trúc file

**Tạo mới:**
- `lib/jobs/alerts.ts` + `lib/jobs/__tests__/alerts.test.ts`
- `lib/jobs/alert-notify.ts`
- `lib/jobs/alert-actions.ts`
- `app/jobs/alerts/page.tsx` + component dòng alert (client cho nút xóa nếu cần)

**Sửa:**
- `prisma/schema.prisma` (model `JobAlert` + quan hệ `User.jobAlerts`)
- `lib/jobs/actions.ts` (`createJobDescription` gọi `notifyMatchingAlerts`)
- `components/jobs/JobFilters.tsx` hoặc `JobsBrowser.tsx` (nút lưu + link)

## Kiểm thử

- **Unit (thuần):** `alerts.test.ts` — `matchesAlert` cho từng tiêu chí (khớp/không), kết hợp AND, rỗng = match-all, salary theo `salaryMax`/`salaryNegotiable`; `alertLabel` (có/không tiêu chí); `criteriaFromFilter`; `criteriaToQuery`.
- **Không** unit-test component/route/server action (theo quy ước dự án).
- `npm run lint` + `npm run build` phải xanh.
- Kiểm thử tay trên trình duyệt (user tự chạy): lưu alert ở `/jobs`, đăng tin khớp bằng tài khoản NTD, xác nhận ứng viên nhận thông báo + toast; xóa alert.

## Ràng buộc & quy ước

- Prisma **pinned v6**; chỉ thêm bảng, đồng bộ `npm run db:push` (không migration tay).
- `className` nháy thẳng ASCII; nội dung tiếng Việt; **SmartHire**.
- Không đổi AI, auth, realtime, phân quyền, `CvInput`.
- Tái dùng: `Notification`/`createNotification`, `JobsFilter`, `salaryWhere` (ngữ nghĩa), `normalizeCategory`, enum `EmploymentType`/`ExperienceLevel`, RealtimeProvider (tự surface thông báo mới).
- Windows: `npm test`, `npm run lint`, `npm run build`, `npm run db:push`.
