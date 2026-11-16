import config from "@/config";

/**
 * The display name follows the page's language: Chinese pages use the
 * Chinese name (simplified on zh pages, traditional on zh-tw pages),
 * everything else uses the English name from the site config.
 *
 * Language is read from the URL. Section pages are locale-prefixed
 * (/zh/..., /zh-tw/...); post pages carry the language as a path segment
 * (/posts/zh/<slug>/, /posts/zh-tw/<slug>/). Matching whole segments
 * avoids false hits on slugs that merely contain "zh".
 */
export function siteNameForPath(pathname: string): string {
  if (/(^|\/)zh-tw(\/|$)/.test(pathname)) return "AI擺渡人 Alex";
  if (/(^|\/)zh(\/|$)/.test(pathname)) return "AI摆渡人 Alex";
  return config.site.title;
}
