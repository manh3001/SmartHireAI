import type { MetadataRoute } from "next";
import prisma from "@/lib/db/prisma";
import { absoluteUrl } from "@/lib/seo/url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const jobs = await prisma.jobDescription.findMany({
    where: { isPublic: true },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/jobs"), changeFrequency: "daily", priority: 0.9 },
  ];
  const jobRoutes: MetadataRoute.Sitemap = jobs.map((j) => ({
    url: absoluteUrl(`/jobs/${j.id}`),
    lastModified: j.createdAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));
  return [...staticRoutes, ...jobRoutes];
}
