import { describe, it, expect } from "vitest";
import { buildSalaryNotePrompt, SALARY_NOTE_SYSTEM_PROMPT } from "../salary-note-prompt";

describe("buildSalaryNotePrompt", () => {
  const p = buildSalaryNotePrompt({
    title: "Frontend Developer", categoryLabel: "Công nghệ thông tin", levelLabel: "Junior",
    skills: "React, TypeScript", medianMin: 12_000_000, medianMax: 24_000_000, sampleSize: 8, basis: "category_level",
  });
  it("chứa tiêu đề, ngành, cấp bậc, cỡ mẫu", () => {
    expect(p).toContain("Frontend Developer");
    expect(p).toContain("Công nghệ thông tin");
    expect(p).toContain("Junior");
    expect(p).toContain("8");
  });
  it("system prompt cấm đưa ra con số mới", () => {
    expect(SALARY_NOTE_SYSTEM_PROMPT.toLowerCase()).toContain("không");
  });
});
