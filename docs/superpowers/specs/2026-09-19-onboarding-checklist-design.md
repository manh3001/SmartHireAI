# Onboarding "Bắt đầu" trên dashboard (Design)

- **Ngày:** 2026-09-19
- **Trạng thái:** Đã duyệt thiết kế, chờ viết plan
- **Bối cảnh:** Hướng UX. Dashboard đã có `profileCompleteness` (thanh hoàn thiện hồ sơ ứng viên:
  CV/bio/github/linkedin/website) + `VerifyEmailBanner` (nhắc xác minh email, Vòng 1). Vòng này
  thêm thẻ **"Bắt đầu"** — các MỐC HÀNH ĐỘNG cho user mới, tự ẩn khi hoàn tất; KHÔNG trùng
  completeness (mốc khác, hành động rõ) và KHÔNG trùng email banner.

## Mục tiêu & phạm vi

User mới thấy trên dashboard một checklist ngắn các bước cần làm để bắt đầu dùng nền tảng, có
trạng thái xong/chưa + link tới nơi làm. Thẻ tự ẩn khi tất cả bước đã xong.

**Ngoài phạm vi:** nút "bỏ qua" lưu DB (cần schema mới); onboarding cho admin; tour tooltip từng
bước; thêm bước "xác minh email" (đã có `VerifyEmailBanner` lo).

## 1. Logic thuần — `lib/dashboard/onboarding.ts`

- `type OnboardingSignals = { hasCV: boolean; hasBio: boolean; hasApplication: boolean; hasCompany: boolean; hasJob: boolean }`
- `type OnboardingStep = { key: string; label: string; href: string; done: boolean }`
- `type Onboarding = { steps: OnboardingStep[]; completed: number; total: number; allDone: boolean }`
- `computeOnboarding(role: "CANDIDATE" | "RECRUITER", signals: OnboardingSignals): Onboarding`
  - **CANDIDATE** steps (theo thứ tự):
    1. `hasCV` — "Tạo CV" — `/dashboard`
    2. `hasBio` — "Điền giới thiệu hồ sơ" — `/settings/profile`
    3. `hasApplication` — "Ứng tuyển tin đầu tiên" — `/jobs`
  - **RECRUITER** steps:
    1. `hasCompany` — "Tạo hồ sơ công ty" — `/company/edit`
    2. `hasJob` — "Đăng tin tuyển dụng đầu tiên" — `/jobs/new`
  - `done` = giá trị signal tương ứng. `completed` = số bước done; `total` = số bước của role;
    `allDone` = `completed === total`. (Role không xác định → coi như không có bước; nhưng dashboard
    chỉ gọi với 2 role trên.)
  - Thuần, không import prisma.

## 2. Nguồn tín hiệu — `app/dashboard/page.tsx`

Hầu hết đã có sẵn trong 2 nhánh:
- CANDIDATE: `hasCV = cvCount > 0`; `hasBio = !!candidateProfile?.bio?.trim()`;
  `hasApplication = (await prisma.application.count({ where: { candidateId: session.user.id } })) > 0` (query mới, nhỏ).
- RECRUITER: `hasCompany = !!companyProfile`; `hasJob = jobs.length > 0`. (Các bước candidate để `false`.)

Gọi `computeOnboarding(role, signals)` và truyền vào `<OnboardingCard>`.

## 3. UI — `components/dashboard/OnboardingCard.tsx`

Server component `OnboardingCard({ onboarding }: { onboarding: Onboarding })`:
- `onboarding.allDone` → `return null` (tự ẩn).
- Ngược lại: thẻ tiêu đề "Bắt đầu" + tiến độ (vd `{completed}/{total} bước`); danh sách `steps`:
  - done: icon ✓ (lucide `CheckCircle2`, màu emerald) + label gạch mờ (`text-muted-foreground line-through`).
  - chưa: vòng tròn rỗng (lucide `Circle`) + label + `<Link href={step.href}>` mũi tên "→".
- Style khớp các thẻ dashboard (`rounded-xl border border-border bg-card p-4`...). Copy tiếng Việt.
- Render ĐẦU mỗi nhánh dashboard (candidate & recruiter), trên/cạnh các thẻ hiện có.

## 4. Kiểm thử

- Thuần (vitest) `lib/dashboard/__tests__/onboarding.test.ts`:
  - CANDIDATE: đúng 3 bước, `done` khớp signals; `hasCV+hasBio` nhưng chưa `hasApplication` → `completed 2`, `allDone false`; đủ 3 → `allDone true`.
  - RECRUITER: đúng 2 bước (không lẫn bước candidate); `hasCompany` chưa `hasJob` → `completed 1`.
  - `total`/`completed` chính xác; `href`/`label` đúng.
- Wiring (card + dashboard) kiểm `tsc` + `build`.
- Kết thúc: `npx tsc --noEmit` 0, `npm run lint` 0 error, `npm test` xanh, `npm run build` PASS.

## 5. Việc người dùng phải tự làm
Không có (dùng dữ liệu sẵn có, không env/DB/dependency mới). Kiểm tay: user mới → dashboard thấy
thẻ "Bắt đầu"; hoàn tất các bước → thẻ tự ẩn.

## Để dành vòng sau
Nút "bỏ qua" lưu DB (`User.onboardingDismissedAt`); onboarding admin; tour tooltip; thêm bước xác minh email.
