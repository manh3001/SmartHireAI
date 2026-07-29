# Phase 4: Chatbot tư vấn (có ngữ cảnh CV) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho ứng viên chat với AI tư vấn nghề nghiệp — bot biết ngữ cảnh CV + đánh giá gần nhất, trả lời streaming, lưu lịch sử.

**Architecture:** Chat gắn theo từng CV tại `/cv/[id]/chat`. API route `/api/cv/[id]/chat` lưu tin người dùng, nạp ngữ cảnh (CV + đánh giá gần nhất + lịch sử từ DB), gọi Gemini với `stream: true`, đẩy văn bản về client theo `ReadableStream`, và lưu tin assistant khi stream xong. Logic thuần (`buildChatSystemPrompt`) test bằng TDD.

**Tech Stack:** Next.js 16, TypeScript, Prisma 6, PostgreSQL (Neon), `openai` SDK (trỏ Gemini), shadcn/ui, Vitest.

## Global Constraints

- Ngôn ngữ: TypeScript, chế độ `strict`.
- **Prisma giữ v6**; chạy lệnh DB qua npm script (`db:push`) để tránh Neon P1001 (IPv6). Nếu `npx prisma` lỗi P1001, thêm `NODE_OPTIONS=--dns-result-order=ipv4first`.
- AI: Gemini `gemini-2.5-flash` qua `getAiClient()` + `AI_MODEL` (đã có ở `lib/ai/client.ts`). **KHÔNG set `effort`/`thinking`.**
- `GEMINI_API_KEY` chỉ dùng ở server, không lộ client.
- Next.js 16: `params` của route/page động là `Promise` — phải `await params`.
- Chỉ chủ CV chat/xem lịch sử CV của mình (kiểm tra `userId` từ session).
- Route streaming: `export const runtime = "nodejs"`.
- Mỗi task kết thúc bằng một commit.

---

### Task 1: Prisma models ChatSession + ChatMessage

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: model `User`, `CV` đã có.
- Produces: enum `ChatRole`, models `ChatSession`, `ChatMessage`; quan hệ `User.chatSessions`, `CV.chatSessions`.

- [ ] **Step 1: Thêm quan hệ ngược vào User**

Trong `model User`, thêm dòng sau `evaluations Evaluation[]`:
```prisma
  chatSessions    ChatSession[]
```

- [ ] **Step 2: Thêm quan hệ ngược vào CV**

Trong `model CV`, thêm dòng sau `evaluations Evaluation[]`:
```prisma
  chatSessions ChatSession[]
```

- [ ] **Step 3: Thêm enum + 2 model**

Thêm vào cuối `prisma/schema.prisma`:
```prisma
enum ChatRole {
  USER
  ASSISTANT
}

model ChatSession {
  id        String        @id @default(cuid())
  userId    String
  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  cvId      String
  cv        CV            @relation(fields: [cvId], references: [id], onDelete: Cascade)
  messages  ChatMessage[]
  createdAt DateTime      @default(now())
}

model ChatMessage {
  id        String      @id @default(cuid())
  sessionId String
  session   ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  role      ChatRole
  content   String
  createdAt DateTime    @default(now())
}
```

- [ ] **Step 4: Đẩy schema lên Neon**

```bash
npm run db:push
```
Expected: "Your database is now in sync"; bảng `ChatSession`, `ChatMessage` được tạo. (Nếu `generate` báo EPERM do node đang khóa file: dừng tiến trình node rồi `npx prisma generate`.)

- [ ] **Step 5: Kiểm tra type**

Run: `npx tsc --noEmit`
Expected: không lỗi (`prisma.chatSession`, `prisma.chatMessage` tồn tại).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add ChatSession and ChatMessage models"
```

---

### Task 2: `buildChatSystemPrompt` (TDD)

**Files:**
- Create: `lib/ai/chat.ts`
- Test: `lib/ai/__tests__/chat.test.ts`

**Interfaces:**
- Consumes: `CvInput` từ `@/lib/cv/types`; `EvaluationResult` từ `@/lib/ai/schema`.
- Produces: `buildChatSystemPrompt(cv: CvInput, evaluation?: EvaluationResult): string`.

- [ ] **Step 1: Viết test (failing)**

Create `lib/ai/__tests__/chat.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildChatSystemPrompt } from "../chat";
import type { CvInput } from "@/lib/cv/types";
import type { EvaluationResult } from "../schema";

