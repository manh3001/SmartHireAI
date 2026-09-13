import type { PostMeta } from "./post";

export function allTags(posts: PostMeta[]): string[] {
  const set = new Set<string>();
  for (const p of posts) {
    const t = p.tag.trim();
    if (t) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "vi"));
}

export function filterByTag(posts: PostMeta[], tag: string | undefined): PostMeta[] {
  if (!tag) return posts;
  return posts.filter((p) => p.tag.trim() === tag);
}
