# AI gợi ý mức lương khi đăng tin (Design)

- **Ngày:** 2026-09-18
- **Trạng thái:** Đã duyệt thiết kế, chờ viết plan
- **Bối cảnh:** Nối tiếp [[ai-jd-assistant]] (đã merge). Nền tảng đã có hạ tầng lương mạnh trong
  `lib/salary/insights.ts` (`median`, `computeSalaryInsights` theo ngành, `computeSalaryByLevel`,
  `computeSalaryBySkill`, `computeSalaryMatrix`) + `lib/salary/insights-data.ts`
  (`getCachedSalaryData`, cache 1h tag `jobs`) + trang công khai `/salaries`. Vòng này thêm:
  khi recruiter đăng tin `/jobs/new`, gợi ý khoảng lương **lấy từ dữ liệu tin thật** (median theo
  ngành × cấp bậc), kèm 1-2 câu nhận định do AI viết (AI KHÔNG bịa con số).

## Mục tiêu & phạm vi

Recruiter chọn ngành + cấp bậc trên `/jobs/new` → bấm "Gợi ý lương (AI)" → hệ thống tính khoảng
median từ tin thật + AI viết nhận định ngắn → recruiter có thể "Áp dụng" để điền 2 ô lương.

**Nguyên tắc:** con số 100% từ dữ liệu nền tảng (không LLM ước lượng). AI chỉ diễn giải định tính.

**Ngoài phạm vi:** số lương dựa trên kỹ năng cụ thể (kỹ năng chỉ đưa vào câu AI định tính); gợi ý
ở trang sửa tin; biểu đồ phân phối lương.

## 1. Tính khoảng lương (thuần) — `lib/salary/suggestion.ts`

- `type SalaryBasis = "category_level" | "category" | "level" | "overall"`
- `type SalarySuggestion = { medianMin: number | null; medianMax: number | null; sampleSize: number; basis: SalaryBasis }`
- `computeSalarySuggestion(rows, input): SalarySuggestion | null`
  - `rows`: `{ category: string | null; experienceLevel: string | null; salaryMin: number | null; salaryMax: number | null }[]`
  - `input`: `{ category: string | null; experienceLevel: string | null }`
  - Lọc tin **có lương** (min hoặc max != null).
  - Thử lần lượt theo độ đặc thù giảm dần, chọn mức ĐẦU TIÊN đạt cỡ mẫu ≥ `MIN_SUGGESTION_SAMPLE` (=3):
    1. `category_level`: cùng `normalizeCategory(category)` và cùng `experienceLevel`.
    2. `category`: cùng ngành (mọi cấp).
    3. `level`: cùng cấp bậc (mọi ngành).
    4. `overall`: toàn bộ tin có lương.
  - Với mức được chọn: `medianMin = median(mins)`, `medianMax = median(maxs)`, `sampleSize = count`,
    `basis` = mức đó. (Nếu ngay cả `overall` cũng 0 tin có lương → trả `null`.)
  - Nếu `category`/`experienceLevel` đầu vào không hợp lệ, các bước tương ứng tự bỏ qua (0 mẫu → xuống mức sau).
  - Tái dùng `median` (`lib/salary/insights.ts`), `normalizeCategory` (`lib/jobs/job-categories`),
    `EXPERIENCE_LEVELS` (`lib/jobs/job-fields`).

## 2. Nguồn dữ liệu — `lib/salary/insights-data.ts`

Thêm `getCachedSalaryRows(): Promise<SuggestionRow[]>` — cache (`unstable_cache`, key riêng, tag
`CACHE_TAGS.jobs`, revalidate 3600) trả danh sách tin public
(`select { category, experienceLevel, salaryMin, salaryMax }`). Action lọc trong bộ nhớ theo input.
(Không phá `getCachedSalaryData` hiện có.)

## 3. AI diễn giải (không bịa số)

