import { describe, it, expect } from "vitest";
import { buildJdDraftPrompt, JD_DRAFT_SYSTEM_PROMPT } from "../jd-draft-prompt";

describe("buildJdDraftPrompt", () => {
  const p = buildJdDraftPrompt({ title: "Frontend Developer", brief: "React, 2 năm KN, Hà Nội" });
  it("chứa tiêu đề và brief", () => {
    expect(p).toContain("Frontend Developer");
    expect(p).toContain("React, 2 năm KN, Hà Nội");
  });
  it("liệt kê các giá trị hợp lệ cho AI chọn", () => {
    expect(p).toContain("FULL_TIME");
    expect(p).toContain("INTERN");
    expect(p).toContain("it"); // category slug
  });
  it("system prompt yêu cầu tiếng Việt", () => {
    expect(JD_DRAFT_SYSTEM_PROMPT.toLowerCase()).toContain("tiếng việt");
  });
});
