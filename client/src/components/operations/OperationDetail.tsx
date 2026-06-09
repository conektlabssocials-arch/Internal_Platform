import { useEffect, useState } from 'react';

import {
  getOperationById,
  updateOperation,
  updateOperationStatus,
} from '../../api/operationApi';
import { useAuth } from '../../context/AuthContext';
import type {
  Operation,
  OperationPriority,
  OperationStatus,
} from '../../types/operation';
import OperationDocumentPanel from './OperationDocumentPanel';
import OperationItemTracker from './OperationItemTracker';
import OperationStatusBadge from './OperationStatusBadge';
import ActivityTimeline from '../activity/ActivityTimeline';

const statuses: OperationStatus[] = [
  'Pending',
  'In Progress',
  'Partially Mounted',
  'Mounted',
  'Proof Pending',
  'Completed',
  'On Hold',
  'Cancelled',
];
const priorities: OperationPriority[] = ['Low', 'Medium', 'High'];

const OperationDetail = ({
  operationId,
  onClose,
  onUpdated,
}: {
  operationId: string;
  onClose: () => void;
  onUpdated?: (operation: Operation) => void;
}) => {
  const { isAdmin } = useAuth();
  const [operation, setOperation] = useState<Operation | null>(null);
  const [priority, setPriority] = useState<OperationPriority>('Medium');
  const [status, setStatus] = useState<OperationStatus>('Pending');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const apply = (next: Operation) => {
    setOperation(next);
    setPriority(next.priority);
    setStatus(next.status);
    setNotes(next.notes || '');
    onUpdated?.(next);
  };

  useEffect(() => {
    setLoading(true);
    getOperationById(operationId)
      .then(apply)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load operation'))
      .finally(() => setLoading(false));
  }, [operationId]);

  const saveHeader = async () => {
    if (!operation) return;
    setSaving(true);
    setError('');
    try {
      apply(await updateOperation(operation.id, { priority, status, notes }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update operation');
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    if (!operation || !window.confirm('Cancel this Operations Work Order?')) return;
    setSaving(true);
    try {
      apply(await updateOperationStatus(operation.id, 'Cancelled'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel operation');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 text-white">Loading Work Order...</div>;
  }
  if (!operation) return null;
  const progress = operation.overallProgress;

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/55 px-3 py-5">
      <div className="mx-auto w-full max-w-7xl rounded-lg bg-slate-50 p-5 shadow-xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">{operation.operationCode}</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">{operation.campaignTitle}</h2>
            <p className="mt-1 text-sm text-slate-500">{operation.clientName} · Plan {operation.planVersionLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <OperationStatusBadge status={operation.status} />
            <button type="button" onClick={onClose} className={secondary}>Close</button>
          </div>
        </header>

        {error ? <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <div className="rounded-md border border-slate-200 bg-white p-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <label><span className={label}>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as OperationStatus)} className={input}>{statuses.filter((item) => isAdmin || item !== 'Cancelled').map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span className={label}>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value as OperationPriority)} className={input}>{priorities.map((item) => <option key={item}>{item}</option>)}</select></label>
                <div><span className={label}>Owner</span><p className="mt-2 text-sm font-medium text-slate-800">{operation.operationOwner?.name || operation.operationOwner?.email || 'Unassigned'}</p></div>
              </div>
              <label className="mt-4 block"><span className={label}>Operation notes</span><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className={input} /></label>
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={saving} onClick={() => void saveHeader()} className={primary}>{saving ? 'Saving...' : 'Save Work Order'}</button>
                {isAdmin && operation.status !== 'Cancelled' ? <button type="button" onClick={() => void cancel()} className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">Cancel</button> : null}
              </div>
            </div>

            <OperationDocumentPanel operation={operation} />
            <ActivityTimeline entityType="Operation" entityId={operation.id} compact />

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Execution Items</h3>
                <span className="text-sm text-slate-500">{operation.items.length} items</span>
              </div>
              <div className="space-y-3">
                {operation.items.map((item) => (
                  <OperationItemTracker
                    key={item.id}
                    operationId={operation.id}
                    item={item}
                    onUpdated={apply}
                  />
                ))}
                {!operation.items.length ? <p className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No execution items.</p> : null}
              </div>
            </div>
          </div>

          <aside className="h-fit rounded-md border border-slate-200 bg-white p-4 lg:sticky lg:top-4">
            <div className="flex items-end justify-between">
              <div><p className="text-sm text-slate-500">Overall progress</p><p className="mt-1 text-3xl font-semibold">{progress.percentage}%</p></div>
              <p className="text-xs text-slate-500">{progress.proofUploadedCount}/{progress.totalItems} proof uploaded</p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-emerald-600" style={{ width: `${progress.percentage}%` }} /></div>
            <dl className="mt-5 space-y-3 text-sm">
              <Metric label="Creative received" value={`${progress.creativeReceivedCount}/${progress.totalItems}`} />
              <Metric label="PO sent" value={`${progress.poSentCount}/${progress.totalItems}`} />
              <Metric label="Mounted" value={`${progress.mountingCompletedCount}/${progress.totalItems}`} />
              <Metric label="Proof uploaded" value={`${progress.proofUploadedCount}/${progress.totalItems}`} />
              <Metric label="Completed items" value={`${progress.completedItemCount}/${progress.totalItems}`} />
            </dl>
            <div className="mt-5 border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold">Important Dates</h3>
              <dl className="mt-3 space-y-2 text-xs">
                <Metric label="First mounting" value={formatDate(operation.importantDates.firstMountingDate)} />
                <Metric label="Last mounting" value={formatDate(operation.importantDates.lastMountingDate)} />
                <Metric label="First takedown" value={formatDate(operation.importantDates.firstTakedownDate)} />
                <Metric label="Last takedown" value={formatDate(operation.importantDates.lastTakedownDate)} />
              </dl>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
};

const Metric = ({ label, value }: { label: string; value: string }) => <div className="flex justify-between gap-4"><dt className="text-slate-500">{label}</dt><dd className="font-medium text-slate-800">{value}</dd></div>;
const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '-';
const label = 'text-xs font-medium text-slate-600';
const input = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900';
const primary = 'rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400';
const secondary = 'rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100';

export default OperationDetail;