const cv: CvInput = {
  title: "CV",
  profile: { fullName: "Nguyễn Văn A", headline: "Frontend Dev", email: "", phone: "", summary: "Yêu code" },
  experiences: [{ company: "FPT", position: "Dev", startDate: "2023", endDate: "2024", description: "web" }],
  educations: [],
  skills: [{ name: "React", level: "" }],
  projects: [],
};

const evalResult: EvaluationResult = {
  overallScore: 75,
  strengths: ["React tốt"],
  weaknesses: ["Thiếu backend"],
  matchedKeywords: [],
  missingKeywords: [],
  skillGaps: [{ skill: "Node.js", why: "x", howToLearn: "y" }],
  summary: "ổn",
};

describe("buildChatSystemPrompt", () => {
  it("chua vai tro tu van + thong tin CV", () => {
    const p = buildChatSystemPrompt(cv);
    expect(p.toLowerCase()).toContain("tư vấn");
    expect(p).toContain("Nguyễn Văn A");
    expect(p).toContain("React");
  });

  it("them ket qua danh gia khi co", () => {
    const p = buildChatSystemPrompt(cv, evalResult);
    expect(p).toContain("75");
    expect(p).toContain("Node.js");
  });

  it("khong loi khi khong co danh gia", () => {
    const p = buildChatSystemPrompt(cv);
    expect(p).not.toContain("KẾT QUẢ ĐÁNH GIÁ");
  });
});
```

- [ ] **Step 2: Chạy test xác nhận FAIL**

Run: `npx vitest run lib/ai/__tests__/chat.test.ts`
Expected: FAIL "Cannot find module '../chat'".

- [ ] **Step 3: Viết chat.ts**

Create `lib/ai/chat.ts`:
```ts
import type { CvInput } from "@/lib/cv/types";
import type { EvaluationResult } from "./schema";

export function buildChatSystemPrompt(
  cv: CvInput,
  evaluation?: EvaluationResult,
): string {
  const p = cv.profile;
  const parts: string[] = [];

  parts.push(
    "Bạn là cố vấn nghề nghiệp thân thiện, giàu kinh nghiệm. " +
      "Hãy tư vấn cho ứng viên về CV và định hướng nghề nghiệp dựa trên hồ sơ bên dưới. " +
      "Trả lời bằng tiếng Việt, ngắn gọn, thực tế và khích lệ. " +
      "Chỉ dựa vào thông tin trong CV và kết quả đánh giá; không bịa thông tin không có.",
  );

  parts.push("\n--- CV CỦA ỨNG VIÊN ---");
  parts.push(`Họ tên: ${p.fullName || "(chưa có)"}`);
  if (p.headline) parts.push(`Chức danh: ${p.headline}`);
  if (p.summary) parts.push(`Giới thiệu: ${p.summary}`);
  if (cv.experiences.length) {
    parts.push(
      "Kinh nghiệm: " +
        cv.experiences.map((e) => `${e.position} tại ${e.company}`).join("; "),
    );
  }
  if (cv.skills.length) {
    parts.push("Kỹ năng: " + cv.skills.map((s) => s.name).join(", "));
  }
  if (cv.projects.length) {
    parts.push("Dự án: " + cv.projects.map((pr) => pr.name).join(", "));
  }

  if (evaluation) {
    parts.push("\n--- KẾT QUẢ ĐÁNH GIÁ GẦN NHẤT ---");
    parts.push(`Điểm phù hợp: ${evaluation.overallScore}/100`);
    if (evaluation.strengths.length)
      parts.push("Điểm mạnh: " + evaluation.strengths.join("; "));
    if (evaluation.weaknesses.length)
      parts.push("Điểm yếu: " + evaluation.weaknesses.join("; "));
    if (evaluation.skillGaps.length)
      parts.push(
        "Kỹ năng còn thiếu: " +
          evaluation.skillGaps.map((g) => g.skill).join(", "),
      );
  }

  return parts.join("\n");
}
```

- [ ] **Step 4: Chạy test xác nhận PASS**

Run: `npx vitest run lib/ai/__tests__/chat.test.ts`
Expected: 3 test PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/chat.ts lib/ai/__tests__/chat.test.ts
git commit -m "feat: add buildChatSystemPrompt with tests"
```

