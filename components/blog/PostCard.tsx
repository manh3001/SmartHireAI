import Link from "next/link";
import type { PostMeta } from "@/lib/blog/post";

export default function PostCard({ post }: { post: PostMeta }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/40"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {post.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.cover} alt={post.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-muted">
            <span className="px-4 text-center text-sm font-medium text-muted-foreground">{post.tag || "Cẩm nang"}</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        {post.tag && <span className="text-xs font-medium text-primary">{post.tag}</span>}
        <h2 className="mt-1 font-semibold text-foreground">{post.title}</h2>
        {post.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.description}</p>}
        {post.date && <p className="mt-2 text-xs text-muted-foreground">{new Date(post.date).toLocaleDateString("vi-VN")}</p>}
      </div>
    </Link>
  );
}
