import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  commitImportJob,
  deleteImportJob,
  downloadImportErrors,
  downloadImportTemplate,
  getImportJob,
  getImportJobs,
  getImportTemplates,
  uploadImportFile,
  validateImportJob,
} from '../api/importApi';
import type {
  ImportJob,
  ImportRow,
  ImportTemplate,
  ImportType,
} from '../types/import';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const importTypeLabels: Record<ImportType, string> = {
  inventory: 'Inventory',
  crm_entities: 'CRM Entities',
  contacts: 'Contacts',
};

type DataMigrationProps = {
  onClose: () => void;
  onImported?: () => Promise<void> | void;
};

const DataMigration = ({ onClose, onImported }: DataMigrationProps) => {
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [importType, setImportType] = useState<ImportType>('inventory');
  const [file, setFile] = useState<File | null>(null);
  const [activeJob, setActiveJob] = useState<ImportJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmCommit, setConfirmCommit] = useState(false);

  const loadPage = useCallback(async () => {
    setLoading(true);
    try {
      const [templateData, history] = await Promise.all([
        getImportTemplates(),
        getImportJobs({ page, limit: 15 }),
      ]);
      setTemplates(templateData);
      setJobs(history.data);
      setTotalPages(history.pagination.totalPages);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load migration tools');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const handleUpload = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError('Choose a CSV file before uploading.');
      return;
    }
    setWorking('upload');
    setError('');
    setSuccess('');
    try {
      const job = await uploadImportFile(importType, file);
      setActiveJob(job);
      setSuccess(`${file.name} was parsed. Validate it before importing.`);
      setFile(null);
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setWorking('');
    }
  };

  const handleValidate = async () => {
    if (!activeJob) return;
    setWorking('validate');
    setError('');
    setSuccess('');
    try {
      const result = await validateImportJob(activeJob.id);
      setActiveJob({
        ...result.job,
        previewRows: result.previewRows,
        errors: result.errors,
      });
      setSuccess('Validation complete. Review the summary before committing.');
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setWorking('');
    }
  };

  const handleCommit = async () => {
    if (!activeJob) return;
    setWorking('commit');
    setError('');
    setSuccess('');
    try {
      const result = await commitImportJob(activeJob.id);
      setActiveJob(result.job);
      setSuccess(
        `${result.summary.importedRows} rows imported; ${result.summary.skippedRows} skipped.`,
      );
      if (result.job.importType === 'inventory' && result.summary.importedRows > 0) {
        await onImported?.();
      }
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setWorking('');
    }
  };

  const openJob = async (jobId: string) => {
    setWorking(`view-${jobId}`);
    try {
      setActiveJob(await getImportJob(jobId));
      setError('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load import job');
    } finally {
      setWorking('');
    }
  };

  const cancelJob = async (job: ImportJob) => {
    setWorking(`delete-${job.id}`);
    try {
      await deleteImportJob(job.id);
      if (activeJob?.id === job.id) setActiveJob(null);
      setSuccess('Import job cancelled.');
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to cancel import');
    } finally {
      setWorking('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-0 sm:p-6">
      <section role="dialog" aria-modal="true" aria-label="Bulk Data Upload" className="mx-auto min-h-full max-w-[1500px] overflow-hidden bg-slate-50 shadow-2xl sm:min-h-0 sm:rounded-md">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div>
            <p className="text-sm text-slate-500">Inventory</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">Bulk Data Upload</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Import spreadsheet data with validation, duplicate checks, and row-level errors.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </header>

        <div className="space-y-8 p-5 sm:p-6">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {success}
            </div>
          ) : null}

          <ol className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 bg-white p-3 sm:grid-cols-5">
            {['Download template', 'Upload CSV', 'Validate', 'Commit', 'Review history'].map((step, index) => (
              <li key={step} className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white">{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>

          <section>
        <SectionHeading
          title="CSV Templates"
          description="Start with the matching template so headers and category fields remain consistent."
        />
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <div
              key={template.name}
              className="rounded-md border border-slate-200 bg-white p-4"
            >
              <p className="font-medium text-slate-900">
                {templateName(template.name)}
              </p>
              <p className="mt-1 min-h-10 text-sm text-slate-500">
                {template.description}
              </p>
              <button
                type="button"
                onClick={() =>
                  void downloadImportTemplate(template.name).catch((err) =>
                    setError(err instanceof Error ? err.message : 'Download failed'),
                  )
                }
                className="mt-4 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Download CSV
              </button>
            </div>
          ))}
        </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <SectionHeading
            title="Upload CSV"
            description="The file is parsed in memory and retained as an import job. No local upload folder is used."
          />
          <form
            onSubmit={handleUpload}
            className="mt-4 space-y-4 rounded-md border border-slate-200 bg-white p-5"
          >
            <label className="block">
              <span className={labelClass}>Import type</span>
              <select
                value={importType}
                onChange={(event) => setImportType(event.target.value as ImportType)}
                className={inputClass}
              >
                <option value="inventory">Inventory</option>
                <option value="crm_entities">CRM Entities</option>
                <option value="contacts">Contacts</option>
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>CSV file</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:font-medium"
              />
            </label>
            {importType === 'inventory' ? (
              <p className="text-sm text-slate-500">
                Use the correct Outdoor, Auto, Bus, or Mobile Van template.
              </p>
            ) : null}
            <button
              type="submit"
              disabled={!file || Boolean(working)}
              className={primaryButton}
            >
              {working === 'upload' ? 'Uploading...' : 'Upload and Parse'}
            </button>
          </form>
        </div>

        <div>
          <SectionHeading
            title="Validation Preview"
            description="Only valid rows are committed. Invalid and duplicate rows remain in the report."
          />
          <div className="mt-4 rounded-md border border-slate-200 bg-white">
            {activeJob ? (
              <JobPreview
                job={activeJob}
                working={working}
                onValidate={handleValidate}
                onCommit={() => setConfirmCommit(true)}
                onDownloadErrors={() =>
                  void downloadImportErrors(activeJob.id).catch((err) =>
                    setError(err instanceof Error ? err.message : 'Download failed'),
                  )
                }
              />
            ) : (
              <p className="px-5 py-12 text-center text-sm text-slate-500">
                Upload a CSV or open a job from history to review it here.
              </p>
            )}
          </div>
        </div>
          </section>

          <section>
        <SectionHeading
          title="Import History"
          description="Review previous validations, completed imports, and skipped rows."
        />
        <div className="mt-4 overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {[
                    'Date', 'Type', 'File', 'Status', 'Total', 'Valid', 'Invalid',
                    'Duplicates', 'Imported', 'Uploaded By', 'Actions',
                  ].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-medium">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {formatDate(job.createdAt)}
                    </td>
                    <td className="px-4 py-3">{importTypeLabels[job.importType]}</td>
                    <td className="max-w-48 truncate px-4 py-3" title={job.originalName}>
                      {job.originalName || '-'}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                    <td className="px-4 py-3">{job.totalRows}</td>
                    <td className="px-4 py-3 text-emerald-700">{job.validRows}</td>
                    <td className="px-4 py-3 text-red-700">{job.invalidRows}</td>
                    <td className="px-4 py-3 text-amber-700">{job.duplicateRows}</td>
                    <td className="px-4 py-3 font-medium">{job.importedRows}</td>
                    <td className="px-4 py-3">{job.uploadedBy?.name || job.uploadedBy?.email || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void openJob(job.id)}
                          className={smallButton}
                        >
                          {working === `view-${job.id}` ? 'Loading...' : 'View'}
                        </button>
                        {(job.invalidRows > 0 || (job.errors?.length || 0) > 0) ? (
                          <button
                            type="button"
                            onClick={() => void downloadImportErrors(job.id)}
                            className={smallButton}
                          >
                            Errors
                          </button>
                        ) : null}
                        {!['imported', 'cancelled'].includes(job.status) ? (
                          <button
                            type="button"
                            onClick={() => void cancelJob(job)}
                            className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            {working === `delete-${job.id}` ? 'Cancelling...' : 'Cancel'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-slate-100 md:hidden">
            {jobs.map((job) => (
              <article key={job.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{job.originalName || 'CSV import'}</p>
                    <p className="mt-1 text-xs text-slate-500">{importTypeLabels[job.importType]} · {formatDate(job.createdAt)}</p>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                  <HistoryMetric label="Total" value={job.totalRows} />
                  <HistoryMetric label="Valid" value={job.validRows} tone="text-emerald-700" />
                  <HistoryMetric label="Invalid" value={job.invalidRows} tone="text-red-700" />
                  <HistoryMetric label="Duplicates" value={job.duplicateRows} tone="text-amber-700" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void openJob(job.id)} className={smallButton}>View details</button>
                  {job.invalidRows > 0 ? <button type="button" onClick={() => void downloadImportErrors(job.id)} className={smallButton}>Error CSV</button> : null}
                  {!['imported', 'cancelled'].includes(job.status) ? <button type="button" onClick={() => void cancelJob(job)} className="rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-700">Cancel</button> : null}
                </div>
              </article>
            ))}
          </div>
          {loading ? <p className="p-5 text-sm text-slate-500">Loading import history...</p> : null}
          {!loading && jobs.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No import jobs yet.</p>
          ) : null}
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
            <span className="text-slate-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((value) => value - 1)}
                className={pageButton}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((value) => value + 1)}
                className={pageButton}
              >
                Next
              </button>
            </div>
          </div>
        </div>
          </section>
        </div>
      </section>
      <ConfirmDialog
        open={confirmCommit}
        title="Commit this import?"
        description="Only valid rows will be imported. Invalid and duplicate rows will be skipped, and this action may create multiple records."
        confirmText="Commit Import"
        busy={working === 'commit'}
        onClose={() => setConfirmCommit(false)}
        onConfirm={() => {
          setConfirmCommit(false);
          void handleCommit();
        }}
      />
    </div>
  );
};

