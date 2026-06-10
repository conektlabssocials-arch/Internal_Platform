import { useEffect, useState } from 'react';

import {
  deleteUpload,
  getUploads,
  uploadInventoryPhotos,
} from '../../api/uploadApi';
import { useAuth } from '../../context/AuthContext';
import type { UploadedFile } from '../../types/upload';
import FileUploadDropzone from './FileUploadDropzone';
import ImagePreviewGrid from './ImagePreviewGrid';
import UploadedFileList from './UploadedFileList';

const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];

const InventoryPhotoUploads = ({
  inventoryId,
  legacyUrls,
  onChanged,
}: {
  inventoryId: string;
  legacyUrls: string[];
  onChanged: () => Promise<void>;
}) => {
  const { isAdmin } = useAuth();
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setUploads(await getUploads({
      entityType: 'Inventory',
      entityId: inventoryId,
      category: 'inventory_photo',
    }));
  };

  useEffect(() => {
    void load();
  }, [inventoryId]);

  const upload = async (files: File[]) => {
    setUploading(true);
    setMessage('');
    try {
      await uploadInventoryPhotos(inventoryId, files);
      await Promise.all([load(), onChanged()]);
      setMessage('Photos uploaded successfully.');
    } finally {
      setUploading(false);
    }
  };

  const remove = async (file: UploadedFile) => {
    if (!window.confirm(`Delete ${file.originalName}?`)) return;
    setDeletingId(file.id);
    try {
      await deleteUpload(file.id);
      await Promise.all([load(), onChanged()]);
    } finally {
      setDeletingId('');
    }
  };

  const trackedProviderUrls = new Set(
    uploads.map((upload) => upload.providerUrl).filter(Boolean),
  );
  const fallbackUrls = legacyUrls.filter((url) => !trackedProviderUrls.has(url));

  return (
    <section className="md:col-span-3 rounded-md border border-slate-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-slate-900">Inventory Photos</h4>
      <p className="mt-1 text-xs text-slate-500">JPEG, PNG, or WebP. Photos are client-safe.</p>
      <div className="mt-3">
        <FileUploadDropzone
          accept={imageTypes}
          maxFiles={10}
          maxFileSizeMb={10}
          uploading={uploading}
          label="Choose photos"
          onUpload={upload}
        />
      </div>
      {message ? <p className="mt-2 text-xs text-emerald-700">{message}</p> : null}
      <div className="mt-4">
        <ImagePreviewGrid uploads={uploads} legacyUrls={fallbackUrls} />
      </div>
      <div className="mt-4">
        <UploadedFileList
          files={uploads}
          deletingId={deletingId}
          onDelete={isAdmin ? remove : undefined}
        />
      </div>
    </section>
  );
};

export default InventoryPhotoUploads;
