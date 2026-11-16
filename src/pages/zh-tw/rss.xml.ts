import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { getSortedPosts } from "@/utils/getSortedPosts";
import { getPostUrl } from "@/utils/getPostPaths";
import { postFeedContent, feedCoverCustomData } from "@/utils/feedContent";
import config from "@/config";

export async function GET() {
  const posts = await getCollection("posts");
  const sortedPosts = getSortedPosts(posts).filter(
    ({ data }) => data.lang === "zh-tw"
  );

  return rss({
    title: "AI擺渡人 Alex",
    description: "AI擺渡人 Alex 的長文：AI 工程實踐、開源動態、基礎設施與安全。",
    site: config.site.url,
    xmlns: { media: "http://search.yahoo.com/mrss/" },
    items: await Promise.all(
      sortedPosts.map(async ({ data, id, filePath }) => ({
      link: getPostUrl(id, filePath, "zh-tw"),
      title: data.title,
      description: data.description,
      pubDate: new Date(data.modDatetime ?? data.pubDatetime),
      customData: await feedCoverCustomData(data.ogImage),
        content: await postFeedContent(
          sortedPosts.find(p => p.id === id)!
        ),
      }))
    ),
  });
}
