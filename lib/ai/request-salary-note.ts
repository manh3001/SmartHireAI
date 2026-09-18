import { zodResponseFormat } from "openai/helpers/zod";
import { getAiClient, AI_MODEL } from "./client";
import { SALARY_NOTE_SYSTEM_PROMPT } from "./salary-note-prompt";
import { salaryNoteSchema, type SalaryNote } from "./salary-note-schema";

export async function requestSalaryNote(prompt: string): Promise<SalaryNote> {
  const client = getAiClient();
  const completion = await client.chat.completions.parse({
    model: AI_MODEL,
    messages: [
      { role: "system", content: SALARY_NOTE_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: zodResponseFormat(salaryNoteSchema, "salary_note"),
  });
  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    throw new Error("Model không trả về kết quả hợp lệ");
  }
  return parsed;
}
