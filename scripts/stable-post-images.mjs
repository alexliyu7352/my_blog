#!/usr/bin/env node
/**
 * Give every post's images a stable, unhashed URL on the blog itself:
 *   English: https://blog.go5.si/post-images/<slug>/<image-stem>.jpg
 *   Chinese: https://blog.go5.si/post-images/zh/<slug>/<image-stem>.jpg
 * (Traditional posts share the Chinese images, so no zh-tw tree.)
 *
 * Why: syndication targets (dev.to, Hashnode, ...), the Markdown twins
 * and other off-site copies need absolute image URLs that never change.
 * The built blog serves images under hashed /_astro/ names, and
 * raw.githubusercontent.com (the previous fallback) is blocked in
 * mainland China. So after `astro build`, this step copies the largest
 * processed variant of each image a post references (frontmatter
 * ogImage + markdown body images) to dist/post-images/ under the
 * original file stem. The blog's own pages keep using the hashed
 * pipeline files; these copies exist only as stable targets.
 *
 * Two traps handled here:
 * - Body image refs come in two spellings, "./x.png" and bare "x.png";
 *   missing the bare form silently left those images uncopied (404 at
 *   the stable URL dev.to had already been given).
 * - A cover filename can exist in both languages with different
 *   content (cover-floorplan is the EN and ZH cover under one name).
 *   Picking "the largest variant" across both families once shipped
 *   the Chinese cover at the English stable URL. The ogImage copy is
 *   therefore taken from the post's own built page (its post-cover
 *   hero), which names the exact processed file for that language.
 *
 * Runs as part of `npm run build`, after astro build.
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  copyFileSync,
  mkdirSync,
  statSync,
} from "node:fs";
import path from "node:path";

const POSTS_DIR = "src/content/posts";
const DIST = "dist";
const ASTRO_DIR = path.join(DIST, "_astro");
const OUT_DIR = path.join(DIST, "post-images");

if (!existsSync(ASTRO_DIR)) {
  console.log("[stable-images] dist/_astro not found, skipping");
  process.exit(0);
}

const astroFiles = readdirSync(ASTRO_DIR);

/** Largest processed variant of `stem` with extension `ext`, or null. */
function largestVariant(candidates) {
  let best = null;
  let bestSize = -1;
  for (const f of candidates) {
    const size = statSync(path.join(ASTRO_DIR, f)).size;
    if (size > bestSize) {
      bestSize = size;
      best = f;
    }
  }
  return best;
}

function findVariant(stem, ext) {
  const exact = astroFiles.filter(
    f => f.startsWith(stem + ".") && f.endsWith(ext)
  );
  if (exact.length) return largestVariant(exact);
  // Astro sometimes drops a trailing locale suffix (-en/-zh/-zh-tw) from
  // the processed name when several language versions share one image.
  // Fall back to the shortened stem only when it maps to a single piece
  // of content (one hash family), so we never pick the wrong language's
  // image.
  const short = stem.replace(/-(en|zh-tw|zh)$/, "");
  if (short === stem) return null;
  const fallback = astroFiles.filter(
    f => f.startsWith(short + ".") && f.endsWith(ext)
  );
  const families = new Set(
    fallback.map(f => f.slice(short.length + 1, f.length - ext.length).split("_")[0])
  );
  if (families.size !== 1) return null;
  return largestVariant(fallback);
}

let copied = 0;
let totalBytes = 0;
const warnings = [];

/** Exact processed file a post's built page uses as its cover hero. */
function heroVariant(pagePath) {
  if (!existsSync(pagePath)) return null;
  const html = readFileSync(pagePath, "utf8");
  const tag = html.match(/<img[^>]*id="post-cover"[^>]*>/);
  if (!tag) return null;
  const src = tag[0].match(/src="([^"]+)"/);
  return src ? path.basename(src[1]) : null;
}

function processPosts(srcDir, outPrefix, pagePrefix) {
  if (!existsSync(srcDir)) return;
  for (const postFile of readdirSync(srcDir).filter(f =>
    f.endsWith(".md")
  )) {
    const slug = path.basename(postFile, ".md");
    const raw = readFileSync(path.join(srcDir, postFile), "utf8");
    const og = raw.match(/^ogImage:\s*["']?(?:\.\/)?([^"'\s]+)["']?\s*$/m);
    const ogRef =
      og && !/^https?:\/\//.test(og[1]) && !og[1].startsWith("/")
        ? og[1]
        : null;
    const refs = new Set();
    for (const m of raw.matchAll(/!\[[^\]]*\]\((?:\.\/)?([^)\s]+)\)/g)) {
      if (!/^https?:\/\//.test(m[1])) refs.add(m[1]);
    }
    if (ogRef) refs.delete(ogRef); // handled separately below
    if (!refs.size && !ogRef) continue;

    const destDir = path.join(OUT_DIR, outPrefix, slug);
    const copyVariant = (variant, stem, ext) => {
      if (!existsSync(path.join(ASTRO_DIR, variant))) {
        warnings.push(`${slug}: variant ${variant} not in _astro`);
        return;
      }
      mkdirSync(destDir, { recursive: true });
      const dest = path.join(destDir, stem + ext);
      copyFileSync(path.join(ASTRO_DIR, variant), dest);
      copied++;
      totalBytes += statSync(dest).size;
    };

    if (ogRef) {
      const ext = ogRef.toLowerCase().endsWith(".svg") ? ".svg" : ".jpg";
      const stem = path.basename(ogRef, path.extname(ogRef));
      const hero = heroVariant(
        path.join(DIST, "posts", pagePrefix, slug, "index.html")
      );
      const variant = hero ?? findVariant(stem, ext);
      if (!variant) warnings.push(`${slug}: no variant for og ${ogRef}`);
      else copyVariant(variant, stem, ext);
    }

    for (const ref of refs) {
      const ext = ref.toLowerCase().endsWith(".svg") ? ".svg" : ".jpg";
      const stem = path.basename(ref, path.extname(ref));
      const variant = findVariant(stem, ext);
      if (!variant) {
        warnings.push(`${slug}: no processed variant for ${ref}`);
        continue;
      }
      copyVariant(variant, stem, ext);
    }
  }
}

processPosts(POSTS_DIR, "", "");
processPosts(path.join(POSTS_DIR, "zh"), "zh", "zh");

console.log(
  `[stable-images] copied ${copied} images (${(totalBytes / 1048576).toFixed(1)} MB) to dist/post-images/`
);
for (const w of warnings) console.log(`[stable-images] WARN ${w}`);
