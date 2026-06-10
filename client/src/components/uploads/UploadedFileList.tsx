import type { UploadedFile } from '../../types/upload';
import { getUploadDownloadUrl } from '../../api/uploadApi';

const UploadedFileList = ({
  files,
  deletingId,
  onDelete,
}: {
  files: UploadedFile[];
  deletingId?: string;
  onDelete?: (upload: UploadedFile) => void;
}) => {
  if (!files.length) {
    return <p className="text-xs text-slate-500">No uploaded files.</p>;
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
      {files.map((file) => (
        <li key={file.id} className="flex items-center justify-between gap-3 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800">{file.originalName}</p>
            <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <a
              href={getUploadDownloadUrl(file.id)}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-emerald-700 hover:text-emerald-900"
            >
              Download
            </a>
            {onDelete ? (
              <button
                type="button"
                disabled={deletingId === file.id}
                onClick={() => onDelete(file)}
                className="text-xs font-medium text-red-600 disabled:opacity-50"
              >
                {deletingId === file.id ? 'Deleting...' : 'Delete'}
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
};

const formatBytes = (value: number) => {
  if (value < 1024 * 1024) return `${Math.max(Math.round(value / 1024), 1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
};

export default UploadedFileList;
