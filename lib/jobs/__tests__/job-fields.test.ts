import { describe, it, expect } from "vitest";
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LEVELS,
  EXPERIENCE_LEVEL_LABELS,
  composeJdText,
} from "../job-fields";

describe("job-fields labels", () => {
  it("mọi loại hình có nhãn tiếng Việt", () => {
    expect(EMPLOYMENT_TYPES).toHaveLength(4);
    for (const t of EMPLOYMENT_TYPES) expect(EMPLOYMENT_TYPE_LABELS[t]).toBeTruthy();
    expect(EMPLOYMENT_TYPE_LABELS.FULL_TIME).toBe("Toàn thời gian");
  });
  it("mọi cấp bậc có nhãn", () => {
    expect(EXPERIENCE_LEVELS).toHaveLength(5);
    for (const l of EXPERIENCE_LEVELS) expect(EXPERIENCE_LEVEL_LABELS[l]).toBeTruthy();
    expect(EXPERIENCE_LEVEL_LABELS.SENIOR).toBe("Senior");
  });
});

describe("composeJdText", () => {
  it("ghép meta có mặt trước rawText", () => {
    const out = composeJdText({
      location: "Hà Nội",
      employmentType: "FULL_TIME",
      experienceLevel: "SENIOR",
      skills: "React, Node",
      rawText: "Mô tả chi tiết",
    });
    expect(out).toContain("Địa điểm: Hà Nội");
    expect(out).toContain("Loại hình: Toàn thời gian");
    expect(out).toContain("Cấp bậc: Senior");
    expect(out).toContain("Kỹ năng: React, Node");
    expect(out).toContain("Mô tả chi tiết");
  });

  it("bỏ trường trống/null", () => {
    const out = composeJdText({
      location: "",
      employmentType: null,
      experienceLevel: null,
      skills: "  ",
      rawText: "Chỉ mô tả",
    });
    expect(out).toBe("Chỉ mô tả");
  });

  it("có ít nhất một meta thì kèm rawText phía sau", () => {
    const out = composeJdText({ location: "Remote", rawText: "ND" });
    expect(out).toBe("Địa điểm: Remote\nND");
  });
});
