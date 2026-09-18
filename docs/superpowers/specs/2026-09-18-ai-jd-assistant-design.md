# Trợ lý viết JD bằng AI (Design)

- **Ngày:** 2026-09-18
- **Trạng thái:** Đã duyệt thiết kế, chờ viết plan
- **Bối cảnh:** Nền tuyển dụng CV-AI đã có nhiều tính năng AI (đánh giá CV↔JD, cover letter,
  sàng lọc, gợi ý việc, phỏng vấn thử, chat CV, trích xuất) qua Gemini 2.5 Flash bằng
  OpenAI-compat `client.chat.completions.parse` + `zodResponseFormat`. Vòng này thêm một tính
  năng AI MỚI: trợ lý giúp **recruiter soạn mô tả công việc (JD)** từ vài gạch đầu dòng.

## Mục tiêu & phạm vi

Trên trang đăng tin `/jobs/new`, recruiter nhập tiêu đề + mô tả ngắn/gạch đầu dòng → AI sinh
bản nháp JD có cấu trúc → tự điền vào form các trường: mô tả công việc (rawText), kỹ năng,
ngành nghề, loại hình, cấp bậc. Recruiter chỉnh sửa rồi đăng như bình thường.

**Ngoài phạm vi:** AI gợi ý mức lương; cải thiện JD của tin đã đăng; đa ngôn ngữ; gợi ý
tiêu đề (recruiter tự nhập tiêu đề làm hạt giống).

## 1. AI modules (pattern sẵn có: `chat.completions.parse` + Zod)

- `lib/ai/jd-draft-prompt.ts`
  - `buildJdDraftPrompt(input: { title: string; brief: string }): string` (thuần) — nhắc AI viết
    JD tiếng Việt có các mục (Mô tả, Trách nhiệm, Yêu cầu, Quyền lợi); chèn danh sách hợp lệ của
    `EMPLOYMENT_TYPES`, `EXPERIENCE_LEVELS`, và các `JOB_CATEGORIES` slug để AI chọn đúng giá trị.
  - Có thể tách `JD_DRAFT_SYSTEM_PROMPT` (system) + phần user (title/brief) như các prompt khác.
- `lib/ai/jd-draft-schema.ts`
  - `jdDraftSchema` (Zod) = `{ description: string; skills: string[]; employmentType: enum(EMPLOYMENT_TYPES)|null; experienceLevel: enum(EXPERIENCE_LEVELS)|null; categorySlug: string|null }`.
  - `type JdDraft = z.infer<typeof jdDraftSchema>`.
- `lib/ai/request-jd-draft.ts`
  - `requestJdDraft(prompt: string): Promise<JdDraft>` — mirror `lib/ai/request-recommendations.ts`
    (system + user message, `zodResponseFormat(jdDraftSchema, "jd_draft")`, ném lỗi nếu không parse được).

## 2. Ánh xạ draft → giá trị form (thuần, test được)

- `lib/jobs/jd-draft-map.ts`
  - `mapDraftToForm(draft: JdDraft): { rawText: string; skills: string; category: string | null; employmentType: string | null; experienceLevel: string | null }`
  - `skills` = `draft.skills.join(", ")`.
  - `category` = `draft.categorySlug` nếu là slug hợp lệ trong `JOB_CATEGORIES` (dùng
    `normalizeCategory` hoặc so khớp slug), ngược lại `null`.
  - `employmentType`/`experienceLevel` giữ nếu thuộc enum hợp lệ, ngược lại `null`.
  - `rawText` = `draft.description`.

## 3. Server action

- `lib/jobs/ai-actions.ts` — `draftJobDescription(input: { title: string; brief: string }): Promise<{ ok: true; draft: FormValues } | { ok: false; error: string }>`
  - `requireRole("RECRUITER")`.
  - rate-limit scope `ai` (key theo user id); vượt → `{ ok:false, error: "Bạn thao tác quá nhanh, thử lại sau một phút" }`.
  - validate input: `title` không rỗng, `brief` không rỗng (nếu rỗng → lỗi thân thiện).
  - gọi `requestJdDraft(buildJdDraftPrompt({ title, brief }))`; lỗi AI (try/catch) →
    `{ ok:false, error: "AI soạn thất bại, vui lòng thử lại" }`.
  - thành công → `{ ok: true, draft: mapDraftToForm(result) }`.
  - Ghi chú: draft là hỗ trợ TIỀN-lưu nên chỉ chặn theo role + rate-limit; việc đăng tin thật
    (`createJobDescription`) vẫn giữ gate xác minh email của Vòng 1.

## 4. Tách form `/jobs/new` thành client component

- `app/jobs/new/NewJobForm.tsx` (client component):
  - Nhận `props` cho các danh sách option (hoặc import trực tiếp `EMPLOYMENT_TYPES`/labels,
    `EXPERIENCE_LEVELS`/labels, `JOB_CATEGORIES`).
  - Giữ nguyên `<form action={createJobDescription}>` và toàn bộ trường hiện có.
  - Các trường AI điền (rawText, skills, category, employmentType, experienceLevel) → controlled
    state để có thể set bằng kết quả AI; các trường khác giữ như cũ (uncontrolled/name).
  - Khối `AiJdAssist` (con hoặc inline) ở đầu form: `Textarea` brief + nút "Soạn bằng AI"
    (`useTransition`), gọi `draftJobDescription({ title, brief })`. Thành công → set state các
    trường; nếu `rawText` đang có nội dung → xác nhận trước khi ghi đè (window.confirm hoặc Dialog).
    Lỗi → toast (sonner).
  - `title` lấy từ state input tiêu đề (cần cho lời gọi AI).
- `app/jobs/new/page.tsx` (server): giữ guard role hiện có; render `<NewJobForm />`.

## 5. Kiểm thử

- Thuần (vitest):
  - `buildJdDraftPrompt` — chứa `title`, `brief`, và các option hợp lệ (employmentType/experienceLevel/category).
  - `jdDraftSchema` — parse object hợp lệ; enum/null đúng.
  - `mapDraftToForm` — categorySlug hợp lệ giữ nguyên; không hợp lệ → null; skills join; enum không hợp lệ → null; rawText = description.
- Wiring (action + form) kiểm bằng `tsc` + `build` (mirror các tính năng AI trước, request wrapper không unit-test sâu).
- Kết thúc: `npx tsc --noEmit` 0, `npm run lint` 0 error, `npm test` xanh, `npm run build` PASS.

## 6. Việc người dùng phải tự làm
Không thêm env/DB (dùng Gemini `GEMINI_API_KEY` sẵn có). Kiểm tay: `/jobs/new` → nhập tiêu đề +
brief → "Soạn bằng AI" → các trường được điền → sửa → đăng tin.

## Để dành vòng sau
Gợi ý mức lương theo thị trường; cải thiện JD của tin đã đăng (nút trên trang sửa tin); nhiều
ngôn ngữ; gợi ý tiêu đề.
