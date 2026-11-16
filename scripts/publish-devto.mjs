#!/usr/bin/env node
/**
 * Publish English blog posts to dev.to via the Forem API.
 *
 * Replaces the RSS-import flow (which only ever creates drafts that need a
 * manual publish click). This script sends `published: true`, so a push to
 * main goes live on dev.to without human steps.
 *
 * Usage:
 *   node scripts/publish-devto.mjs --dry-run <file.md> [more files...]
 *   node scripts/publish-devto.mjs --changed          # files changed in HEAD~1..HEAD
 *   node scripts/publish-devto.mjs <file.md>          # create or update one post
 *
 * Env:
 *   DEVTO_API_KEY  dev.to API key (Settings -> Extensions). Not needed for --dry-run.
 *
 * Dedup / update strategy (dev.to does NOT dedupe by title or canonical_url):
 *   1. scripts/devto-map.json maps blog slug -> dev.to article id (committed by CI).
 *   2. If a slug has no map entry, we first look it up in GET /api/articles/me/all
 *      and match on canonical_url. This adopts articles that already exist
 *      (e.g. an RSS-imported draft) and publishes/updates them in place
 *      instead of creating a duplicate.
 *   3. Only when neither finds anything do we POST a new article.
 *
 * Content transforms (Astro frontmatter != dev.to frontmatter, so the payload
 * is built as JSON and the body is sent without frontmatter):
 *   - tags: lowercased, non-alphanumerics stripped, max 4 (dev.to limit)
 *   - ogImage / body images: relative ./file paths are rewritten to stable
 *     URLs on the blog itself, https://blog.go5.si/post-images/<slug>/<stem>.jpg,
 *     because the dev.to API has no image upload endpoint and only accepts
 *     absolute URLs. (scripts/stable-post-images.mjs creates those stable
 *     copies at blog build time. raw.githubusercontent.com was used before
 *     and is blocked in mainland China, so it was retired.)
 *   - canonical_url: https://blog.go5.si/posts/<slug>/
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const REPO = "alexliyu7352/my_blog";
const POSTS_DIR = "src/content/posts";
const MAP_FILE = "scripts/devto-map.json";
const SITE = "https://blog.go5.si";
const API = "https://dev.to/api/articles";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const changed = args.includes("--changed");
let files = args.filter(a => !a.startsWith("--"));

// Backfill mode: a file argument of ALL.md expands to every slug recorded
// in devto-map.json (used once to re-publish all adopted articles, e.g. to
// swap image URLs). Triggered via workflow_dispatch with slug = ALL.
if (files.some(f => path.basename(f) === "ALL.md")) {
  const mapOnDisk = existsSync(MAP_FILE)
    ? JSON.parse(readFileSync(MAP_FILE, "utf8"))
    : {};
  files = Object.keys(mapOnDisk).map(slug => `${POSTS_DIR}/${slug}.md`);
  console.log(`ALL mode: ${files.length} mapped posts`);
}

if (changed) {
  const out = execFileSync(
    "git",
    ["diff", "--name-only", "--diff-filter=AM", "HEAD~1", "HEAD", "--", `${POSTS_DIR}/*.md`],
    { encoding: "utf8" }
  );
  files = out.split("\n").map(s => s.trim()).filter(Boolean);
}

if (!files.length) {
  console.log("No post files to publish.");
  process.exit(0);
}

const apiKey = process.env.DEVTO_API_KEY;
if (!dryRun && !apiKey) {
  console.error("DEVTO_API_KEY is not set.");
  process.exit(1);
}

/** Minimal parser for this blog's frontmatter subset (scalars + inline arrays). */
function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { fm: {}, body: raw };
  const fm = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z]+):\s*(.*)$/);
    if (!kv) continue;
    let [, key, val] = kv;
    val = val.trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      fm[key] = val.slice(1, -1).split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    } else {
      fm[key] = val.replace(/^["']|["']$/g, "");
    }
  }
  return { fm, body: raw.slice(m[0].length) };
}

const sanitizeTag = t => t.toLowerCase().replace(/[^a-z0-9]/g, "");
const stableUrl = (slug, file) => {
  const ext = file.toLowerCase().endsWith(".svg") ? ".svg" : ".jpg";
  const stem = path.basename(file, path.extname(file));
  return `${SITE}/post-images/${slug}/${stem}${ext}`;
};

function buildPayload(file) {
  const raw = readFileSync(file, "utf8");
  const { fm, body } = parseFrontmatter(raw);
  const slug = path.basename(file, ".md");
  const tags = [...new Set((fm.tags || []).map(sanitizeTag).filter(Boolean))].slice(0, 4);
  const rewritten = body.replace(
    /!\[([^\]]*)\]\(\.\/([^)\s]+)\)/g,
    (_, alt, img) => `![${alt}](${stableUrl(slug, img)})`
  );
  const article = {
    title: fm.title,
    published: true,
    body_markdown: rewritten.trim(),
    tags,
    description: fm.description || "",
    canonical_url: `${SITE}/posts/${slug}/`,
  };
  if (fm.ogImage && fm.ogImage.startsWith("./")) {
    article.main_image = stableUrl(slug, fm.ogImage.slice(2));
  }
  return { slug, fm, article };
}

async function api(pathSuffix, options = {}) {
  const res = await fetch(`${API}${pathSuffix}`, {
    ...options,
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/vnd.forem.api-v1+json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${options.method || "GET"} ${pathSuffix} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const loadMap = () => (existsSync(MAP_FILE) ? JSON.parse(readFileSync(MAP_FILE, "utf8")) : {});
const saveMap = map => writeFileSync(MAP_FILE, JSON.stringify(map, null, 2) + "\n");

let myArticlesCache = null;
async function findExisting(canonicalUrl) {
  if (!myArticlesCache) {
    myArticlesCache = await api("/me/all?per_page=1000");
  }
  return myArticlesCache.find(a => a.canonical_url === canonicalUrl) || null;
}

const map = loadMap();
let mapDirty = false;

for (const file of files) {
  // English posts only: direct children of src/content/posts (zh/ and zh-tw/ are subdirs)
  if (path.dirname(file) !== POSTS_DIR) {
    console.log(`SKIP (not a top-level English post): ${file}`);
    continue;
  }
  const { slug, fm, article } = buildPayload(file);
  if (fm.draft === "true") {
    console.log(`SKIP (draft): ${slug}`);
    continue;
  }
  if (dryRun) {
    const preview = { ...article, body_markdown: article.body_markdown.slice(0, 300) + "\n...[truncated]" };
    console.log(`DRY-RUN ${slug}:\n${JSON.stringify(preview, null, 2)}\n`);
    continue;
  }

  let id = map[slug]?.id;
  if (!id) {
    const existing = await findExisting(article.canonical_url);
    if (existing) {
      id = existing.id;
      console.log(`ADOPT existing dev.to article ${id} for ${slug} (was published=${existing.published})`);
    }
  }

  const result = id
    ? await api(`/${id}`, { method: "PUT", body: JSON.stringify({ article }) })
    : await api("", { method: "POST", body: JSON.stringify({ article }) });

  map[slug] = { id: result.id, url: result.url };
  mapDirty = true;
  console.log(`${id ? "UPDATED" : "PUBLISHED"} ${slug} -> ${result.url}`);
}

if (mapDirty) saveMap(map);