const HistoryMetric = ({ label, value, tone = 'text-slate-900' }: { label: string; value: number; tone?: string }) => (
  <div className="rounded-md bg-slate-50 px-2 py-2">
    <p className="text-[10px] text-slate-500">{label}</p>
    <p className={`mt-1 text-sm font-semibold ${tone}`}>{value}</p>
  </div>
);

const JobPreview = ({
  job,
  working,
  onValidate,
  onCommit,
  onDownloadErrors,
}: {
  job: ImportJob;
  working: string;
  onValidate: () => void;
  onCommit: () => void;
  onDownloadErrors: () => void;
}) => {
  const columns = useMemo(() => {
    const keys = new Set<string>();
    (job.previewRows || []).forEach((row) =>
      Object.keys(row.data).slice(0, 8).forEach((key) => keys.add(key)),
    );
    return [...keys].slice(0, 7);
  }, [job.previewRows]);
  const destination = job.importType === 'inventory' ? '/inventory' : '/crm';

  return (
    <>
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-medium text-slate-900">{job.originalName}</p>
            <p className="mt-1 text-sm text-slate-500">
              {importTypeLabels[job.importType]} · <StatusBadge status={job.status} />
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {['uploaded', 'validated'].includes(job.status) ? (
              <button
                type="button"
                onClick={onValidate}
                disabled={Boolean(working)}
                className={secondaryButton}
              >
                {working === 'validate' ? 'Validating...' : job.status === 'validated' ? 'Revalidate' : 'Validate'}
              </button>
            ) : null}
            {job.status === 'validated' ? (
              <button
                type="button"
                onClick={onCommit}
                disabled={Boolean(working)}
                className={primaryButton}
              >
                {working === 'commit' ? 'Importing...' : 'Commit Import'}
              </button>
            ) : null}
            {(job.invalidRows > 0 || (job.errors?.length || 0) > 0) ? (
              <button type="button" onClick={onDownloadErrors} className={secondaryButton}>
                Download Errors CSV
              </button>
            ) : null}
            {job.status === 'imported' ? (
              <Link to={destination} className={primaryButton}>Open {importTypeLabels[job.importType]}</Link>
            ) : null}
          </div>
        </div>
        {job.status === 'validated' ? (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Only valid rows will be imported. Invalid and duplicate rows will be skipped.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Total" value={job.totalRows} />
        <Metric label="Valid" value={job.validRows} tone="green" />
        <Metric label="Invalid" value={job.invalidRows} tone="red" />
        <Metric label="Duplicates" value={job.duplicateRows} tone="yellow" />
        <Metric label="Imported" value={job.importedRows} tone="green" />
        <Metric label="Skipped" value={job.skippedRows} />
      </div>

      {(job.previewRows || []).length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Row</th>
                <th className="px-3 py-2 font-medium">Status</th>
                {columns.map((column) => (
                  <th key={column} className="px-3 py-2 font-medium">{column}</th>
                ))}
                <th className="px-3 py-2 font-medium">Messages</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(job.previewRows || []).map((row) => (
                <PreviewRow key={row.rowNumber} row={row} columns={columns} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="p-6 text-center text-sm text-slate-500">
          Validate this job to see its first 20 rows.
        </p>
      )}
    </>
  );
};

const PreviewRow = ({ row, columns }: { row: ImportRow; columns: string[] }) => {
  const messages = [...(row.errors || []), ...(row.warnings || [])];
  return (
    <tr>
      <td className="px-3 py-2 text-slate-500">{row.rowNumber}</td>
      <td className="px-3 py-2"><RowStatus status={row.status} /></td>
      {columns.map((column) => (
        <td key={column} className="max-w-40 truncate px-3 py-2" title={displayValue(row.data[column])}>
          {displayValue(row.data[column]) || '-'}
        </td>
      ))}
      <td className="max-w-64 px-3 py-2 text-slate-600">
        {messages.map((message) => message.message).join('; ') || '-'}
      </td>
    </tr>
  );
};

const Metric = ({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'green' | 'red' | 'yellow';
}) => (
  <div className="bg-white px-4 py-3">
    <p className="text-xs text-slate-500">{label}</p>
    <p className={`mt-1 text-xl font-semibold ${metricTones[tone]}`}>{value}</p>
  </div>
);

const StatusBadge = ({ status }: { status: ImportJob['status'] }) => (
  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusTones[status]}`}>
    {status.replace('_', ' ')}
  </span>
);

const RowStatus = ({ status }: { status: ImportRow['status'] }) => (
  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${rowTones[status]}`}>
    {status}
  </span>
);

const SectionHeading = ({ title, description }: { title: string; description: string }) => (
  <div>
    <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    <p className="mt-1 text-sm text-slate-500">{description}</p>
  </div>
);

const displayValue = (value: unknown) => {
  if (value === undefined || value === null || value === '') return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
};
const templateName = (value: string) =>
  value.split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
const formatDate = (value: string) => new Date(value).toLocaleString('en-IN');
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700';
const inputClass = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900';
const primaryButton = 'inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton = 'inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const smallButton = 'rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50';
const pageButton = 'rounded-md border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-40';
const metricTones = {
  default: 'text-slate-900',
  green: 'text-emerald-700',
  red: 'text-red-700',
  yellow: 'text-amber-700',
};
const statusTones: Record<ImportJob['status'], string> = {
  uploaded: 'bg-blue-50 text-blue-700',
  validated: 'bg-amber-50 text-amber-800',
  imported: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
  cancelled: 'bg-slate-100 text-slate-600',
};
const rowTones: Record<ImportRow['status'], string> = {
  pending: 'bg-blue-50 text-blue-700',
  valid: 'bg-emerald-50 text-emerald-700',
  invalid: 'bg-red-50 text-red-700',
  duplicate: 'bg-amber-50 text-amber-800',
  imported: 'bg-emerald-50 text-emerald-700',
  skipped: 'bg-slate-100 text-slate-600',
};

export default DataMigration;
