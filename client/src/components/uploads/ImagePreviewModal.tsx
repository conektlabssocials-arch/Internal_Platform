import { useEffect } from 'react';

type ImagePreviewModalProps = {
  image: {
    url: string;
    name: string;
  } | null;
  onClose: () => void;
};

const ImagePreviewModal = ({ image, onClose }: ImagePreviewModalProps) => {
  useEffect(() => {
    if (!image) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [image, onClose]);

  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${image.name}`}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3">
          <p className="truncate text-sm font-medium text-slate-900">{image.name}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close image preview"
            title="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            ×
          </button>
        </div>
        <div className="flex max-h-[calc(90vh-61px)] items-center justify-center overflow-auto bg-slate-100 p-4">
          <img
            src={image.url}
            alt={image.name}
            className="max-h-[calc(90vh-93px)] max-w-full object-contain"
          />
        </div>
      </div>
    </div>
  );
};

export default ImagePreviewModal;
