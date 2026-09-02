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
