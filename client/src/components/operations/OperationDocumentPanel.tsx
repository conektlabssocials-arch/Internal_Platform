import { useEffect, useMemo, useState } from 'react';

import {
  downloadDocument,
  generateOperationDocument,
  getOperationDocuments,
} from '../../api/documentApi';
import type {
  OperationDocument,
  OperationDocumentType,
} from '../../types/document';
import type { Operation } from '../../types/operation';

const documentLabels: Record<OperationDocumentType, string> = {
  WorkOrder: 'Work Order PDF',
  PurchaseOrder: 'Purchase Order PDF',
  ExecutionReport: 'Execution Report PDF',
};

const documentAudience: Record<OperationDocumentType, string> = {
  WorkOrder: 'Internal',
  PurchaseOrder: 'Supplier',
  ExecutionReport: 'Client-facing',
};

const descriptions: Record<OperationDocumentType, string> = {
  WorkOrder: 'Internal checklist for operations execution.',
  PurchaseOrder: 'Supplier-facing document confirming inventory booking and agreed cost.',
  ExecutionReport: 'Client-facing proof report after campaign execution.',
};

const OperationDocumentPanel = ({ operation }: { operation: Operation }) => {
  const [documents, setDocuments] = useState<OperationDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<OperationDocumentType | null>(null);
  const [error, setError] = useState('');

  const proofUploadedCount = useMemo(
    () =>
      operation.items.filter(
        (item) =>
          item.proof.uploaded &&
          (item.proof.photoUrls?.length || item.proof.fileUploads?.length),
      ).length,
    [operation.items],
  );
  const allProofUploaded =
    operation.items.length > 0 && proofUploadedCount === operation.items.length;

  const load = async () => {
    setLoading(true);
    try {
      setDocuments(await getOperationDocuments(operation.id));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [operation.id]);

  const generate = async (documentType: OperationDocumentType) => {
    setGenerating(documentType);
    setError('');
    try {
      const document = await generateOperationDocument(operation.id, documentType);
      setDocuments((current) => [document, ...current]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate document');
    } finally {
      setGenerating(null);
    }
  };

  const canGenerate: Record<OperationDocumentType, boolean> = {
    WorkOrder: true,
    PurchaseOrder: operation.items.length > 0,
    ExecutionReport: proofUploadedCount > 0,
  };

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Documents</h3>
          <p className="mt-1 text-xs text-slate-500">
            Generate operation PDFs from the latest saved Work Order data.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(documentLabels) as OperationDocumentType[]).map((type) => (
            <button
              key={type}
              type="button"
              disabled={generating !== null || !canGenerate[type]}
              onClick={() => void generate(type)}
              className={type === 'ExecutionReport' ? successButton : secondaryButton}
              title={!canGenerate[type] ? disabledReason(type) : descriptions[type]}
            >
              {generating === type ? 'Generating...' : `Generate ${documentLabels[type]}`}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-3">
        {(Object.keys(descriptions) as OperationDocumentType[]).map((type) => (
          <div key={type} className="rounded-md bg-slate-50 p-3">
            <span className={badgeClass(type)}>{documentAudience[type]}</span>
            <p className="mt-2">{descriptions[type]}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        Proof uploaded for {proofUploadedCount} of {operation.items.length} items.
        {!proofUploadedCount ? ' Upload proof photos before generating execution report.' : null}
        {proofUploadedCount > 0 && !allProofUploaded
          ? ' Execution report will be marked as partial.'
          : null}
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Audience</th>
              <th className="px-3 py-2 font-medium">Generated</th>
              <th className="px-3 py-2 font-medium">Generated By</th>
              <th className="px-3 py-2 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {documents.map((document) => (
              <tr key={document.id}>
                <td className="px-3 py-3 font-medium">
                  {documentLabels[document.documentType]}
                  {document.metadata?.partial ? (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                      Partial
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  <span className={badgeClass(document.documentType)}>
                    {documentAudience[document.documentType]}
                  </span>
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {formatDateTime(document.generatedAt)}
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {document.generatedBy?.name || document.generatedBy?.email || '-'}
                </td>
                <td className="px-3 py-3 text-right">
                  <button
                    type="button"
                    onClick={() =>
                      void downloadDocument(document).catch((err) => setError(err.message))
                    }
                    className={linkButton}
                  >
                    Download
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading ? (
          <p className="p-4 text-center text-sm text-slate-500">Loading documents...</p>
        ) : null}
        {!loading && !documents.length ? (
          <p className="p-4 text-center text-sm text-slate-500">
            No operation documents generated yet.
          </p>
        ) : null}
      </div>
    </section>
  );
};

const disabledReason = (type: OperationDocumentType) => {
  if (type === 'PurchaseOrder') return 'Operation items are required.';
  if (type === 'ExecutionReport') {
    return 'Upload proof photos before generating execution report.';
  }
  return '';
};

const badgeClass = (type: OperationDocumentType) => {
  if (type === 'ExecutionReport') {
    return 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800';
  }
  if (type === 'PurchaseOrder') {
    return 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800';
  }
  return 'rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700';
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const secondaryButton =
  'rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const successButton =
  'rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50';
const linkButton = 'text-sm font-medium text-emerald-700 hover:text-emerald-900';

export default OperationDocumentPanel;
