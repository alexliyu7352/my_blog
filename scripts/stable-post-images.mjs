#!/usr/bin/env node
/**
 * Give every English post's images a stable, unhashed URL on the blog
 * itself: https://blog.go5.si/post-images/<slug>/<image-stem>.jpg
 *
 * Why: syndication targets (dev.to, Hashnode, ...) need absolute image URLs
 * that never change. The built blog serves images under hashed /_astro/
 * names, and raw.githubusercontent.com (the previous fallback) is blocked
 * in mainland China. So after `astro build`, this step copies the largest
 * processed variant of each image an English post references (frontmatter
 * ogImage + markdown body images) to dist/post-images/<slug>/ under the
 * original file stem. The blog's own pages keep using the hashed pipeline
 * files; these copies exist only as stable targets for external embeds.
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

const postFiles = readdirSync(POSTS_DIR).filter(f => f.endsWith(".md"));
let copied = 0;
let totalBytes = 0;
const warnings = [];

for (const postFile of postFiles) {
  const slug = path.basename(postFile, ".md");
  const raw = readFileSync(path.join(POSTS_DIR, postFile), "utf8");
  const refs = new Set();
  const og = raw.match(/^ogImage:\s*["']?\.\/([^"'\s]+)["']?\s*$/m);
  if (og) refs.add(og[1]);
  for (const m of raw.matchAll(/!\[[^\]]*\]\(\.\/([^)\s]+)\)/g)) refs.add(m[1]);
  if (!refs.size) continue;

  for (const ref of refs) {
    const ext = ref.toLowerCase().endsWith(".svg") ? ".svg" : ".jpg";
    const stem = path.basename(ref, path.extname(ref));
    const variant = findVariant(stem, ext);
    if (!variant) {
      warnings.push(`${slug}: no processed variant for ${ref}`);
      continue;
    }
    const destDir = path.join(OUT_DIR, slug);
    mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, stem + ext);
    copyFileSync(path.join(ASTRO_DIR, variant), dest);
    copied++;
    totalBytes += statSync(dest).size;
  }
}

console.log(
  `[stable-images] copied ${copied} images (${(totalBytes / 1048576).toFixed(1)} MB) to dist/post-images/`
);
for (const w of warnings) console.log(`[stable-images] WARN ${w}`);
