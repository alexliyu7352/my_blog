/**
 * Dual-format images, post-build step.
 *
 * The image pipeline emits JPEG (see src/image-service.ts) because
 * importers and link-preview scrapers (Medium above all) silently drop
 * WebP. Browsers, however, all support WebP and shouldn't pay the JPEG
 * size cost. So after `astro build`:
 *
 *   1. For every JPEG referenced by an <img> in the built HTML, generate
 *      a WebP twin next to it in dist/_astro/.
 *   2. Wrap the <img> in a <picture> whose <source type="image/webp">
 *      points at the twin. Browsers pick the WebP; scrapers and feed
 *      readers only read the <img>, so they keep getting the JPEG.
 *
 * RSS feeds (dist XML) are intentionally untouched: plain JPEG <img>
 * is what feed readers handle best. og:image stays a single JPEG URL.
 */
import { readdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const DIST = path.resolve("dist");
const WEBP_QUALITY = 82;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.name.endsWith(".html")) yield full;
  }
}

const isLocalJpeg = url => url.startsWith("/_astro/") && /\.jpe?g$/.test(url);
const toWebp = url => url.replace(/\.jpe?g$/, ".webp");

function mapSrcset(srcset, mapUrl) {
  return srcset
    .split(",")
    .map(entry => {
      const parts = entry.trim().split(/\s+/);
      parts[0] = mapUrl(parts[0]);
      return parts.join(" ");
    })
    .join(", ");
}

const needed = new Set(); // absolute jpg paths to convert
let wrapped = 0;

async function processFile(file) {
  const html = await readFile(file, "utf8");
  const out = html.replace(/<img\b[^>]*>/g, tag => {
    const srcMatch = tag.match(/\bsrc="([^"]+)"/);
    const srcsetMatch = tag.match(/\bsrcset="([^"]+)"/);
    const src = srcMatch?.[1];
    const srcset = srcsetMatch?.[1];
    const hasJpeg =
      (src && isLocalJpeg(src)) ||
      (srcset && srcset.split(",").some(e => isLocalJpeg(e.trim().split(/\s+/)[0])));
    if (!hasJpeg) return tag;
    for (const url of [src, ...(srcset ? srcset.split(",").map(e => e.trim().split(/\s+/)[0]) : [])]) {
      if (url && isLocalJpeg(url)) needed.add(path.join(DIST, url));
    }
    const webpSrcset = srcset
      ? mapSrcset(srcset, u => (isLocalJpeg(u) ? toWebp(u) : u))
      : toWebp(src);
    wrapped++;
    return `<picture><source srcset="${webpSrcset}" type="image/webp">${tag}</picture>`;
  });
  if (out !== html) await writeFile(file, out);
}

const files = [];
for await (const f of walk(DIST)) files.push(f);
for (const f of files) await processFile(f);

let converted = 0;
for (const jpg of needed) {
  const webp = jpg.replace(/\.jpe?g$/, ".webp");
  try {
    await access(webp);
  } catch {
    await sharp(jpg).webp({ quality: WEBP_QUALITY }).toFile(webp);
    converted++;
  }
}

console.log(
  `[dual-format] wrapped ${wrapped} <img> tags, generated ${converted} WebP twins (${needed.size} referenced JPEGs, ${files.length} HTML files)`
);
