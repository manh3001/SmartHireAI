import { zodResponseFormat } from "openai/helpers/zod";
import { getAiClient, AI_MODEL } from "./client";
import { JD_DRAFT_SYSTEM_PROMPT } from "./jd-draft-prompt";
import { jdDraftSchema, type JdDraft } from "./jd-draft-schema";

export async function requestJdDraft(prompt: string): Promise<JdDraft> {
  const client = getAiClient();
  const completion = await client.chat.completions.parse({
    model: AI_MODEL,
    messages: [
      { role: "system", content: JD_DRAFT_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: zodResponseFormat(jdDraftSchema, "jd_draft"),
  });
  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    throw new Error("Model không trả về kết quả hợp lệ");
  }
  return parsed;
}
