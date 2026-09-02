# Cover Letter AI (Sinh thư xin việc bằng AI) — Design Spec

**Ngày:** 2026-09-02
**Vòng:** 6 (tính năng thứ hai của nhóm E "tính năng hoãn")

## Mục tiêu

Cho **ứng viên** sinh nháp **thư giới thiệu (cover letter)** bằng AI ngay trong form ứng tuyển, dựa trên **CV đã chọn + JD của tin**. Kết quả đổ vào ô "Thư giới thiệu" sẵn có (sửa được), nộp như luồng hiện tại. Không thêm schema, không lưu bản nháp riêng.

## Quyết định thiết kế (đã chốt với user)

- **Điểm đặt:** nút trong `ApplyForm` (`app/jobs/[id]/apply/ApplyForm.tsx`), cạnh ô "Thư giới thiệu". Không có trang/thư viện nháp riêng.
- **Không schema mới:** kết quả chỉ nằm trong state `coverLetter` của form; khi nộp lưu vào `Application.coverLetter` (đã tồn tại, `@default("")`).
- **Một nút, mặc định:** không chọn giọng/độ dài. Thư ~150–250 từ, giọng chuyên nghiệp, tiếng Việt.
- **Chỉ dùng dữ kiện trong CV** — không bịa thông tin không có.
- **Ghi đè:** nếu ô thư đang có nội dung, hiện **Dialog xác nhận** trước khi thay (tái dùng `components/ui/dialog`, KHÔNG dùng `window.confirm` — nhất quán với việc vừa gỡ anti-pattern này). Ô rỗng → đổ thẳng.
- Văn xuôi (plain text completion), **không** structured/JSON output.

## Kiến trúc

Bám khuôn action `previewMatch` (`lib/applications/actions.ts`): auth → `CANDIDATE` → `checkRateLimit("ai", userId)` → load job (`isPublic`) + CV (`loadCvInput`) → gọi AI trong `try/catch` → trả `{ok,...}`. Lớp AI tách prompt thuần (test được) khỏi lời gọi mạng.

### 1. Lớp AI

**`lib/ai/cover-letter-prompt.ts`** (thuần, test được):
- `COVER_LETTER_SYSTEM_PROMPT: string` — vai trò: trợ lý viết thư xin việc; yêu cầu: tiếng Việt, ~150–250 từ, giọng chuyên nghiệp & chân thành, chỉ dùng dữ kiện trong CV (không bịa số liệu/kinh nghiệm), nêu bật kỹ năng/kinh nghiệm khớp JD, KHÔNG lặp lại nguyên văn JD, trả về DUY NHẤT nội dung thư (không tiêu đề "Cover letter", không markdown).
- `buildCoverLetterPrompt(cv: CvInput, jdText: string, candidateName: string): string` — ghép phần CV + JD + tên ứng viên + chỉ dẫn. **Tái dùng `formatCv`** bằng cách EXPORT hàm `formatCv` hiện có trong `lib/ai/prompt.ts` (đổi `function formatCv` → `export function formatCv`) rồi import — DRY, không viết lại. Không đổi hành vi `buildEvaluationPrompt`.

**`lib/ai/request-cover-letter.ts`**:
```typescript
import { getAiClient, AI_MODEL } from "./client";
import { COVER_LETTER_SYSTEM_PROMPT } from "./cover-letter-prompt";

export async function requestCoverLetter(prompt: string): Promise<string> {
  const client = getAiClient();
  const completion = await client.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: "system", content: COVER_LETTER_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  });
  const text = completion.choices[0]?.message.content?.trim();
  if (!text) throw new Error("Model không trả về nội dung thư");
  return text;
}
```

### 2. Server action

