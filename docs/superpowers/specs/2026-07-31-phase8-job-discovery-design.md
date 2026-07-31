# Thiết kế: Khám phá việc phía ứng viên (Gói C)

**Ngày:** 2026-07-31
**Tác giả:** Nguyễn Đức Mạnh
**Trạng thái:** Đã duyệt (chờ lập kế hoạch triển khai)

## 1. Bối cảnh & Mục tiêu

Sau gói A/B, phía ứng viên đã có CV builder, ứng tuyển, xem điểm; nhưng khám phá việc còn sơ khai: trang `/jobs` chỉ liệt kê mọi tin công khai, không tìm kiếm, không gợi ý, không lưu tin. Gói C bổ sung ba năng lực khám phá việc cho ứng viên:

1. **Tìm kiếm/lọc theo từ khóa** (văn bản).
2. **Lưu tin (bookmark)** + trang "Tin đã lưu".
3. **Gợi ý việc bằng AI** — xếp hạng tin theo độ phù hợp với CV (đảo ngược gói B).

Lưu ý ràng buộc: JD hiện là một ô `rawText` (chưa tách trường lương/địa điểm/kỹ năng — đó là gói D), nên lọc chỉ theo văn bản.

## 2. Tìm kiếm / lọc theo từ khóa

- Trang `/jobs` nhận query param `?q=<từ khóa>`.
- Server lọc tin công khai có `title` HOẶC `company` HOẶC `rawText` chứa từ khóa, không phân biệt hoa thường (`contains` + `mode: "insensitive"` của Prisma). `q` rỗng/không có → hiện tất cả (hành vi hiện tại).
- UI: một ô tìm kiếm dạng form GET (không cần JS), submit nạp lại trang với `?q`. Hiện lại giá trị `q` trong ô.
- Không thêm model.

## 3. Lưu tin (bookmark)

### 3.1 Mô hình dữ liệu
```
SavedJob
  id        String   @id @default(cuid())
  userId    String
  user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  jobId     String
  job       JobDescription @relation(fields: [jobId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@unique([userId, jobId])
```
Quan hệ ngược: `User.savedJobs SavedJob[]`, `JobDescription.savedBy SavedJob[]`.

### 3.2 Hành vi
- Server action `toggleSaveJob(jobId): Promise<{ ok: true; saved: boolean } | { ok: false; error: string }>` — chỉ CANDIDATE; nếu đã lưu → xoá (trả `saved:false`), nếu chưa → tạo (trả `saved:true`); tin phải công khai.
- Nút lưu (icon, client component) hiển thị ở: thẻ job trên `/jobs`, kết quả gợi ý, và trang "Tin đã lưu" (để bỏ lưu). Trạng thái đã lưu được truyền từ server.
- Trang mới `/jobs/saved` (SSR, chỉ CANDIDATE): danh sách tin đã lưu, mỗi tin link tới chi tiết + nút bỏ lưu.

## 4. Gợi ý việc bằng AI (ngôi sao)

### 4.1 Ý tưởng
Đảo ngược gói B: một lệnh AI nhận **một CV của ứng viên + danh sách JD** và xếp hạng các tin theo mức phù hợp với CV, kèm điểm và lý do.

### 4.2 Đầu vào
- CV do ứng viên chọn (dropdown các CV của mình; mặc định CV mới nhất).
- Danh sách tin công khai **ứng viên chưa ứng tuyển**, cap tối đa 20 tin mới nhất (`MAX_RECOMMEND_JOBS = 20`) để prompt gọn.

### 4.3 Tham chiếu an toàn (ref → jobId)
Không đưa `jobId` (cuid) vào prompt. Đánh số tin `#1..#n` theo thứ tự mảng đầu vào; AI trả `ref` (số 1-based); server map `ref → jobs[ref-1]`.

### 4.4 Schema kết quả (Zod, structured output)
```
{ ranking: [ { ref: number, score: number (0-100), reason: string } ],
  summary: string }
```
- `ranking` xếp từ phù hợp nhất trước.
- `reason`: vì sao tin này hợp với ứng viên.
- Không có trường "shortlisted" (khác gói B).

### 4.5 Core thuần `runRecommendations(params, deps)` (DI)
Giống pattern `runScreening`/`runCvEvaluation`:
- Không có tin → `{ ok: false, error: "Chưa có tin phù hợp để gợi ý" }`.
- Gọi `deps.requestRecommendations(prompt)` → `{ ranking, summary }`.
- Map `ref → job` theo đúng thứ tự AI trả; bỏ `ref` ngoài `[1..n]`; bỏ `ref` trùng (giữ lần đầu).
- **Tin AI không xếp hạng → BỎ** (không gợi ý; khác gói B vốn nối cuối).
- Trả `{ ok: true, summary, items: RecommendationItem[] }` (core trả thẳng kết quả, không lưu DB).
- AI lỗi → `{ ok: false, error: "AI gợi ý thất bại, vui lòng thử lại" }`.

