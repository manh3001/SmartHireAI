# Vòng 3 — Hồ sơ cá nhân & Analytics tuyển dụng

**Ngày:** 2026-09-01
**Tính năng:** Hồ sơ cá nhân ứng viên (username profile page) · Analytics tuyển dụng NTD
**Trạng thái:** Approved, chờ implementation plan

---

## 1. Bối cảnh

Vòng 3 bổ sung 2 tính năng độc lập:

1. **Hồ sơ cá nhân ứng viên** — trang profile public theo username (`/u/[username]`), hiển thị bio + danh sách CV công khai + social links; ứng viên tự cấu hình qua `/settings/profile`
2. **Analytics tuyển dụng NTD** — tab "Phân tích" trên dashboard RECRUITER, hiện phễu trạng thái + top jobs + tỉ lệ chuyển đổi; CSS-only, không thêm charting dependency

**Phụ thuộc Vòng trước:**
- CV share (`shareToken`) từ Vòng 1 — profile page dùng lại để list CV công khai
- `ApplicationEvent` (lịch sử trạng thái) từ codebase hiện có — dùng để tính thời gian tuyển
- `revalidateTag(TAG, "max")` — pattern bắt buộc (2 args) như các Vòng trước

**Vòng 4 (sau):** OAuth/Google login + Dark mode — tách riêng do ảnh hưởng nền tảng rộng.

---

## 2. Schema Changes

### Model mới `CandidateProfile`

```prisma
model CandidateProfile {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  username  String   @unique
  bio       String   @default("")
  github    String   @default("")
  linkedin  String   @default("")
  twitter   String   @default("")
  website   String   @default("")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Thêm vào model `User`:
```prisma
candidateProfile CandidateProfile?
```

**Username rules:**
- Chỉ `[a-z0-9-]`, không bắt đầu/kết thúc bằng `-`, không có `--` liên tiếp
- Độ dài 3–30 ký tự
- Case-insensitive lookup (lưu lowercase, so sánh lowercase)

**Không thêm model mới cho Analytics** — query trực tiếp `Application` + `ApplicationEvent`.

---

## 3. Hồ sơ cá nhân ứng viên

### Route công khai `/u/[username]`

Server Component, không cần auth.

**Luồng server:**
1. Lookup `CandidateProfile` by `username` (case-insensitive)
2. `notFound()` nếu không tìm thấy
3. Fetch `user.name`, CV mặc định (`isDefault: true`) → `profile.headline`
4. Fetch danh sách CV công khai (`shareToken IS NOT NULL`)
5. Render trang hồ sơ

**Layout:**
```
┌─────────────────────────────────────────────┐
│  [Avatar chữ cái]  Nguyễn Văn A            │
│  Frontend Developer                          │
│  "Đam mê React và system design..."         │
│                                             │
│  🔗 github.com/nguyena                      │
│  🔗 linkedin.com/in/nguyena                 │
│  🌐 nguyena.dev                             │
├─────────────────────────────────────────────┤
│  CV công khai                               │
│  ┌──────────────┐  ┌──────────────┐        │
│  │[Classic] CV IT│  │[Modern] CV EN│        │
│  │   [Xem CV →] │  │  [Xem CV →] │        │
│  └──────────────┘  └──────────────┘        │
│                                             │
│  (nếu không có CV công khai → EmptyState)  │
└─────────────────────────────────────────────┘
```

- Avatar: `CompanyAvatar` chữ cái (đã có)
- Headline: lấy từ CV `isDefault: true` → `profile.headline`; nếu không có CV mặc định → bỏ trống
- Social links: chỉ hiện link có giá trị (không hiện dòng trống)
- Nút "Xem CV →" mở `/cv/share/[token]` tab mới

### Trang cài đặt `/settings/profile`

Route mới, CANDIDATE only (redirect `/dashboard` nếu RECRUITER/ADMIN).

**Giao diện:**
```
┌─────────────────────────────────────────────┐
│  Hồ sơ cá nhân                             │
│                                             │
│  Username *                                 │
│  [nguyena                    ]              │
│  yoursite.com/u/nguyena                     │
│                                             │
│  Giới thiệu bản thân                        │
│  [Đam mê React và system design...      ]   │
│  (tối đa 300 ký tự)                        │
│                                             │
│  GitHub      [github.com/nguyena         ]  │
│  LinkedIn    [linkedin.com/in/nguyena    ]  │
│  Twitter/X   [twitter.com/nguyena        ]  │
│  Website     [nguyena.dev                ]  │
│                                             │
│  [Xem hồ sơ công khai ↗]    [Lưu thay đổi]│
└─────────────────────────────────────────────┘
```

### Server actions

**`upsertCandidateProfile(data)`** — "use server"
- Verify CANDIDATE session
- Validate username: regex `^[a-z0-9][a-z0-9-]*[a-z0-9]$` (min 3 chars), max 30
- Check uniqueness (trả lỗi rõ nếu đã có)
- Upsert `CandidateProfile`
- `revalidateTag(CACHE_TAGS.candidateProfile, "max")` — plan phải thêm `candidateProfile` vào `lib/cache/tags.ts`
- Return `{ ok: boolean; error?: string }`

### Navbar / Discovery

Thêm link "Hồ sơ" (`/settings/profile`) vào user menu trong Navbar — chỉ hiện với CANDIDATE (cạnh "Dashboard").

---

## 4. Analytics tuyển dụng NTD

### Vị trí

Section "Phân tích tuyển dụng chi tiết" mới trên `/dashboard` của RECRUITER — đặt **bên dưới** component `RecruiterStats` hiện có (không tạo tab switcher). Render bằng Server Component, không dùng client-side state.

### Metrics

**Stat cards (3 card):**

| Metric | Công thức |
|---|---|
| Tổng đơn | COUNT(Application) where job.userId = recruiterId |
| Tỉ lệ HIRED | COUNT(status=HIRED) / COUNT(total) * 100 |
| Thời gian tuyển TB | AVG(days từ Application.createdAt → event HIRED) — null nếu chưa có ai HIRED |

**Phễu trạng thái** (CSS horizontal bar):
- 7 trạng thái: SUBMITTED / SCREENING / INTERVIEW / OFFER / HIRED / REJECTED / WITHDRAWN
- Bar width = count / max_count * 100%
- Màu bar: `bg-primary` cho active statuses (SUBMITTED/SCREENING/INTERVIEW/OFFER), `text-emerald-600 bg-emerald-100` cho HIRED (semantic positive, như ScoreBadge), `bg-destructive/20` cho REJECTED/WITHDRAWN
- Số lượng hiện bên phải bar

**Top 5 tin tuyển dụng** (bảng):

| Tin | Đơn | Điểm AI TB | Tỉ lệ tiến lên |
|---|---|---|---|
| Senior React Dev | 12 | 78 | 50% |

- Sắp xếp: nhiều đơn nhất trước
- "Điểm AI TB" = AVG(evaluation.overallScore) — "—" nếu chưa có
- "Tỉ lệ tiến lên" = (không-REJECTED-WITHDRAWN) / total

### Data layer `lib/dashboard/recruiter-analytics.ts`

```typescript
export type FunnelRow = { status: ApplicationStatus; count: number };
export type JobRow = { jobId: string; title: string; total: number; avgScore: number | null; progressRate: number };
export type AnalyticsSummary = {
  totalApplications: number;
  hiredRate: number;          // 0–1
  avgDaysToHire: number | null;
  funnel: FunnelRow[];
  topJobs: JobRow[];
};

