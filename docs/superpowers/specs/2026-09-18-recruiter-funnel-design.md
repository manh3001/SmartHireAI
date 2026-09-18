# Funnel ứng tuyển cho recruiter (Design)

- **Ngày:** 2026-09-18
- **Trạng thái:** Đã duyệt thiết kế, chờ viết plan
- **Bối cảnh:** Dashboard recruiter đã có `getRecruiterStats` + `getRecruiterAnalytics`
  (`lib/dashboard/recruiter-analytics.ts`: `avgDaysToHire`, `topJobs`). Khoảng trống: **funnel
  ứng tuyển theo từng bước + tỷ lệ chuyển đổi** — chưa có. Vòng này bổ sung, tận dụng
  `Application` + `ApplicationEvent` (lịch sử trạng thái) sẵn có.

## Mục tiêu & phạm vi

Recruiter thấy trên dashboard: số đơn ứng tuyển ĐẠT tới từng bước của pipeline
(Nộp → Sàng lọc → Phỏng vấn → Offer → Nhận) + tỷ lệ chuyển đổi giữa các bước liền kề.

**Ngoài phạm vi:** xu hướng theo thời gian; funnel theo từng tin; trang báo cáo riêng; export CSV.

## 1. Tính funnel (thuần) — `lib/dashboard/recruiter-funnel.ts`

- Pipeline tích cực có thứ tự (index): `SUBMITTED`(0), `SCREENING`(1), `INTERVIEW`(2), `OFFER`(3), `HIRED`(4).
  Định nghĩa hằng `FUNNEL_STAGES = ["SUBMITTED","SCREENING","INTERVIEW","OFFER","HIRED"] as const`.
- `type FunnelRow = { stage: string; label: string; count: number; pctOfTotal: number; conversionFromPrev: number | null }`
- `type FunnelResult = { total: number; rows: FunnelRow[] }`
- `computeFunnel(apps, events): FunnelResult`
  - `apps`: `{ id: string }[]` (tất cả đơn của recruiter — dùng để đếm total & baseline SUBMITTED).
  - `events`: `{ applicationId: string; toStatus: string }[]` (mọi ApplicationEvent).
  - Với mỗi đơn: `maxReached` = max index trong `FUNNEL_STAGES` của các `toStatus` (positive) thuộc đơn đó;
    baseline SUBMITTED (index 0) cho MỌI đơn (mỗi đơn khi nộp đã có event `SUBMITTED`, nhưng vẫn
    đảm bảo baseline kể cả thiếu). → xử lý đúng cả nhảy bước (chạm INTERVIEW ⇒ tính đã qua SCREENING).
  - `reached[k]` = số đơn có `maxReached >= k`.
  - `total = apps.length` (= `reached[0]`).
  - Mỗi bước k: `count = reached[k]`; `pctOfTotal = total>0 ? reached[k]/total : 0`;
    `conversionFromPrev = k===0 ? null : (reached[k-1]>0 ? reached[k]/reached[k-1] : 0)`.
  - Đơn REJECTED/WITHDRAWN: vẫn tính đã-chạm tới bước cao nhất trong lịch sử (không loại khỏi funnel);
    các trạng thái này KHÔNG nằm trong `FUNNEL_STAGES` nên không tạo bước riêng.
  - Rỗng (`apps` = []): `total = 0`, mỗi row count 0, pct 0, conversion null/0 (không chia cho 0).
- Nhãn: `label` lấy từ `STATUS_LABELS` (`lib/applications/status`).

## 2. Nguồn dữ liệu — cùng file

`getRecruiterFunnel(recruiterId): Promise<FunnelResult>`:
- `prisma.application.findMany({ where: { job: { userId: recruiterId } }, select: { id: true } })`.
- `prisma.applicationEvent.findMany({ where: { application: { job: { userId: recruiterId } } }, select: { applicationId: true, toStatus: true } })`.
- `return computeFunnel(apps, events)`.

## 3. UI — `components/dashboard/RecruiterFunnel.tsx`

Server component `RecruiterFunnel({ userId })`:
- Gọi `getRecruiterFunnel(userId)`.
- `total === 0` → `EmptyState` ("Chưa có đơn ứng tuyển" + mô tả), giống `RecruiterAnalytics`.
- Ngược lại: khối "Funnel ứng tuyển" — mỗi bước một thanh ngang: nhãn + `count` + `pctOfTotal` (%),
  và dòng phụ tỷ lệ chuyển đổi từ bước trước (vd "Sàng lọc → Phỏng vấn: 40%"). Style khớp các
  section dashboard hiện có (`border border-border bg-background`, `text-muted-foreground`...).
- Render trong `app/dashboard/page.tsx` ở nhánh recruiter (cạnh `<RecruiterAnalytics userId=... />`).

## 4. Kiểm thử

- Thuần (vitest) `lib/dashboard/__tests__/recruiter-funnel.test.ts`:
  - reached đếm đúng theo `maxReached` (đơn ở INTERVIEW tính cho SUBMITTED/SCREENING/INTERVIEW).
  - nhảy bước (event SUBMITTED→OFFER) vẫn tính các bước ở giữa.
  - conversionFromPrev đúng; bước đầu `null`.
  - đơn REJECTED giữ trong funnel tới bước đã chạm (không mất).
  - rỗng → total 0, count 0, không lỗi chia 0.
- Wiring (accessor + component) kiểm `tsc` + `build`.
- Kết thúc: `npx tsc --noEmit` 0, `npm run lint` 0 error, `npm test` xanh, `npm run build` PASS.

## 5. Việc người dùng phải tự làm
Không có (dùng dữ liệu sẵn có, không env/DB/dependency mới). Kiểm tay: đăng nhập recruiter có đơn
ứng tuyển → dashboard → khối "Funnel ứng tuyển" hiển thị số & % chuyển đổi từng bước.

## Để dành vòng sau
Xu hướng theo thời gian (đơn/lượt xem theo tuần); funnel theo từng tin; trang `/dashboard/analytics`
riêng; export CSV.
