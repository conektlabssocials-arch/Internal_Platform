// Inventory photos are often full-resolution Cloudinary PNG screenshots (several
// MB each). Embedding many of them at full size — or even just downscaled PNG/
// WebP, which Chrome re-encodes losslessly when building the PDF — produces a V2
// proposal PDF large enough to exceed Cloudinary's max raw-upload size (10 MB on
// the default plan), so the upload fails.
//
// For Cloudinary image delivery URLs we insert an on-the-fly transformation that
// bounds the width and forces a compressed JPEG, so the fetched bytes inline into
// the PDF compactly. Non-Cloudinary URLs are returned unchanged.
const imageMaxWidth = () => {
  const configured = Number(process.env.DOCUMENT_IMAGE_MAX_WIDTH);
  return Number.isFinite(configured) && configured > 0 ? Math.round(configured) : 560;
};

// JPEG quality token for the inlined photos. `q_auto:eco` trades a little
// sharpness for markedly smaller bytes — with up to 80 photo pages, the older
// `q_auto` at w_900 produced PDFs over Cloudinary's 10 MB raw-upload cap (chunked
// upload does NOT raise that cap). Overridable for accounts with a larger limit.
const imageQuality = () => process.env.DOCUMENT_IMAGE_QUALITY || 'auto:eco';

export const optimizeCloudinaryImageUrl = (url: string) => {
  const match = url.match(/^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/);
  if (!match) return url;
  const [, prefix, rest] = match;
  // Leave it alone if a transformation is already present (first path segment
  // looks like `c_fill,w_500` / `w_900` — a Cloudinary param token `xx_...`).
  if (/^[a-z]+_[^/]*\//i.test(rest)) return url;
  return `${prefix}c_limit,w_${imageMaxWidth()},q_${imageQuality()},f_jpg/${rest}`;
};

// True when the URL is a Cloudinary image delivery URL we can transform/inline.
export const isCloudinaryImageUrl = (url: string) =>
  /^https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url);
