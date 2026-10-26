# Alex Lee — blog.go5.si

Personal blog of Alex Lee (@alexlee20122022). Astro static site based on AstroPaper v6, deployed to Cloudflare Pages.

- English posts at `/posts/<slug>/`
- Simplified Chinese at `/posts/zh/<slug>/` (hand-written source of truth)
- Traditional Chinese at `/posts/zh-tw/<slug>/` — **auto-generated** from the Simplified version with OpenCC (s2t) on every build via `scripts/gen-zh-tw.mjs`; never edit `src/content/posts/zh-tw/` by hand (it is git-ignored and regenerated)

Customizations on top of AstroPaper: sticky sidebar TOC with scroll-spy, per-post language dropdown + hreflang (en / zh-Hans / zh-Hant), Chinese typography (Noto Sans SC body + Noto Serif SC headings), cover images on listing cards, wider layout.

## Develop

```bash
npm install
npm run dev     # local preview
npm run build   # generates zh-tw, type-checks, builds, indexes search (Pagefind)
```

Build output: `dist/`. Cloudflare Pages: build command `npm run build`, output `dist`, `NODE_VERSION=22`.
