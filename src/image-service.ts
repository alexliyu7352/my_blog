/**
 * Custom image service: wrap Astro's built-in sharp service, but emit JPEG
 * instead of WebP/AVIF.
 *
 * Why: Medium's importer silently drops WebP images (documented repro:
 * a page whose body <img> / og:image point at .webp imports with no images
 * at all), and several link-preview scrapers ignore WebP og:images too.
 * JPEG is the universally accepted format for importers and previews, so
 * it is the pipeline's canonical output. Browsers don't pay for it:
 * scripts/dual-format-images.mjs runs after the build, generates a WebP
 * twin of every emitted JPEG, and wraps page <img> tags in <picture>
 * with the WebP as the preferred <source> — browsers load the WebP,
 * scrapers and feed readers keep getting the JPEG.
 *
 * How: the format must be rewritten in validateOptions — it runs before
 * Astro defaults the format and before output filenames are generated.
 * (Overriding only `transform` would encode JPEG bytes into .webp-named
 * files.) PNG / GIF / SVG requests pass through untouched, so explicit
 * format choices in components keep working. Sources with an alpha
 * channel are flattened onto white before JPEG encoding so transparent
 * pixels don't turn black.
 */
import sharpImageService from "astro/assets/services/sharp";
import type { ImageService } from "astro";

const base = sharpImageService;

function forceJpeg<T extends object>(options: T): T {
  const o = options as {
    format?: string;
    quality?: unknown;
    src?: unknown;
  };
  // At validateOptions time the format is often still unset — the base
  // service would default it to WebP right after us. Treat "unset" as
  // WebP too (except SVG sources, which must stay SVG).
  let wantsJpeg = o.format === "webp" || o.format === "avif";
  if (!o.format) {
    const src = o.src as { format?: string } | string | undefined;
    const srcFormat =
      typeof src === "string"
        ? src.split("?")[0].split(".").pop()?.toLowerCase()
        : src?.format;
    wantsJpeg = srcFormat !== "svg";
  }
  if (wantsJpeg) {
    return {
      ...options,
      format: "jpg",
      quality: typeof o.quality === "number" ? o.quality : 88,
    } as T;
  }
  return options;
}

const service: ImageService = {
  ...base,
  validateOptions(options, imageConfig, logger) {
    const forced = forceJpeg(options);
    return base.validateOptions
      ? base.validateOptions(forced, imageConfig, logger)
      : forced;
  },
  async transform(inputBuffer, options, imageConfig, logger) {
    let buffer = inputBuffer;
    if ((options as { format?: string }).format === "jpg") {
      const sharp = (await import("sharp")).default;
      const meta = await sharp(inputBuffer).metadata();
      if (meta.hasAlpha) {
        buffer = await sharp(inputBuffer)
          .flatten({ background: "#ffffff" })
          .png()
          .toBuffer();
      }
    }
    return base.transform(buffer, options, imageConfig, logger);
  },
};

export default service;
