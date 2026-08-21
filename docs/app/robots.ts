import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";

/**
 * Note: on a GitHub Pages *project* site this is served from
 * /agent-harness/robots.txt, and crawlers only read robots.txt at the domain
 * root, so it has no effect today. Kept because it is correct the moment the
 * site moves to its own domain, and because the sitemap URL is still valid to
 * submit directly.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
