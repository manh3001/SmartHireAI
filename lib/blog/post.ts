export type PostMeta = {
  slug: string;
  title: string;
  description: string;
  date: string;
  tag: string;
  author: string;
};

export function buildPostMeta(slug: string, data: Record<string, string>): PostMeta {
  return {
    slug,
    title: data.title || slug,
    description: data.description || "",
    date: data.date || "",
    tag: data.tag || "",
    author: data.author || "",
  };
}
