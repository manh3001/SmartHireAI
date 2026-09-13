import type { PostMeta } from "./post";

export function buildArticleJsonLd(meta: PostMeta, url: string): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "BlogPosting",
    headline: meta.title,
    description: meta.description,
    author: { "@type": "Person", name: meta.author || "SmartHire" },
    url,
  };
  if (meta.date) ld.datePublished = meta.date;
  return ld;
}
