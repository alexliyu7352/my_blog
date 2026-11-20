#!/usr/bin/env node
/**
 * Generate agent-readable Markdown for the whole blog:
 *
 * 1. A Markdown twin for every post, next to its HTML page:
 *      /posts/<slug>.md, /posts/zh/<slug>.md, /posts/zh-tw/<slug>.md
 *    Frontmatter is replaced by a small header (title, description,
 *    canonical URL, date); relative image paths are rewritten to the
 *    absolute processed /_astro/ URLs the live site actually serves.
 *
 * 2. /llms.txt — the llms.txt proposal (llmstxt.org): an H1, a summary
 *    blockquote, and sections of described links to the Markdown twins.
 *    English and Simplified Chinese are the main sections; Traditional
 *    Chinese is a mechanical OpenCC conversion of the Simplified text,
 *    so it goes under "Optional".
 *
 * 3. /llms-full.txt — community convention: the full text of every
 *    English and Simplified Chinese post in one file (Traditional
 *    omitted, same reason as above).
 *
 * Runs as the last step of `npm run build`, after astro build, so the
 * zh-tw sources (generated at build start) and dist/_astro exist.
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  mkdirSync,
  statSync,
} from "node:fs";
import path from "node:path";

const SITE = "https://blog.go5.si";
const POSTS_DIR = "src/content/posts";
const DIST = "dist";
const ASTRO_DIR = path.join(DIST, "_astro");

if (!existsSync(ASTRO_DIR)) {
  console.log("[md-versions] dist/_astro not found, skipping");
  process.exit(0);
}

const astroFiles = readdirSync(ASTRO_DIR);

/** Largest processed variant of an image stem, mirroring stable-post-images. */
function findVariant(stem, ext) {
  const pick = cands => {
    let best = null;
    let bestSize = -1;
    for (const f of cands) {
      const s = statSync(path.join(ASTRO_DIR, f)).size;
      if (s > bestSize) {
        bestSize = s;
        best = f;
      }
    }
    return best;
  };
  const exact = astroFiles.filter(
    f => f.startsWith(stem + ".") && f.endsWith(ext)
  );
  if (exact.length) return pick(exact);
  const short = stem.replace(/-(en|zh-tw|zh)$/, "");
  if (short === stem) return null;
  const fallback = astroFiles.filter(
    f => f.startsWith(short + ".") && f.endsWith(ext)
  );
  const families = new Set(
    fallback.map(
      f => f.slice(short.length + 1, f.length - ext.length).split("_")[0]
    )
  );
  if (families.size !== 1) return null;
  return pick(fallback);
}

function fmValue(fm, key) {
  const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  if (!m) return "";
  let v = m[1].trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v.replace(/\\"/g, '"');
}

const LANGS = [
  { dir: "", label: "en", section: "Posts (English)" },
  { dir: "zh", label: "zh", section: "文章（简体中文）" },
  { dir: "zh-tw", label: "zh-tw", section: "文章（繁體中文）" },
];

const posts = [];
let imgWarnings = 0;

for (const { dir, label } of LANGS) {
  const srcDir = dir ? path.join(POSTS_DIR, dir) : POSTS_DIR;
  if (!existsSync(srcDir)) continue;
  for (const file of readdirSync(srcDir).filter(f => f.endsWith(".md"))) {
    const slug = path.basename(file, ".md");
    const raw = readFileSync(path.join(srcDir, file), "utf8");
    const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!m) continue;
    const [, fm, bodyRaw] = m;
    if (/^draft:\s*true$/m.test(fm)) continue;

    const title = fmValue(fm, "title");
    const description = fmValue(fm, "description");
    const pub = fmValue(fm, "pubDatetime").slice(0, 10);
    const urlPath = `/posts/${dir ? dir + "/" : ""}${slug}/`;
    const canonical = SITE + urlPath;
    const mdUrl = SITE + urlPath.replace(/\/$/, ".md");

    let body = bodyRaw.trim();
    // Many posts repeat the title as a plain first line; the header
    // below already carries it as the H1.
    const firstLine = body.split("\n", 1)[0].trim();
    if (firstLine === title) {
      body = body.slice(body.indexOf("\n") + 1).trim();
    }
    // Rewrite relative image refs to absolute live URLs. Sources use
    // both "./x.png" and bare "x.png"; both are relative to the post
    // folder and break as-is in a .md served from the post URL.
    const toAbsolute = ref => {
      const ext = ref.toLowerCase().endsWith(".svg") ? ".svg" : ".jpg";
      const stem = path.basename(ref, path.extname(ref));
      const variant = findVariant(stem, ext);
      return variant ? `${SITE}/_astro/${variant}` : null;
    };
    body = body.replace(
      /!\[([^\]]*)\]\((?!https?:\/\/|data:|\/)(?:\.\/)?([^)\s]+)\)/g,
      (whole, alt, ref) => {
        const abs = toAbsolute(ref);
        if (!abs) {
          imgWarnings++;
          return whole;
        }
        return `![${alt}](${abs})`;
      }
    );
    // The cover (frontmatter ogImage) is rendered as the hero on the
    // HTML page but usually does not appear in the body — without this
    // the .md twin loses the post's main image entirely.
    const ogRef = fmValue(fm, "ogImage");
    const ogStem = ogRef
      ? path.basename(ogRef, path.extname(ogRef))
      : "";
    if (ogRef && !body.includes(ogStem + ".")) {
      let coverUrl = null;
      if (/^https?:\/\//.test(ogRef)) coverUrl = ogRef;
      else if (ogRef.startsWith("/")) coverUrl = SITE + ogRef;
      else coverUrl = toAbsolute(ogRef.replace(/^\.\//, ""));
      if (coverUrl) body = `![${title}](${coverUrl})\n\n` + body;
      else imgWarnings++;
    }
    // Make root-relative links absolute.
    body = body.replace(/\]\((\/[^)\s]+)\)/g, `](${SITE}$1)`);

    const header = [
      `# ${title}`,
      "",
      `> ${description}`,
      "",
      `- Original: ${canonical}`,
      `- Published: ${pub}`,
      `- Author: AI Ferryman Alex (AI摆渡人 Alex)`,
      `- License: CC BY-NC-SA 4.0`,
      "",
      "---",
      "",
    ].join("\n");

    const md = header + body + "\n";
    const outPath = path.join(
      DIST,
      urlPath.replace(/^\//, "").replace(/\/$/, ".md")
    );
    mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileSync(outPath, md, "utf8");
    posts.push({ label, title, description, pub, canonical, mdUrl, md });
  }
}

