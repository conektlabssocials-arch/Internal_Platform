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
  return [
    // Always render Drive photos through our backend proxy. It authenticates
    // with the API key, validates that the response is really an image (so
    // Drive's HTML interstitials become a clean 404 instead of a fake 200 that
    // never fires `onError`), and serves a single stable, cacheable URL. This
    // avoids the per-IP rate limiting you hit when hot-linking Drive directly.
    `${API_BASE_URL}/public/drive-images/${encodedFileId}?size=${size}`,
    // Last-ditch fallback to Google's CDN if our own server is unreachable.
    `https://lh3.googleusercontent.com/d/${encodedFileId}=w${size}`,
  ];
};
