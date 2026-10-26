// Generate Traditional Chinese versions of the Simplified Chinese posts
// with OpenCC (character conversion, NOT translation). Runs before every
// build (see package.json "build"). Source of truth stays the Simplified
// files in src/content/posts/zh/ — never edit the generated zh-tw/ files.
import { Converter } from "opencc-js";
import { readdir, readFile, writeFile, mkdir, copyFile, rm } from "node:fs/promises";
import path from "node:path";

const SRC = "src/content/posts/zh";
const DST = "src/content/posts/zh-tw";
const convert = Converter({ from: "cn", to: "t" }); // s2t: Simplified -> Traditional

await rm(DST, { recursive: true, force: true });
await mkdir(DST, { recursive: true });

for (const name of await readdir(SRC)) {
  const src = path.join(SRC, name);
  const dst = path.join(DST, name);
  if (name.endsWith(".md") || name.endsWith(".mdx")) {
    let text = await readFile(src, "utf-8");
    text = convert(text);
    // Conversion leaves ASCII untouched; flip the lang tag only.
    text = text.replace(/^lang: zh$/m, "lang: zh-tw");
    await writeFile(dst, text, "utf-8");
    console.log(`[zh-tw] generated ${name}`);
  } else {
    // Images and other assets are shared as-is (text baked into images is
    // not converted).
    await copyFile(src, dst);
  }
}
