import { zodResponseFormat } from "openai/helpers/zod";
import { getAiClient, AI_MODEL } from "./client";
import { SCREENING_SYSTEM_PROMPT } from "./screening-prompt";
import { screeningResultSchema, type ScreeningResult } from "./screening-schema";

export async function requestScreening(prompt: string): Promise<ScreeningResult> {
  const client = getAiClient();
  const completion = await client.chat.completions.parse({
    model: AI_MODEL,
    messages: [
      { role: "system", content: SCREENING_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: zodResponseFormat(screeningResultSchema, "screening"),
  });
  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    throw new Error("Model không trả về kết quả hợp lệ");
  }
  return parsed;
}
