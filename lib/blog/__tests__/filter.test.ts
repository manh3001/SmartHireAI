import { describe, it, expect } from "vitest";
import { allTags, filterByTag } from "../filter";
import type { PostMeta } from "../post";

function post(slug: string, tag: string): PostMeta {
  return { slug, title: slug, description: "", date: "", tag, author: "", cover: "" };
}

describe("allTags", () => {
  it("distinct, bỏ rỗng, sắp abc", () => {
    const posts = [post("a", "CV"), post("b", "Phỏng vấn"), post("c", "CV"), post("d", "")];
    expect(allTags(posts)).toEqual(["CV", "Phỏng vấn"]);
  });
});

describe("filterByTag", () => {
  const posts = [post("a", "CV"), post("b", "Phỏng vấn")];
  it("tag rỗng/undefined -> giữ nguyên", () => {
    expect(filterByTag(posts, undefined)).toHaveLength(2);
    expect(filterByTag(posts, "")).toHaveLength(2);
  });
  it("tag khớp -> lọc", () => {
    expect(filterByTag(posts, "CV").map((p) => p.slug)).toEqual(["a"]);
  });
  it("tag không khớp -> []", () => {
    expect(filterByTag(posts, "Khác")).toEqual([]);
  });
});