Thêm vào `lib/applications/actions.ts`:
```typescript
export async function generateCoverLetter(
  jobId: string,
  cvId: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "CANDIDATE")
    return { ok: false, error: "Chỉ ứng viên mới dùng tính năng này" };

  if (!(await checkRateLimit("ai", userId)))
    return { ok: false, error: "Bạn thao tác quá nhanh, thử lại sau một phút" };

  const job = await prisma.jobDescription.findFirst({
    where: { id: jobId, isPublic: true },
    select: {
      id: true, rawText: true,
      location: true, employmentType: true, experienceLevel: true, skills: true,
      salaryMin: true, salaryMax: true, salaryNegotiable: true,
    },
  });
  if (!job) return { ok: false, error: "Không tìm thấy tin tuyển dụng" };

  const cv = await loadCvInput(cvId, userId);
  if (!cv) return { ok: false, error: "Không tìm thấy CV" };

  try {
    const text = await requestCoverLetter(
      buildCoverLetterPrompt(cv, composeJdText(job), cv.profile.fullName || session.user.name || "Ứng viên"),
    );
    return { ok: true, text };
  } catch {
    return { ok: false, error: "AI viết thư thất bại, vui lòng thử lại" };
  }
}
```
Import bổ sung: `requestCoverLetter`, `buildCoverLetterPrompt` (các import `auth`, `prisma`, `checkRateLimit`, `loadCvInput`, `composeJdText` đã có sẵn trong file).

### 3. UI — `ApplyForm.tsx`

- Nút "✨ Viết thư bằng AI" đặt cạnh label/ô "Thư giới thiệu"; `disabled` khi `!cvId` hoặc đang chạy; nhãn "Đang viết..." khi chạy.
- Bấm nút: nếu `coverLetter.trim()` **rỗng** → gọi action, đổ `text` vào state. Nếu **có nội dung** → mở Dialog xác nhận "Thay nội dung thư hiện tại bằng bản AI?"; đồng ý mới ghi đè.
- Gọi `generateCoverLetter(jobId, cvId)`; `ok` → `setCoverLetter(text)` + toast "Đã tạo thư giới thiệu"; lỗi → `toast.error(error)`.
- State mới: `generating` (bool), `confirmOpen` (bool). Dialog tái dùng `components/ui/dialog` (Dialog/DialogContent/DialogHeader/DialogTitle/DialogDescription/DialogFooter) + 2 nút.
- Sau khi đổ, người dùng sửa tự do; nộp qua `submitApplication` như cũ (không đổi).

### 4. Ràng buộc

- Rate-limit `"ai"` (dùng chung với previewMatch/evaluation).
- Chỉ `CANDIDATE`. Toàn bộ chữ tiếng Việt. Chỉ Tailwind design token; dark-mode readable.
- `maxLength={3000}` của textarea giữ nguyên (thư AI ngắn hơn nhiều).
- Không sửa component xem trước CV.

### 5. Testing & verify

- Unit: `lib/ai/__tests__/cover-letter-prompt.test.ts` — `buildCoverLetterPrompt` chứa tên ứng viên, nội dung JD truyền vào, và chỉ dẫn chính (độ dài ~150–250 từ, "không bịa"); có thể kiểm CV (kỹ năng) xuất hiện trong prompt.
- Không unit test cho `requestCoverLetter`/`generateCoverLetter` (lời gọi mạng + wiring; nhất quán với `request-evaluation`/`previewMatch` không có unit test riêng).
- `npx tsc --noEmit` 0 lỗi; `npx vitest run` xanh (baseline 359 + số test mới); `npm run build` pass.
- Manual (user tự kiểm bằng `npm run dev`, cần `GEMINI_API_KEY`): chọn CV → "Viết thư bằng AI" → thư tiếng Việt hợp lý đổ vào ô; sửa được; ô đang có chữ → Dialog xác nhận; rate-limit khi bấm quá nhanh; nộp đơn lưu đúng nội dung.

## Ngoài phạm vi (YAGNI)

Lưu nhiều bản nháp/thư viện thư; chọn giọng văn/độ dài; sinh thư cho recruiter; đa ngôn ngữ; chèn tên công ty/vị trí tùy biến sâu ngoài JD.