const byLang = l =>
  posts
    .filter(p => p.label === l)
    .sort((a, b) => (a.pub < b.pub ? 1 : -1));

const desc = p =>
  p.description.length > 220
    ? p.description.slice(0, 217).trimEnd() + "…"
    : p.description;

const linkLine = p => `- [${p.title}](${p.mdUrl}): ${desc(p)}`;

const llms = [
  "# AI Ferryman Alex — blog.go5.si",
  "",
  "> Long-form posts by AI Ferryman Alex (AI摆渡人 Alex), a full-stack engineer with 24+ years of experience, now working through AI in the open: hands-on teardowns of open-source AI tools, paper breakdowns, and field notes on agents, RAG, and AI security. Every post is published here first, in English and Simplified Chinese (Traditional Chinese versions are mechanical OpenCC conversions).",
  "",
  "Each link below points to the Markdown version of the post, served at the post's own URL with `.md` in place of the trailing slash (e.g. /posts/zh/leann-vector-index.md). The HTML version is the same URL without `.md`. Full text of all English and Simplified Chinese posts in one file: https://blog.go5.si/llms-full.txt — License: CC BY-NC-SA 4.0; please attribute and link back when quoting.",
  "",
  "## Posts (English)",
  "",
  ...byLang("en").map(linkLine),
  "",
  "## 文章（简体中文）",
  "",
  ...byLang("zh").map(linkLine),
  "",
  "## Optional",
  "",
  "Traditional Chinese versions (mechanical OpenCC conversions of the Simplified posts above; same `.md` URL pattern under /posts/zh-tw/):",
  "",
  ...byLang("zh-tw").map(linkLine),
  "",
].join("\n");
writeFileSync(path.join(DIST, "llms.txt"), llms, "utf8");

const full = [
  "# AI Ferryman Alex — full text (English + 简体中文)",
  "",
  `> All posts from ${SITE}, concatenated. Markdown twins per post: replace the trailing slash of any post URL with .md. License: CC BY-NC-SA 4.0.`,
  "",
  ...byLang("en").flatMap(p => [p.md, "", "---", ""]),
  ...byLang("zh").flatMap(p => [p.md, "", "---", ""]),
].join("\n");
writeFileSync(path.join(DIST, "llms-full.txt"), full, "utf8");

console.log(
  `[md-versions] wrote ${posts.length} post .md files, llms.txt (${(llms.length / 1024).toFixed(1)} KB), llms-full.txt (${(full.length / 1048576).toFixed(2)} MB)` +
    (imgWarnings ? `, ${imgWarnings} image refs unresolved` : "")
);
