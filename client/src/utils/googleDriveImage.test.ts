import { describe, expect, it } from 'vitest';

import {
  API_BASE_URL,
} from '../api/apiClient';
import {
  extractGoogleDriveFileId,
  getDisplayImageUrl,
  getDisplayImageUrls,
} from './googleDriveImage';

describe('googleDriveImage', () => {
  it('extracts file ids from common Google Drive image URLs', () => {
    expect(
      extractGoogleDriveFileId('https://drive.google.com/uc?id=1ZpcWwtoGcWb1vfb0878sB8QSz6s63r72'),
    ).toBe('1ZpcWwtoGcWb1vfb0878sB8QSz6s63r72');
    expect(
      extractGoogleDriveFileId('https://drive.google.com/file/d/FILE_ID/view?usp=sharing'),
    ).toBe('FILE_ID');
    expect(
      extractGoogleDriveFileId('https://drive.usercontent.google.com/download?id=FILE_ID&authuser=0'),
    ).toBe('FILE_ID');
  });

  it('renders Google Drive files through the backend proxy first', () => {
    expect(
      getDisplayImageUrl('https://drive.google.com/uc?id=FILE_ID', 1200),
    ).toBe(`${API_BASE_URL}/public/drive-images/FILE_ID?size=1200`);
    expect(
      getDisplayImageUrls('https://drive.google.com/uc?id=FILE_ID', 1200),
    ).toEqual([
      `${API_BASE_URL}/public/drive-images/FILE_ID?size=1200`,
      'https://lh3.googleusercontent.com/d/FILE_ID=w1200',
    ]);
    expect(getDisplayImageUrl('https://example.com/photo.jpg')).toBe(
      'https://example.com/photo.jpg',
    );
  });
});
