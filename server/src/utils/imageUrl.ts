// Inventory photos are often full-resolution Cloudinary PNG screenshots (several
// MB each). Embedding many of them at full size produces a V2 proposal PDF large
// enough to exceed Cloudinary's max raw-upload size, so the upload fails. For
// Cloudinary image delivery URLs we insert an on-the-fly transformation so the
// PDF renderer fetches a bounded, compressed image (~900px, auto quality/format)
// instead of the original. Non-Cloudinary URLs are returned unchanged.
export const optimizeCloudinaryImageUrl = (url: string) => {
  const match = url.match(/^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/);
  if (!match) return url;
  const [, prefix, rest] = match;
  // Leave it alone if a transformation is already present (first path segment
  // looks like `c_fill,w_500` / `w_900` — a Cloudinary param token `xx_...`).
  if (/^[a-z]+_[^/]*\//i.test(rest)) return url;
  return `${prefix}c_limit,w_900,q_auto,f_auto/${rest}`;
};