---

### Task 3: API route streaming `/api/cv/[id]/chat`

**Files:**
- Create: `app/api/cv/[id]/chat/route.ts`

**Interfaces:**
- Consumes: `getAiClient`, `AI_MODEL` từ `@/lib/ai/client`; `buildChatSystemPrompt` từ `@/lib/ai/chat`; `EvaluationResult` từ `@/lib/ai/schema`; `createRateLimiter` từ `@/lib/ai/rate-limit`; `prisma`, `auth`; `CvInput` từ `@/lib/cv/types`.
- Produces: `POST /api/cv/[id]/chat` nhận `{ message }`, trả về luồng văn bản (`text/plain`); lưu tin user + assistant vào DB.

- [ ] **Step 1: Viết route**

Create `app/api/cv/[id]/chat/route.ts`:
```ts
import { auth } from "@/auth";
import prisma from "@/lib/db/prisma";
import { getAiClient, AI_MODEL } from "@/lib/ai/client";
import { buildChatSystemPrompt } from "@/lib/ai/chat";
import type { EvaluationResult } from "@/lib/ai/schema";
import { createRateLimiter } from "@/lib/ai/rate-limit";
import type { CvInput } from "@/lib/cv/types";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const runtime = "nodejs";

const limiter = createRateLimiter({ max: 20, windowMs: 60000 });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Chưa đăng nhập", { status: 401 });
  }
  const userId = session.user.id;

  if (!limiter.check(userId, Date.now())) {
    return new Response("Bạn nhắn quá nhanh, vui lòng chờ một chút", { status: 429 });
  }

  let message = "";
  try {
    const body = await req.json();
    message = String(body.message ?? "").trim();
  } catch {
    return new Response("Dữ liệu không hợp lệ", { status: 400 });
  }
  if (!message) return new Response("Tin nhắn rỗng", { status: 400 });

  // Nạp CV (kiểm tra quyền) + map sang CvInput
  const cv = await prisma.cV.findFirst({
    where: { id, userId },
    include: {
      profile: true,
      experiences: { orderBy: { order: "asc" } },
      educations: { orderBy: { order: "asc" } },
      skills: { orderBy: { order: "asc" } },
      projects: { orderBy: { order: "asc" } },
    },
  });
  if (!cv) return new Response("Không tìm thấy CV", { status: 404 });

  const cvInput: CvInput = {
    title: cv.title,
    profile: {
      fullName: cv.profile?.fullName ?? "",
      headline: cv.profile?.headline ?? "",
      email: cv.profile?.email ?? "",
      phone: cv.profile?.phone ?? "",
      summary: cv.profile?.summary ?? "",
    },
    experiences: cv.experiences.map((e) => ({
      company: e.company, position: e.position,
      startDate: e.startDate, endDate: e.endDate, description: e.description,
    })),
    educations: cv.educations.map((e) => ({
      school: e.school, major: e.major, startDate: e.startDate, endDate: e.endDate,
    })),
    skills: cv.skills.map((s) => ({ name: s.name, level: s.level })),
    projects: cv.projects.map((p) => ({
      name: p.name, description: p.description, tech: p.tech, link: p.link,
    })),
  };

  // Đánh giá gần nhất (nếu có)
  const evalRow = await prisma.evaluation.findFirst({
    where: { cvId: id, userId },
    orderBy: { createdAt: "desc" },
  });
  const evaluation: EvaluationResult | undefined = evalRow
    ? {
        overallScore: evalRow.overallScore,
        strengths: evalRow.strengths as unknown as string[],
        weaknesses: evalRow.weaknesses as unknown as string[],
        matchedKeywords: evalRow.matchedKeywords as unknown as string[],
        missingKeywords: evalRow.missingKeywords as unknown as string[],
        skillGaps: evalRow.skillGaps as unknown as EvaluationResult["skillGaps"],
        summary: evalRow.summary,
      }
    : undefined;

  // Lấy/tạo phiên chat
  let chatSession = await prisma.chatSession.findFirst({
    where: { cvId: id, userId },
  });
  if (!chatSession) {
    chatSession = await prisma.chatSession.create({ data: { userId, cvId: id } });
  }

  // Lưu tin người dùng
  await prisma.chatMessage.create({
    data: { sessionId: chatSession.id, role: "USER", content: message },
  });

  // Nạp toàn bộ lịch sử (đã gồm tin vừa lưu)
  const history = await prisma.chatMessage.findMany({
    where: { sessionId: chatSession.id },
    orderBy: { createdAt: "asc" },
  });

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: buildChatSystemPrompt(cvInput, evaluation) },
    ...history.map((m) => ({
      role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    })),
  ];

  // Gọi Gemini streaming
  const client = getAiClient();
  const sessionId = chatSession.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        const completion = await client.chat.completions.create({
          model: AI_MODEL,
          messages,
          stream: true,
        });
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            full += delta;
            controller.enqueue(encoder.encode(delta));
          }
        }
      } catch {
        controller.enqueue(encoder.encode("\n[Có lỗi khi tạo phản hồi, vui lòng thử lại]"));
      } finally {
        if (full) {
          await prisma.chatMessage.create({
            data: { sessionId, role: "ASSISTANT", content: full },
          });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
```

