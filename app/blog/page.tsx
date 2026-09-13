import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { EmptyState } from "@/components/ui/empty-state";
import { getAllPosts } from "@/lib/blog/posts";

export const metadata: Metadata = {
  title: "Cẩm nang nghề nghiệp | SmartHire",
  description: "Bài viết, mẹo viết CV, phỏng vấn và phát triển sự nghiệp trên SmartHire.",
  alternates: { canonical: "/blog" },
};

export default async function BlogPage() {
  const posts = await getAllPosts();
  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl flex-1 p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-foreground">Cẩm nang nghề nghiệp</h1>
        <p className="mt-1 text-sm text-muted-foreground">Mẹo viết CV, phỏng vấn và phát triển sự nghiệp.</p>
        {posts.length === 0 ? (
          <div className="mt-8">
            <EmptyState icon={<BookOpen className="h-10 w-10" />} title="Chưa có bài viết" description="Nội dung cẩm nang sẽ sớm được cập nhật." />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {posts.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
              >
                {p.tag && <span className="text-xs font-medium text-primary">{p.tag}</span>}
                <h2 className="mt-1 font-semibold text-foreground">{p.title}</h2>
                {p.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                {p.date && <p className="mt-2 text-xs text-muted-foreground">{new Date(p.date).toLocaleDateString("vi-VN")}</p>}
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
