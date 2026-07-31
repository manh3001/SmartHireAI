import { zodResponseFormat } from "openai/helpers/zod";
import { getAiClient, AI_MODEL } from "./client";
import { RECOMMENDATION_SYSTEM_PROMPT } from "./recommendation-prompt";
import {
  recommendationResultSchema,
  type RecommendationResult,
} from "./recommendation-schema";

export async function requestRecommendations(
  prompt: string,
): Promise<RecommendationResult> {
  const client = getAiClient();
  const completion = await client.chat.completions.parse({
    model: AI_MODEL,
    messages: [
      { role: "system", content: RECOMMENDATION_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: zodResponseFormat(recommendationResultSchema, "recommendation"),
  });
  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    throw new Error("Model không trả về kết quả hợp lệ");
  }
  return parsed;
}