- [ ] **Step 2: Kiểm tra type + build**

Run: `npx tsc --noEmit && npm run build`
Expected: không lỗi; route `/api/cv/[id]/chat` xuất hiện.

- [ ] **Step 3: Commit**

```bash
git add app/api/cv/[id]/chat/route.ts
git commit -m "feat: add streaming chat API route"
```

---

### Task 4: Trang chat + ChatClient + nút vào chat

**Files:**
- Create: `app/cv/[id]/chat/page.tsx`
- Create: `app/cv/[id]/chat/ChatClient.tsx`
- Modify: `app/cv/[id]/CvEditor.tsx` (thêm nút "Chat tư vấn")

**Interfaces:**
- Consumes: `auth`, `prisma`; component shadcn.
- Produces: luồng chat hoạt động (gửi tin → đọc stream → hiển thị dần → lưu DB).

- [ ] **Step 1: Viết server component nạp CV + lịch sử**

Create `app/cv/[id]/chat/page.tsx`:
```tsx
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/db/prisma";
import ChatClient, { type ChatMsg } from "./ChatClient";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cv = await prisma.cV.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, title: true },
  });
  if (!cv) notFound();

  const chatSession = await prisma.chatSession.findFirst({
    where: { cvId: cv.id, userId: session.user.id },
    select: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true },
      },
    },
  });

  const initial: ChatMsg[] =
    chatSession?.messages.map((m) => ({
      id: m.id,
      role: m.role === "USER" ? "user" : "assistant",
      content: m.content,
    })) ?? [];

  return <ChatClient cvId={cv.id} cvTitle={cv.title} initial={initial} />;
}
```

- [ ] **Step 2: Viết client component chat**

