import { describe, it, expect } from "vitest";
import { parseFrontmatter } from "../frontmatter";

describe("parseFrontmatter", () => {
  it("đọc nhiều key, value chứa dấu ':' chỉ tách dấu đầu, bỏ dòng trống đầu content", () => {
    const raw = "---\ntitle: Hello\ndescription: A: B\n---\n\nBody line\n";
    const { data, content } = parseFrontmatter(raw);
    expect(data).toEqual({ title: "Hello", description: "A: B" });
    expect(content).toBe("Body line\n");
  });

  it("không có frontmatter -> data rỗng, content nguyên bản", () => {
    const raw = "# Tiêu đề\nnội dung";
    expect(parseFrontmatter(raw)).toEqual({ data: {}, content: raw });
  });

  it("hỗ trợ CRLF", () => {
    const raw = "---\r\ntitle: X\r\n---\r\nBody\r\n";
    const { data, content } = parseFrontmatter(raw);
    expect(data).toEqual({ title: "X" });
    expect(content).toBe("Body\n");
  });
});