- `lib/ai/salary-note-schema.ts` — Zod `{ note: string }`, `type SalaryNote`.
- `lib/ai/salary-note-prompt.ts` — `SALARY_NOTE_SYSTEM_PROMPT` (tiếng Việt: viết 1-2 câu nhận định
  ngắn gọn về khoảng lương ĐÃ CHO, KHÔNG đưa ra con số mới) + `buildSalaryNotePrompt(input)` với
  `input = { title; categoryLabel; levelLabel; skills; medianMin; medianMax; sampleSize; basis }`
  (chèn khoảng lương + cỡ mẫu để AI diễn giải, có thể nhắc kỹ năng ảnh hưởng định tính).
- `lib/ai/request-salary-note.ts` — `requestSalaryNote(prompt): Promise<SalaryNote>` mirror
  `request-recommendations` (`zodResponseFormat(salaryNoteSchema, "salary_note")`, ném nếu không parse).

## 4. Server action — `lib/jobs/salary-suggest-actions.ts`

`suggestSalary(input: { title: string; category: string | null; experienceLevel: string | null; skills: string })`
→ `{ ok: true; suggestion: SalarySuggestion; note: string } | { ok: false; error: string }`
- `requireRole("RECRUITER")` + rate-limit scope `ai` (key theo user id) — vượt → lỗi thân thiện.
- `rows = await getCachedSalaryRows()`; `s = computeSalarySuggestion(rows, { category, experienceLevel })`.
- `s == null` → `{ ok:false, error:"Chưa đủ dữ liệu lương để gợi ý" }`.
- Gọi AI note trong try/catch: lỗi AI → vẫn trả `{ ok:true, suggestion: s, note: "" }` (số quan trọng hơn note).
- Thành công → `{ ok:true, suggestion: s, note }`.
- Map ngành/cấp bậc slug→label (JOB_CATEGORY_LABELS / EXPERIENCE_LEVEL_LABELS) khi dựng prompt.

## 5. UI `/jobs/new` (mở rộng `NewJobForm.tsx`)

- Chuyển 2 ô `salaryMin`/`salaryMax` thành controlled state (để "Áp dụng" điền được); giữ `name`.
- Cạnh khối Lương: nút **"Gợi ý lương (AI)"**, `disabled` khi chưa chọn `category` hoặc
  `experienceLevel` (hoặc khi `isPending`). Bấm → `useTransition` gọi `suggestSalary({ title, category, experienceLevel, skills })`.
- Thành công → hiển thị thẻ nhỏ: khoảng **X–Y triệu** (dùng `formatSalary` hoặc hiển thị min–max),
  cỡ mẫu *n*, mô tả cơ sở theo `basis` (vd "theo ngành … cấp …" / "toàn thị trường — ít dữ liệu"),
  câu nhận định AI (nếu có), nút **"Áp dụng"** → set `salaryMin`/`salaryMax` từ suggestion.
- Lỗi → `toast.error`.
- Không ảnh hưởng contract `createJobDescription` (các `name` giữ nguyên).

## 6. Kiểm thử

- Thuần (vitest):
  - `computeSalarySuggestion`: khớp category_level; fallback category→level→overall theo cỡ mẫu;
    `basis` đúng; `null` khi không có lương; median min/max đúng; input enum/category không hợp lệ bỏ qua đúng.
  - `salary-note-schema`: parse `{ note }`.
  - `buildSalaryNotePrompt`: chứa khoảng lương, cỡ mẫu, title/label đầu vào; system prompt cấm đưa số mới.
- Wiring (action + UI): tsc + build.
- Kết thúc: `npx tsc --noEmit` 0, `npm run lint` 0 error, `npm test` xanh, `npm run build` PASS.

## 7. Việc người dùng phải tự làm
Không thêm env/DB (dùng Gemini + dữ liệu tin sẵn có). Kiểm tay: `/jobs/new` → chọn ngành + cấp bậc
→ "Gợi ý lương (AI)" → xem khoảng + cỡ mẫu + nhận định → "Áp dụng" → 2 ô lương được điền. Thử cả
trường hợp ít dữ liệu (fallback về overall).

## Để dành vòng sau
Số lương theo kỹ năng cụ thể; gợi ý ở trang sửa tin; biểu đồ phân phối; "so với thị trường" khi xem tin.