Create `app/cv/[id]/chat/ChatClient.tsx`:
```tsx
"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ChatMsg = { id: string; role: "user" | "assistant"; content: string };

export default function ChatClient({
  cvId,
  cvTitle,
  initial,
}: {
  cvId: string;
  cvTitle: string;
  initial: ChatMsg[];
}) {
  const [messages, setMessages] = useState<ChatMsg[]>(initial);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setLoading(true);

    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: "user", content: text };
    const botMsg: ChatMsg = { id: `a-${Date.now()}`, role: "assistant", content: "" };
    setMessages((m) => [...m, userMsg, botMsg]);
    scrollToBottom();

    try {
      const res = await fetch(`/api/cv/${cvId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok || !res.body) {
        const errText = await res.text();
        toast.error(errText || "Gửi thất bại");
        setMessages((m) => m.filter((x) => x.id !== botMsg.id));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) =>
          m.map((x) => (x.id === botMsg.id ? { ...x, content: x.content + chunk } : x)),
        );
        scrollToBottom();
      }
    } catch {
      toast.error("Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-1px)] max-w-3xl flex-col bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <Link href={`/cv/${cvId}`} className="text-sm text-blue-600 hover:underline">← Về CV</Link>
        <h1 className="text-lg font-semibold text-slate-900">Tư vấn: {cvTitle}</h1>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4">
        {messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-slate-400">
            Hãy hỏi bất cứ điều gì về CV hoặc định hướng nghề nghiệp của bạn.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[80%] whitespace-pre-wrap rounded-2xl bg-blue-600 px-4 py-2 text-sm text-white"
                  : "max-w-[80%] whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800"
              }
            >
              {m.content || (m.role === "assistant" && loading ? "..." : "")}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={onSend} className="mt-3 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nhập câu hỏi..."
          disabled={loading}
        />
        <Button type="submit" disabled={loading || !input.trim()}>
          {loading ? "..." : "Gửi"}
        </Button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Thêm nút "Chat tư vấn" vào trình sửa CV**

Trong `app/cv/[id]/CvEditor.tsx`, tìm link "Đánh giá theo JD" và thêm link chat ngay trước nó. Khối sau khi sửa:
```tsx
        <div className="flex gap-2">
          <a href={`/cv/${cvId}/chat`}>
            <Button variant="outline">Chat tư vấn</Button>
          </a>
          <a href={`/cv/${cvId}/evaluate`}>
            <Button variant="outline">Đánh giá theo JD</Button>
          </a>
          <a href={`/api/cv/${cvId}/pdf`}>
            <Button variant="outline">Xuất PDF</Button>
          </a>
          <Button onClick={onSave} disabled={pending}>
            {pending ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
```

- [ ] **Step 4: Kiểm tra type + build + test**

Run: `npx tsc --noEmit && npm run build && npm test`
Expected: build sạch; route `/cv/[id]/chat` xuất hiện; test **37/37 PASS** (34 cũ + 3 mới ở Task 2).

- [ ] **Step 5: Kiểm tra thủ công (cần GEMINI_API_KEY + đăng nhập)**

```bash
npm run dev
```
1. Đăng nhập → mở CV có dữ liệu → bấm "Chat tư vấn".
2. Hỏi "CV của tôi nên cải thiện gì?" → thấy **chữ chạy dần**.
3. Hỏi tiếp một câu → bot nhớ ngữ cảnh (CV + hội thoại trước).
4. Tải lại trang → lịch sử chat vẫn còn.

- [ ] **Step 6: Commit**

```bash
git add app/cv
git commit -m "feat: add CV chat page with streaming and history"
```

---

## Self-Review

**Spec coverage:**
- Gemini streaming (`stream: true`) chỉ ở server → Task 3. ✓
- Model `ChatSession` + `ChatMessage` + enum `ChatRole` + quan hệ → Task 1. ✓
- Chat gắn theo từng CV; 1 phiên/CV (findFirst hoặc create) → Task 3, Task 4 (page). ✓
- Ngữ cảnh: CV + đánh giá gần nhất → `buildChatSystemPrompt` (Task 2), nạp evalRow (Task 3). ✓
- Lưu tin user trước, tin assistant sau khi stream xong → Task 3. ✓
- Server tự đọc lịch sử từ DB (client chỉ gửi tin mới) → Task 3 (đọc `history`), Task 4 (client gửi `{message}`). ✓
- Rate limit đơn giản → Task 3. ✓
- Xử lý lỗi mềm (thiếu key/model lỗi/tin rỗng/429/404) → Task 3. ✓
- Quyền sở hữu (userId từ session) → Task 3 (findFirst theo userId), Task 4 (page). ✓
- Giao diện khung chat streaming, tông xanh → Task 4. ✓
- Nút "Chat tư vấn" ở trang sửa CV → Task 4 Step 3. ✓
- TDD cho `buildChatSystemPrompt` → Task 2. ✓

**Placeholder scan:** Không có TBD/TODO; mọi step có code/lệnh cụ thể. ✓

**Type consistency:** `buildChatSystemPrompt(cv, evaluation?)` định nghĩa Task 2, dùng Task 3. `ChatMsg` định nghĩa Task 4 (ChatClient) dùng ở page. `EvaluationResult`, `CvInput`, `getAiClient`, `AI_MODEL`, `createRateLimiter` (đã có) dùng nhất quán. Vai trò DB `USER`/`ASSISTANT` ↔ client `user`/`assistant` map rõ ở Task 3 và Task 4. ✓

**Lưu ý runtime đã tính:** route streaming `runtime = "nodejs"` + `ReadableStream`; `params` là Promise; Gemini không set `effort`/`thinking`; Neon IPv4 qua npm script; lưu tin assistant trong `finally` sau khi stream xong.
