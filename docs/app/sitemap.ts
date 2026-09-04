import type { MetadataRoute } from "next";
import { source } from "@/app/source";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = source.getPages().map((page) => ({
    url: absoluteUrl(page.url),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [
    {
      url: absoluteUrl("/"),
      changeFrequency: "weekly" as const,
      priority: 1,
    },
    ...pages,
  ];
}
