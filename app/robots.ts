import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard", "/applications", "/admin", "/api", "/settings",
        "/messages", "/notifications", "/interviews", "/cv", "/login", "/register",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
