import { zodResponseFormat } from "openai/helpers/zod";
import { getAiClient, AI_MODEL } from "./client";
import { MOCK_QUESTIONS_SYSTEM_PROMPT, MOCK_SCORING_SYSTEM_PROMPT } from "./mock-interview-prompt";
import { mockQuestionsSchema, mockScoringSchema, type MockScoring } from "./mock-interview-schema";

export async function requestMockQuestions(prompt: string): Promise<string[]> {
  const client = getAiClient();
  const completion = await client.chat.completions.parse({
    model: AI_MODEL,
    messages: [
      { role: "system", content: MOCK_QUESTIONS_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: zodResponseFormat(mockQuestionsSchema, "mock_questions"),
  });
  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) throw new Error("Model không trả về câu hỏi hợp lệ");
  return parsed.questions;
}

export async function requestMockScoring(prompt: string): Promise<MockScoring> {
  const client = getAiClient();
  const completion = await client.chat.completions.parse({
    model: AI_MODEL,
    messages: [
      { role: "system", content: MOCK_SCORING_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: zodResponseFormat(mockScoringSchema, "mock_scoring"),
  });
  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) throw new Error("Model không trả về kết quả chấm điểm hợp lệ");
  return parsed;
}
