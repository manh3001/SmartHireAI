import type { MetadataRoute } from "next";
import prisma from "@/lib/db/prisma";
import { absoluteUrl } from "@/lib/seo/url";
import { getAllPosts } from "@/lib/blog/posts";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const jobs = await prisma.jobDescription.findMany({
    where: { isPublic: true },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  const posts = await getAllPosts();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/jobs"), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/salaries"), changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl("/blog"), changeFrequency: "weekly", priority: 0.6 },
  ];
  const jobRoutes: MetadataRoute.Sitemap = jobs.map((j) => ({
    url: absoluteUrl(`/jobs/${j.id}`),
    lastModified: j.createdAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));
  const blogRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
    url: absoluteUrl(`/blog/${p.slug}`),
    lastModified: p.date ? new Date(p.date) : undefined,
    changeFrequency: "monthly",
    priority: 0.6,
  }));
  return [...staticRoutes, ...jobRoutes, ...blogRoutes];
}
