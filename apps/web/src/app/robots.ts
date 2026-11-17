import type { MetadataRoute } from "next";

const BASE_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");

/**
 * Crawler rules for the public site.
 *
 * The admin console, JSON API and per-order ticket status pages are never indexable:
 * the last one embeds an order token in its query string and must stay private.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/", "/tickets/status"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
