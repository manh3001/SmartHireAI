import { describe, it, expect } from "vitest";
import { scoreColor } from "../score";

describe("scoreColor", () => {
  it("diem thap -> red", () => {
    expect(scoreColor(30)).toBe("red");
    expect(scoreColor(49)).toBe("red");
  });
  it("diem trung binh -> yellow", () => {
    expect(scoreColor(50)).toBe("yellow");
    expect(scoreColor(74)).toBe("yellow");
  });
  it("diem cao -> green", () => {
    expect(scoreColor(75)).toBe("green");
    expect(scoreColor(100)).toBe("green");
  });
});
