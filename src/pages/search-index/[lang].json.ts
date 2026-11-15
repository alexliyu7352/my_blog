import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";
import { getPostUrl } from "@/utils/getPostPaths";

// Static per-language search indexes for the custom search page.
// Plain-substring matching is used client-side because Pagefind's CJK
// word segmentation misses compound words (e.g. searching 复盘 did not
// find the post whose title contains 复盘). See Pagefind issue #987.
export const getStaticPaths = (async () => {
  return [
    { params: { lang: "en" } },
    { params: { lang: "zh" } },
    { params: { lang: "zh-tw" } },
  ];
}) satisfies GetStaticPaths;

function toPlainText(md: string): string {
  return md
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images: keep alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links: keep link text
    .replace(/```[^\n]*\n?/g, " ") // code fences: keep the code itself
    .replace(/<[^>]+>/g, " ") // html tags
    .replace(/^#{1,6}\s+/gm, "") // heading markers
    .replace(/[*_~`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getHeadings(md: string): string[] {
  const headings: string[] = [];
  for (const match of md.matchAll(/^#{2,3}\s+(.+)$/gm)) {
    headings.push(match[1].replace(/[*_~`]/g, "").trim());
  }
  return headings;
}

export const GET: APIRoute = async ({ params }) => {
  const lang = params.lang ?? "en";
  const posts = await getCollection(
    "posts",
    ({ data }) => !data.draft && data.lang === lang
  );

  const items = posts
    .map(post => ({
      title: post.data.title,
      desc: post.data.description,
      tags: post.data.tags,
      url: getPostUrl(post.id, post.filePath),
      date: post.data.pubDatetime.toISOString().slice(0, 10),
      headings: getHeadings(post.body ?? ""),
      text: toPlainText(post.body ?? ""),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return new Response(JSON.stringify(items), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