// Hàm thuần (testable, không import prisma/auth):
export function computeFunnel(apps: { status: ApplicationStatus }[]): FunnelRow[]
export function computeConversionRate(apps: { status: ApplicationStatus }[]): number  // 0–1
export function computeAvgTimeToHire(
  apps: { id: string; createdAt: Date; status: ApplicationStatus }[],
  events: { applicationId: string; toStatus: ApplicationStatus; createdAt: Date }[]
): number | null  // days, null nếu không có HIRED app

// Hàm IO (có prisma):
export async function getRecruiterAnalytics(recruiterId: string): Promise<AnalyticsSummary>
```

**Query trong `getRecruiterAnalytics`:**
- `Application` scope: `where: { job: { userId: recruiterId } }`, include `evaluation.overallScore`, `job.title`, `job.id`
- `ApplicationEvent` scope: `where: { application: { job: { userId: recruiterId } }, toStatus: "HIRED" }` — chỉ cần event HIRED để tính thời gian

### Component

`components/dashboard/RecruiterAnalytics.tsx` — Server Component, nhận `summary: AnalyticsSummary`, render stat cards + funnel + table. Không có state.

`components/dashboard/FunnelBar.tsx` — nhỏ, thuần UI, render 1 hàng trong phễu.

---

## 5. Error Handling

| Tình huống | Xử lý |
|---|---|
| Username đã tồn tại | Action trả `{ ok: false, error: "Username đã được sử dụng" }`, UI toast |
| Username không hợp lệ | Client validate regex trước submit + server validate |
| `/u/[username]` không tồn tại | `notFound()` → trang 404 |
| RECRUITER/ADMIN vào `/settings/profile` | Redirect `/dashboard` |
| Analytics — chưa có đơn nào | Hiện EmptyState "Chưa có dữ liệu tuyển dụng" |
| Thời gian tuyển — chưa có HIRED | Hiện "—" thay vì số |

---

## 6. Testing

**Unit tests (vitest):**
- `computeFunnel`: đếm đúng từng status, status không có app → count 0
- `computeConversionRate`: 0 app → 0, không có HIRED → 0, 1/10 HIRED → 0.1
- `computeAvgTimeToHire`: không có HIRED event → null, 1 app HIRED sau 5 ngày → 5
- `upsertCandidateProfile` logic: username regex (valid/invalid cases), uniqueness check

**Integration (manual):**
- Đặt username → vào `/u/[username]` không đăng nhập → thấy trang hồ sơ
- Tắt share tất cả CV → section "CV công khai" hiện EmptyState
- NTD có ≥1 job + đơn → vào Dashboard → thấy tab Phân tích với đủ 3 section
- NTD chưa có đơn nào → tab Phân tích hiện EmptyState

---

## 7. Phạm vi không làm (YAGNI)

- Không upload avatar (dùng chữ cái)
- Không đếm lượt xem profile
- Không follow/unfollow ứng viên
- Không cho NTD nhắn tin trực tiếp từ trang profile
- Analytics không có bộ lọc thời gian (YAGNI)
- Analytics không export CSV
- Không email digest analytics
- Không chart JS/recharts — CSS-only để tránh thêm dependency
