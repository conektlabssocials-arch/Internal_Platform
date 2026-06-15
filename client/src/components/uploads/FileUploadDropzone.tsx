import { ChangeEvent, DragEvent, useRef, useState } from 'react';

type Props = {
  accept: string[];
  maxFiles: number;
  maxFileSizeMb: number;
  uploading?: boolean;
  label?: string;
  onUpload: (files: File[]) => Promise<void>;
};

const FileUploadDropzone = ({
  accept,
  maxFiles,
  maxFileSizeMb,
  uploading = false,
  label = 'Choose files',
  onUpload,
}: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

  const selectFiles = (files: File[]) => {
    if (files.length > maxFiles) {
      setError(`Select no more than ${maxFiles} files`);
      return;
    }
    const invalidType = files.find((file) => !accept.includes(file.type));
    if (invalidType) {
      setError(`${invalidType.name} has an unsupported file type`);
      return;
    }
    const invalidSize = files.find((file) => file.size > maxFileSizeMb * 1024 * 1024);
    if (invalidSize) {
      setError(`${invalidSize.name} exceeds ${maxFileSizeMb} MB`);
      return;
    }
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > 50 * 1024 * 1024) {
      setError('The combined upload size cannot exceed 50 MB');
      return;
    }
    setSelected(files);
    setError('');
  };

  const upload = async () => {
    if (!selected.length) return;
    setError('');
    try {
      await onUpload(selected);
      setSelected([]);
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    selectFiles(Array.from(event.target.files || []));
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    selectFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <div>
      <div
        onDragEnter={() => setDragging(true)}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          setDragging(false);
          handleDrop(event);
        }}
        className={`rounded-md border border-dashed p-4 text-center transition ${
          dragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple={maxFiles > 1}
          accept={accept.join(',')}
          disabled={uploading}
          onChange={handleInput}
          className="hidden"
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          {label}
        </button>
        <p className="mt-2 text-xs text-slate-500">
          Drop files here or browse. Up to {maxFiles} files, {maxFileSizeMb} MB each.
        </p>
        <p className="mt-1 text-[11px] text-slate-400">
          Accepted: {formatAcceptedTypes(accept)} · 50 MB total per upload
        </p>
        {selected.length ? (
          <div className="mt-3 text-left">
            <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
              {selected.map((file) => (
                <li key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                  <span className="min-w-0 truncate text-slate-700">{file.name}</span>
                  <span className="shrink-0 text-slate-400">{formatSize(file.size)}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={uploading}
              onClick={() => void upload()}
              className="mt-3 w-full rounded-md bg-emerald-800 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:bg-slate-400"
            >
              {uploading ? 'Uploading...' : `Upload ${selected.length} ${selected.length === 1 ? 'file' : 'files'}`}
            </button>
          </div>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
};

const formatAcceptedTypes = (types: string[]) =>
  [...new Set(types.map((type) => type.split('/').pop()?.replace('x-', '').toUpperCase()).filter(Boolean))].join(', ');

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(Math.round(bytes / 1024), 1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default FileUploadDropzone;
