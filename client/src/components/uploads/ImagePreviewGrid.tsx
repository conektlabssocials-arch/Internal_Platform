import { useState } from 'react';

import type { UploadedFile } from '../../types/upload';
import { getPublicUploadUrl } from '../../api/uploadApi';
import ImagePreviewModal from './ImagePreviewModal';

const ImagePreviewGrid = ({
  uploads = [],
  legacyUrls = [],
}: {
  uploads?: UploadedFile[];
  legacyUrls?: string[];
}) => {
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const trackedProviderUrls = new Set(
    uploads.map((upload) => upload.providerUrl).filter(Boolean),
  );
  const images = [
    ...uploads.map((upload) => ({
      key: upload.id,
      url: getPublicUploadUrl(upload.id),
      name: upload.originalName,
    })),
    ...legacyUrls
      .filter((url) => !trackedProviderUrls.has(url))
      .map((url) => ({ key: url, url, name: 'Uploaded image' })),
  ];

  if (!images.length) return <p className="text-xs text-slate-500">No images uploaded.</p>;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((image) => (
          <button
            key={image.key}
            type="button"
            onClick={() => setPreview({ url: image.url, name: image.name })}
            aria-label={`Preview ${image.name}`}
            className="overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-left transition hover:border-emerald-400 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <img src={image.url} alt={image.name} className="aspect-square w-full object-cover" />
            <p className="truncate px-2 py-1.5 text-xs text-slate-600">{image.name}</p>
          </button>
        ))}
      </div>
      <ImagePreviewModal image={preview} onClose={() => setPreview(null)} />
    </>
  );
};

export default ImagePreviewGrid;
