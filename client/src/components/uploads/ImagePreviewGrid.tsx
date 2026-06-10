import type { UploadedFile } from '../../types/upload';
import { getPublicUploadUrl } from '../../api/uploadApi';

const ImagePreviewGrid = ({
  uploads = [],
  legacyUrls = [],
}: {
  uploads?: UploadedFile[];
  legacyUrls?: string[];
}) => {
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {images.map((image) => (
        <a key={image.key} href={image.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
          <img src={image.url} alt={image.name} className="aspect-square w-full object-cover" />
          <p className="truncate px-2 py-1.5 text-xs text-slate-600">{image.name}</p>
        </a>
      ))}
    </div>
  );
};

export default ImagePreviewGrid;
