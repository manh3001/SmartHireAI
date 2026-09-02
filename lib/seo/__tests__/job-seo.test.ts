import { describe, it, expect } from "vitest";
import { employmentTypeToSchema, metaDescription } from "../job-seo";

describe("employmentTypeToSchema", () => {
  it("map sang giá trị schema.org của Google", () => {
    expect(employmentTypeToSchema("FULL_TIME")).toBe("FULL_TIME");
    expect(employmentTypeToSchema("PART_TIME")).toBe("PART_TIME");
    expect(employmentTypeToSchema("CONTRACT")).toBe("CONTRACTOR");
    expect(employmentTypeToSchema("INTERNSHIP")).toBe("INTERN");
  });
});

describe("metaDescription", () => {
  it("gộp khoảng trắng và giữ nguyên text ngắn", () => {
    expect(metaDescription("Xin  chào\n\nthế giới")).toBe("Xin chào thế giới");
  });
  it("cắt text dài và thêm dấu …", () => {
    const r = metaDescription("a".repeat(200), 10);
    expect(r.length).toBe(10);
    expect(r.endsWith("…")).toBe(true);
  });
});
