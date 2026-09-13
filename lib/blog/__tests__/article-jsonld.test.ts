import { describe, it, expect } from "vitest";
import { buildArticleJsonLd } from "../article-jsonld";

const meta = { slug: "s", title: "Tiêu đề", description: "Mô tả", date: "2026-09-13", tag: "CV", author: "An" };

describe("buildArticleJsonLd", () => {
  it("shape BlogPosting đúng", () => {
    const ld = buildArticleJsonLd(meta, "https://x.vn/blog/s");
    expect(ld["@type"]).toBe("BlogPosting");
    expect(ld.headline).toBe("Tiêu đề");
    expect(ld.url).toBe("https://x.vn/blog/s");
    expect(ld.datePublished).toBe("2026-09-13");
    expect(ld.author).toEqual({ "@type": "Person", name: "An" });
  });

  it("thiếu author -> fallback SmartHire; thiếu date -> không có datePublished", () => {
    const ld = buildArticleJsonLd({ ...meta, author: "", date: "" }, "https://x.vn/blog/s");
    expect(ld.author).toEqual({ "@type": "Person", name: "SmartHire" });
    expect(ld.datePublished).toBeUndefined();
  });
});
