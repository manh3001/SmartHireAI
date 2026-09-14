# AI phỏng vấn thử (mock interview) — Design spec

**Ngày:** 2026-09-14
**Vòng:** Hướng mới — AI mock interview

## Bối cảnh

Sàn đã tích hợp Gemini cho chấm CV, cover letter, chatbot, gợi ý. Hướng mới: **AI phỏng vấn thử**
cho ứng viên — sinh câu hỏi từ JD, ứng viên trả lời, AI chấm + góp ý. Điểm nhấn khác biệt, tận dụng
stack AI sẵn có, giá trị trực tiếp cho ứng viên. **Batch** (không hội thoại) và **ephemeral** (không lưu DB).

## Nguyên tắc thiết kế

- Mirror pattern AI hiện có: prompt thuần (test được) + request wrapper gọi Gemini + server action
  `requireRole` + `checkRateLimit("ai", userId)`. Structured output qua Zod (như evaluate/screening).
- **Không tin dữ liệu JD từ client**: action fetch JD theo `jobId` (chỉ tin `isPublic`).
- Không schema/DB mới (ephemeral). Prisma v6; prisma default `@/lib/db/prisma`; model `gemini-2.5-flash` qua `getAiClient()`.
- Tiếng Việt; Tailwind tokens.

## Luồng

1. Trang `/jobs/[id]` (ứng viên) có link "Phỏng vấn thử" → `/jobs/[id]/interview-practice`.
2. Trang gate `CANDIDATE`; render client component. Ứng viên bấm "Bắt đầu" → action `startMockInterview(jobId)` → ~5 câu hỏi.
3. Ứng viên nhập câu trả lời (textarea mỗi câu) → "Nộp" → action `scoreMockInterview(jobId, answers)` → kết quả (điểm/câu + tổng + góp ý).
4. Có thể "Làm lại" (phiên mới). Không lưu.

## Prompt thuần — `lib/ai/mock-interview-prompt.ts`

- `export const MOCK_QUESTIONS_SYSTEM_PROMPT: string` + `export const MOCK_SCORING_SYSTEM_PROMPT: string` (yêu cầu trả JSON đúng schema, tiếng Việt).
- `export function buildQuestionsPrompt(jd: { title: string; company: string; rawText: string }): string` — nhúng JD, yêu cầu sinh đúng `QUESTION_COUNT` câu hỏi phù hợp JD (trộn hành vi + chuyên môn).
- `export function buildScoringPrompt(jd: {...}, qa: { question: string; answer: string }[]): string` — nhúng JD + từng cặp Q&A, yêu cầu chấm.
- `export const QUESTION_COUNT = 5`.

## Zod schema — `lib/ai/mock-interview-schema.ts`

- `MockQuestionsSchema = z.object({ questions: z.array(z.string()).min(1) })` → `parseMockQuestions(raw: string): string[]` (bóc JSON từ text model, `safeParse`, lỗi → throw).
- `MockScoringSchema = z.object({ perAnswer: z.array(z.object({ score: z.number().min(0).max(10), feedback: z.string() })), overall: z.object({ score: z.number().min(0).max(100), summary: z.string(), tips: z.array(z.string()) }) })` → `MockScoring` type + `parseMockScoring(raw: string): MockScoring`.
- Tách JSON: dùng cách bóc khối `{...}` như các schema hiện có (tham khảo `lib/ai/schema.ts`/`screening-schema.ts`).

## Request wrapper — `lib/ai/request-mock-interview.ts`

- `requestMockQuestions(jd): Promise<string[]>` — `getAiClient().chat.completions.create({ model: AI_MODEL, messages: [system, user=buildQuestionsPrompt] })` → `parseMockQuestions(text)`.
- `requestMockScoring(jd, qa): Promise<MockScoring>` — tương tự với `MOCK_SCORING_SYSTEM_PROMPT` + `buildScoringPrompt` → `parseMockScoring(text)`.

## Server actions — `lib/interview-practice/actions.ts` (`"use server"`)

- `startMockInterview(jobId: string): Promise<{ ok: true; questions: string[] } | { ok: false; error: string }>`
  - `requireRole("CANDIDATE")`; `checkRateLimit("ai", userId)` (fail → error thân thiện).
  - `prisma.jobDescription.findFirst({ where: { id: jobId, isPublic: true }, select: { title, company, rawText } })`; không có → error.
  - `requestMockQuestions(jd)` (try/catch → error). Trả questions.
- `scoreMockInterview(jobId: string, answers: string[]): Promise<{ ok: true; result: MockScoring } | { ok: false; error: string }>`
  - Gate + rate-limit + fetch JD như trên.
  - **Sinh lại câu hỏi trong cùng action?** Không — client gửi lại cặp Q&A. Chữ ký: `scoreMockInterview(jobId, qa: { question: string; answer: string }[])`. Validate `qa` non-empty, mỗi answer trim; nếu tất cả rỗng → error "Hãy trả lời ít nhất một câu".
  - `requestMockScoring(jd, qa)` → result.

## UI

- `app/jobs/[id]/interview-practice/page.tsx`: server component; `requireRole("CANDIDATE")`; fetch JD `isPublic` (title để hiển thị; 404 nếu không có); render `<MockInterview jobId title company />` + Navbar/Footer + link quay lại tin.
- `components/interview-practice/MockInterview.tsx` (`"use client"`): state máy trạng thái `idle | loading-questions | answering | scoring | result | error`; gọi 2 action; hiển thị câu hỏi + textarea; kết quả: điểm tổng nổi bật, từng câu (điểm + feedback), tips; nút "Làm lại".
- `app/jobs/[id]/page.tsx`: thêm link/nút "Phỏng vấn thử" trong `actionSlot` cho ứng viên (cạnh "Ứng tuyển").

## Kiểm thử

- Unit `buildQuestionsPrompt`/`buildScoringPrompt`: chứa title/company/rawText; scoring chứa từng question+answer; nhắc số câu `QUESTION_COUNT`.
- Unit `parseMockQuestions`/`parseMockScoring`: JSON hợp lệ → parse đúng; JSON có rào ```json fence → vẫn bóc được; thiếu field/điểm ngoài khoảng → throw.
- Actions (AI/IO) không unit-test (mirror cover letter). Giữ toàn bộ test hiện có xanh (437 baseline).

## Dùng lại

`getAiClient`/`AI_MODEL` (`lib/ai/client.ts`), `checkRateLimit` (`lib/security/ratelimit.ts`, bucket `"ai"`),
`requireRole` (`lib/auth/session.ts`), mẫu prompt/schema/request của cover-letter + screening.

## Ngoài phạm vi

Lưu lịch sử/DB; hội thoại multi-turn; chấm giọng nói/video; phỏng vấn không gắn JD; chống lạm dụng nâng cao ngoài rate-limit "ai" sẵn có.