`RecommendationItem = { jobId, title, company, score, reason }`.

### 4.6 Server action `recommendJobs(cvId)`
- `auth()` + role CANDIDATE + rate-limit.
- Xác thực CV thuộc ứng viên; nạp CV (`loadCvInput`).
- Nạp job công khai chưa ứng tuyển (loại các `jobId` đã có `Application` của user), cap 20 mới nhất.
- Gọi core `runRecommendations` với `requestRecommendations` thật.
- Trả kết quả về client (KHÔNG lưu DB). Không cần `revalidatePath`.

### 4.7 Prompt
- System prompt: vai trò cố vấn nghề nghiệp; so khớp một CV với nhiều tin; chấm điểm phù hợp 0-100 cho từng tin; nêu lý do ngắn; xếp hạng; chỉ dùng đúng ref. Trả lời tiếng Việt, đúng schema.
- `buildRecommendationPrompt(cv, jobs)`: CV (định dạng gọn) + danh sách `### Tin #i` (title, company, rawText rút gọn).

### 4.8 Giao diện
- Trang mới `/jobs/recommendations` (SSR khung, chỉ CANDIDATE): dropdown chọn CV + nút **"Gợi ý việc cho tôi"** (client) → gọi `recommendJobs(cvId)` → hiện danh sách tin xếp hạng (điểm + lý do + link tới tin + nút lưu). Trạng thái rỗng khi chưa chạy; báo lỗi mềm khi AI lỗi/không có tin.
- Link "✨ Gợi ý việc cho tôi" và "Tin đã lưu" từ `/jobs`.

## 5. Xử lý lỗi

- AI lỗi/timeout → lỗi mềm, UI toast + cho chạy lại.
- Không có tin phù hợp (đã ứng tuyển hết hoặc chưa có tin) → "Chưa có tin phù hợp để gợi ý".
- Ứng viên chưa có CV → nút gợi ý báo cần tạo CV trước.
- `toggleSaveJob` với tin không công khai/không tồn tại → lỗi mềm.
- Phân quyền: các tính năng này chỉ dành CANDIDATE; NTD vào → điều hướng phù hợp.
- Structured output sai schema → Zod chặn ở `requestRecommendations` (throw) → core bắt, lỗi mềm.

## 6. Kiểm thử

- **Unit (Vitest, TDD):**
  - `recommendationResultSchema` (Zod): chấp nhận hợp lệ; từ chối thiếu trường/kiểu sai.
  - `runRecommendations` core: lỗi khi rỗng; map `ref → job` đúng thứ tự; bỏ ref ngoài phạm vi + trùng; **bỏ** tin AI không xếp hạng; AI lỗi → lỗi mềm; trả `items` đúng.
  - (Tuỳ chọn) prompt builder: chứa `#1..#n` + nội dung CV.
- **Glue (action), UI, trang, tìm kiếm, lưu tin:** không unit-test (đúng chuẩn dự án); an toàn bằng `npx tsc --noEmit` + `npm test` xanh.

## 7. Cấu trúc thư mục (dự kiến)

```
/prisma
  schema.prisma                 thêm SavedJob + quan hệ ngược
/lib
  /ai
    recommendation-schema.ts    Zod + type
    recommendation-prompt.ts    SYSTEM prompt + buildRecommendationPrompt(cv, jobs)
    request-recommendations.ts  requestRecommendations(prompt)
  /jobs
    recommendations.ts          runRecommendations core (DI) + types + MAX_RECOMMEND_JOBS
    saved-actions.ts            "use server": toggleSaveJob(jobId)
    recommend-actions.ts        "use server": recommendJobs(cvId)
    __tests__/recommendations.test.ts
/app/jobs
  page.tsx                      thêm ô tìm kiếm (?q) + nút lưu trên thẻ + link tới recommendations/saved
  SaveJobButton.tsx             nút lưu/bỏ lưu (client)
  /saved/page.tsx               trang "Tin đã lưu"
  /recommendations/page.tsx     trang gợi ý (SSR khung)
  /recommendations/RecommendClient.tsx  dropdown CV + nút gợi ý + danh sách (client)
```

## 8. Thứ tự xây dựng (dự kiến)

1. Prisma `SavedJob` + quan hệ + `db push`.
2. Tìm kiếm `?q` trên `/jobs`.
3. `toggleSaveJob` action + `SaveJobButton` + gắn vào `/jobs` + trang `/jobs/saved`.
4. Zod `recommendation-schema` (TDD).
5. Prompt + `request-recommendations`.
6. Core `runRecommendations` (TDD).
7. Action `recommendJobs` + trang `/jobs/recommendations` + client + link từ `/jobs`.
