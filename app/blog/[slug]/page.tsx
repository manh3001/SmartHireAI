import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getAllPosts, getPost } from "@/lib/blog/posts";
import { buildArticleJsonLd } from "@/lib/blog/article-jsonld";
import { absoluteUrl } from "@/lib/seo/url";

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};
  return {
    title: `${post.meta.title} | SmartHire`,
    description: post.meta.description,
    alternates: { canonical: `/blog/${slug}` },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();
  const { meta, content } = post;
  const byline = [meta.author, meta.date ? new Date(meta.date).toLocaleDateString("vi-VN") : ""].filter(Boolean).join(" · ");

  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildArticleJsonLd(meta, absoluteUrl(`/blog/${slug}`))) }}
        />
        {meta.tag && <span className="text-xs font-medium text-primary">{meta.tag}</span>}
        <h1 className="mt-1 text-3xl font-bold text-foreground">{meta.title}</h1>
        {byline && <p className="mt-2 text-sm text-muted-foreground">{byline}</p>}
        <div className="mt-6 text-foreground [&_a]:text-primary [&_a]:underline [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-4 [&_h3]:font-semibold [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-6">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </main>
      <Footer />
    </div>
  );
}
