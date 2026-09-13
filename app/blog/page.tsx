import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { EmptyState } from "@/components/ui/empty-state";
import PostCard from "@/components/blog/PostCard";
import { getAllPosts } from "@/lib/blog/posts";
import { allTags, filterByTag } from "@/lib/blog/filter";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Cẩm nang nghề nghiệp | SmartHire",
  description: "Bài viết, mẹo viết CV, phỏng vấn và phát triển sự nghiệp trên SmartHire.",
  alternates: { canonical: "/blog" },
};

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag } = await searchParams;
  const posts = await getAllPosts();
  const tags = allTags(posts);
  const shown = filterByTag(posts, tag);

  const chip = "rounded-full border px-3 py-1 text-xs font-medium transition-colors";

  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl flex-1 p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-foreground">Cẩm nang nghề nghiệp</h1>
        <p className="mt-1 text-sm text-muted-foreground">Mẹo viết CV, phỏng vấn và phát triển sự nghiệp.</p>

        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/blog" className={cn(chip, !tag ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
              Tất cả
            </Link>
            {tags.map((t) => (
              <Link
                key={t}
                href={`/blog?tag=${encodeURIComponent(t)}`}
                className={cn(chip, tag === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}
              >
                {t}
              </Link>
            ))}
          </div>
        )}

        {shown.length === 0 ? (
          <div className="mt-8">
            <EmptyState icon={<BookOpen className="h-10 w-10" />} title="Chưa có bài viết" description="Không có bài phù hợp bộ lọc." />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {shown.map((p) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
