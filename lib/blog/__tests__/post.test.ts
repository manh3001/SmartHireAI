import { describe, it, expect } from "vitest";
import { buildPostMeta } from "../post";

describe("buildPostMeta", () => {
  it("map đầy đủ từ frontmatter", () => {
    const meta = buildPostMeta("bai-1", {
      title: "Tiêu đề", description: "Mô tả", date: "2026-09-13", tag: "CV", author: "An",
    });
    expect(meta).toEqual({
      slug: "bai-1", title: "Tiêu đề", description: "Mô tả", date: "2026-09-13", tag: "CV", author: "An",
    });
  });

  it("thiếu title -> fallback slug; field khác rỗng", () => {
    const meta = buildPostMeta("bai-2", {});
    expect(meta).toEqual({ slug: "bai-2", title: "bai-2", description: "", date: "", tag: "", author: "" });
  });
});
