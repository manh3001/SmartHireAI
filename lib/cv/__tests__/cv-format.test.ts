import { describe, it, expect } from "vitest";
import { dateRange, contactLine, eduSubLine } from "../cv-format";

describe("cv-format", () => {
  it("dateRange: đủ hai -> 'a - b'", () => {
    expect(dateRange("2023-01", "2024-06")).toBe("2023-01 - 2024-06");
  });
  it("dateRange: một rỗng -> phần còn lại", () => {
    expect(dateRange("2023", "")).toBe("2023");
    expect(dateRange("", "2024")).toBe("2024");
  });
  it("dateRange: cả hai rỗng -> ''", () => {
    expect(dateRange("", "")).toBe("");
  });
  it("contactLine: ghép bằng '  •  '", () => {
    expect(contactLine("a@b.com", "0900")).toBe("a@b.com  •  0900");
  });
  it("contactLine: một rỗng -> phần còn lại; cả hai rỗng -> ''", () => {
    expect(contactLine("a@b.com", "")).toBe("a@b.com");
    expect(contactLine("", "")).toBe("");
  });
  it("eduSubLine: ghép major + range bằng '  •  '", () => {
    expect(eduSubLine("CNTT", "2019 - 2023")).toBe("CNTT  •  2019 - 2023");
    expect(eduSubLine("", "2019")).toBe("2019");
    expect(eduSubLine("CNTT", "")).toBe("CNTT");
  });
});
