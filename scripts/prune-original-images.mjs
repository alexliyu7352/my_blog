#!/usr/bin/env node
/**
 * Delete the original-format copies Astro emits into dist/_astro.
 *
 * For every source image, the pipeline emits resized JPEG variants
 * (plus WebP twins) — and also the source file itself, untouched, at
 * full size under a bare hashed name (cover-foo.<hash>.png, ~4 MB a
 * piece for AI-generated covers). Measured 2026-11-20: ~100 MB of the
 * ~320 MB deploy was these originals, and nothing in the built site
 * references them (pages, feeds and meta all use the variants).
 *
 * A file is pruned only when BOTH hold:
 * - its name is a bare original: <source-stem>.<hash>.<source-ext>,
 *   where <source-stem>.<source-ext> is a real image next to a post;
 * - no built output file outside _astro mentions its name (HTML,
 *   feeds, .md twins, search index, JS/CSS — everything text-like).
 * Referenced originals (e.g. SVGs, which are served as-is) stay.
 *
 * Runs last in `npm run build`: the earlier post-build steps
 * (stable post-images, Markdown twins) pick their files from _astro
 * before anything is removed.
 */
import {
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  existsSync,
} from "node:fs";
import path from "node:path";

const DIST = "dist";
const ASTRO_DIR = path.join(DIST, "_astro");
const POSTS_DIR = "src/content/posts";

if (!existsSync(ASTRO_DIR)) {
  console.log("[prune] dist/_astro not found, skipping");
  process.exit(0);
}

// Source image basenames (stem + ext), from every post folder.
const sourceNames = new Set();
for (const sub of ["", "zh", "zh-tw"]) {
  const dir = sub ? path.join(POSTS_DIR, sub) : POSTS_DIR;
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) {
    if (/\.(png|webp|jpg|jpeg|gif|avif|svg)$/i.test(f)) sourceNames.add(f);
  }
}

// Bare originals: <stem>.<8-char hash>.<ext> naming a source image.
const candidates = [];
for (const name of readdirSync(ASTRO_DIR)) {
  const m = name.match(/^(.+)\.([A-Za-z0-9_-]{8})\.([a-z0-9]+)$/i);
  if (!m) continue;
  const [, stem, , ext] = m;
  if (sourceNames.has(`${stem}.${ext.toLowerCase()}`)) candidates.push(name);
}

// Reference corpus: every text-like built file outside _astro.
const SKIP_EXT = new Set([
  ".png", ".webp", ".jpg", ".jpeg", ".gif", ".avif", ".svg",
  ".woff", ".woff2", ".ttf", ".otf", ".ico", ".mp4", ".webm",
]);
let corpus = "";
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (p !== ASTRO_DIR) walk(p);
    } else if (
      !SKIP_EXT.has(path.extname(e.name).toLowerCase()) &&
      statSync(p).size < 20 * 1048576
    ) {
      corpus += readFileSync(p, "utf8", "ignore") + "\n";
    }
  }
})(DIST);

let removed = 0;
let saved = 0;
let kept = 0;
for (const name of candidates) {
  if (corpus.includes(name)) {
    kept++;
    continue;
  }
  const p = path.join(ASTRO_DIR, name);
  saved += statSync(p).size;
  unlinkSync(p);
  removed++;
}

console.log(
  `[prune] removed ${removed} unreferenced originals (${(saved / 1048576).toFixed(1)} MB), kept ${kept} referenced`
);
