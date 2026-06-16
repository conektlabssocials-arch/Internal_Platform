import { google } from 'googleapis';
import { injectable } from 'tsyringe';

export type DriveFolderPhotoResult = {
  photos: string[];
  error?: string;
};

export type DriveImageProxyResult = {
  buffer: Buffer;
  contentType: string;
};

export interface IGoogleDrivePhotoService {
  extractDriveFolderId(url?: unknown): string | undefined;
  getImagesFromDriveFolder(folderUrl: string): Promise<DriveFolderPhotoResult>;
  getImageFile(fileId: string, size?: unknown): Promise<DriveImageProxyResult>;
}

const driveFolderPathPattern = /\/drive\/folders\/([a-zA-Z0-9_-]+)/;
const driveFileIdPattern = /^[a-zA-Z0-9_-]{10,}$/;
const defaultImageSize = 1600;
const maxImageSize = 2400;

// Cache fetched image bytes so a grid/gallery that requests the same photos
// repeatedly (or many clients viewing the same plan) hits Google at most once
// per file+size. `inFlight` collapses concurrent requests for the same image
// into a single upstream fetch so a burst of grid loads can't fan out into many
// duplicate Drive requests (which is what triggers Google's 429s).
const imageCacheTtlMs = 6 * 60 * 60 * 1000;
const imageCacheMaxEntries = 300;
const imageCache = new Map<string, { value: DriveImageProxyResult; expires: number }>();
const inFlight = new Map<string, Promise<DriveImageProxyResult>>();

const readCache = (key: string) => {
  const entry = imageCache.get(key);
  if (!entry) return undefined;
  if (entry.expires <= Date.now()) {
    imageCache.delete(key);
    return undefined;
  }
  return entry.value;
};

const writeCache = (key: string, value: DriveImageProxyResult) => {
  imageCache.set(key, { value, expires: Date.now() + imageCacheTtlMs });
  if (imageCache.size > imageCacheMaxEntries) {
    const oldest = imageCache.keys().next().value;
    if (oldest !== undefined) imageCache.delete(oldest);
  }
};

const normalizeImageSize = (value: unknown) => {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return defaultImageSize;
  return Math.min(Math.floor(size), maxImageSize);
};

@injectable()
export class GoogleDrivePhotoService implements IGoogleDrivePhotoService {
  extractDriveFolderId(url?: unknown) {
    if (typeof url !== 'string') return undefined;

    const trimmed = url.trim();
    if (!trimmed) return undefined;

    const folderPathMatch = trimmed.match(driveFolderPathPattern);
    if (folderPathMatch?.[1]) return folderPathMatch[1];

    try {
      const parsed = new URL(trimmed);
      const folderId = parsed.searchParams.get('id') || parsed.searchParams.get('folderId');
      return folderId || undefined;
    } catch {
      return undefined;
    }
  }

  async getImagesFromDriveFolder(folderUrl: string): Promise<DriveFolderPhotoResult> {
    const folderId = this.extractDriveFolderId(folderUrl);
    if (!folderId) {
      return { photos: [], error: 'Google Drive folder ID could not be extracted' };
    }

    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
    if (!apiKey) {
      return { photos: [], error: 'GOOGLE_DRIVE_API_KEY is not configured' };
    }

    try {
      const drive = google.drive({ version: 'v3', auth: apiKey });
      const files: Array<{ id?: string | null; mimeType?: string | null }> = [];
      let pageToken: string | undefined;

      do {
        const response = await drive.files.list({
          q: `'${folderId}' in parents and trashed = false`,
          fields: 'nextPageToken, files(id, name, mimeType)',
          pageSize: 1000,
          pageToken,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });

        files.push(...(response.data.files || []));
        pageToken = response.data.nextPageToken || undefined;
      } while (pageToken);

      const photos = files
        .filter((file) => file.id && file.mimeType?.startsWith('image/'))
        .map((file) => `https://drive.google.com/uc?id=${file.id}`);

      return { photos };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google Drive API request failed';
      return { photos: [], error: message };
    }
  }

  async getImageFile(fileId: string, size?: unknown): Promise<DriveImageProxyResult> {
    if (!driveFileIdPattern.test(fileId)) {
      throw new Error('Google Drive file ID is invalid');
    }

    const imageSize = normalizeImageSize(size);
    const cacheKey = `${fileId}:${imageSize}`;

    const cached = readCache(cacheKey);
    if (cached) return cached;

    const existing = inFlight.get(cacheKey);
    if (existing) return existing;

    const request = this.fetchImageFromGoogle(fileId, imageSize)
      .then((value) => {
        writeCache(cacheKey, value);
        return value;
      })
      .finally(() => {
        inFlight.delete(cacheKey);
      });

    inFlight.set(cacheKey, request);
    return request;
  }

  private async fetchImageFromGoogle(fileId: string, imageSize: number): Promise<DriveImageProxyResult> {
    const encodedFileId = encodeURIComponent(fileId);
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
    const urls = [
      // Prefer the resized CDN endpoints first: they return small, fast bytes
      // sized to what the UI actually needs.
      `https://lh3.googleusercontent.com/d/${encodedFileId}=w${imageSize}`,
      `https://drive.google.com/thumbnail?id=${encodedFileId}&sz=w${imageSize}`,
      // Authoritative full-resolution download via the API key as a last resort
      // (works for any publicly shared file, but pulls the original bytes).
      ...(apiKey
        ? [`https://www.googleapis.com/drive/v3/files/${encodedFileId}?alt=media&key=${encodeURIComponent(apiKey)}`]
        : []),
    ];

    let lastError = 'Google Drive image could not be loaded';
    for (const url of urls) {
      try {
        const response = await fetch(url, { redirect: 'follow' });
        const contentType = response.headers.get('content-type') || '';
        if (!response.ok) {
          lastError = `Google Drive image request failed with ${response.status}`;
          continue;
        }
        if (!contentType.startsWith('image/')) {
          lastError = 'Google Drive response was not an image';
          continue;
        }

        return {
          buffer: Buffer.from(await response.arrayBuffer()),
          contentType,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : lastError;
      }
    }

    throw new Error(lastError);
  }
}
