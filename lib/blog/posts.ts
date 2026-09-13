import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseFrontmatter } from "./frontmatter";
import { buildPostMeta, type PostMeta } from "./post";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");
const SLUG_RE = /^[a-z0-9-]+$/;

export async function getAllPosts(): Promise<PostMeta[]> {
  let files: string[];
  try {
    files = await readdir(BLOG_DIR);
  } catch {
    return [];
  }
  const posts: PostMeta[] = [];
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const slug = file.slice(0, -3);
    const raw = await readFile(path.join(BLOG_DIR, file), "utf8");
    const { data } = parseFrontmatter(raw);
    posts.push(buildPostMeta(slug, data));
  }
  posts.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return posts;
}

export async function getPost(slug: string): Promise<{ meta: PostMeta; content: string } | null> {
  if (!SLUG_RE.test(slug)) return null;
  try {
    const raw = await readFile(path.join(BLOG_DIR, `${slug}.md`), "utf8");
    const { data, content } = parseFrontmatter(raw);
    return { meta: buildPostMeta(slug, data), content };
  } catch {
    return null;
  }
}
