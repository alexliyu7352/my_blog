import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { render, type CollectionEntry } from "astro:content";
import config from "@/config";

const SITE = config.site.url.replace(/\/$/, "");

let containerPromise: Promise<AstroContainer> | null = null;

/**
 * Feed readers are not on our origin, so root-relative URLs in the rendered
 * HTML (Astro image pipeline output, internal links) would resolve against
 * the reader's domain and break. Rewrite them to absolute URLs.
 */
function absolutizeUrls(html: string): string {
  return html
    .replace(/(src|href)="\/(?!\/)/g, `$1="${SITE}/`)
    .replace(/srcset="([^"]*)"/g, (_m, value: string) =>
      `srcset="${value.replace(/(^|,\s*)\/(?!\/)/g, `$1${SITE}/`)}"`
    );
}

export async function postFeedContent(
  post: CollectionEntry<"posts">
): Promise<string> {
  containerPromise ??= AstroContainer.create();
  const container = await containerPromise;
  const { Content } = await render(post);
  return absolutizeUrls(await container.renderToString(Content));
}

const MIME_BY_EXT: Record<string, string> = {
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  avif: "image/avif",
  svg: "image/svg+xml",
};

/**
 * RSS has no standard cover field; feed readers and importers look for
 * media:thumbnail / media:content (Media RSS). Emit both for the post's
 * ogImage so subscribers and importers can pick up the cover.
 */
export function feedCoverCustomData(
  ogImage: CollectionEntry<"posts">["data"]["ogImage"]
): string | undefined {
  if (!ogImage) return undefined;
  const raw = typeof ogImage === "string" ? ogImage : ogImage.src;
  if (!raw) return undefined;
  const url = raw.startsWith("http")
    ? raw
    : `${SITE}/${raw.replace(/^\.?\//, "")}`;
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  const type = MIME_BY_EXT[ext];
  const typeAttr = type ? ` type="${type}"` : "";
  return `<media:thumbnail url="${url}"/><media:content url="${url}" medium="image"${typeAttr}/>`;
}
