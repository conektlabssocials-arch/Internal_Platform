import { API_BASE_URL } from '../api/apiClient';

const driveFileIdPatterns = [
  /drive\.google\.com\/uc\?(?:.*&)?id=([^&]+)/,
  /drive\.google\.com\/file\/d\/([^/?]+)/,
  /drive\.google\.com\/open\?(?:.*&)?id=([^&]+)/,
  /drive\.usercontent\.google\.com\/download\?(?:.*&)?id=([^&]+)/,
];

export const extractGoogleDriveFileId = (url?: string) => {
  if (!url) return undefined;

  for (const pattern of driveFileIdPatterns) {
    const match = url.match(pattern);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }

  return undefined;
};

export const getDisplayImageUrl = (url?: string, size = 1600) => {
  return getDisplayImageUrls(url, size)[0];
};

export const getDisplayImageUrls = (url?: string, size = 1600) => {
  if (!url) return [];

  const fileId = extractGoogleDriveFileId(url);
  if (!fileId) return [url];

  const encodedFileId = encodeURIComponent(fileId);
  // Render Drive photos ONLY through our backend proxy. We deliberately do not
  // fall back to a direct `lh3.googleusercontent.com`/`uc?id=` URL from the
  // browser: those are anonymous endpoints rate-limited per client IP, so a
  // grid/gallery that loads many images at once gets `429 Too Many Requests`
  // for some of them ("some images show, some don't"). The proxy fetches from
  // Google server-side (authenticated API-key quota, not per-IP), validates the
  // response is really an image, and caches it, so the browser only ever hits
  // one stable URL that returns either real bytes or a clean error.
  return [`${API_BASE_URL}/public/drive-images/${encodedFileId}?size=${size}`];
};
