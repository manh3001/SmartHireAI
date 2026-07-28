import OpenAI from "openai";

// Gemini cung cấp endpoint tương thích OpenAI, nên dùng SDK `openai` trỏ tới đó.
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

let client: OpenAI | null = null;

export function getAiClient(): OpenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Chưa cấu hình GEMINI_API_KEY");
  }
  if (!client) {
    client = new OpenAI({ apiKey, baseURL: GEMINI_BASE_URL });
  }
  return client;
}

export const AI_MODEL = "gemini-2.5-flash";
