import { useEffect, useMemo, useState } from 'react';

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
import ActivityTimeline from '../activity/ActivityTimeline';
import ConfirmDialog from '../ui/ConfirmDialog';
import OperationDocumentPanel from './OperationDocumentPanel';
import OperationItemTracker from './OperationItemTracker';
import OperationStatusBadge from './OperationStatusBadge';

type WorkspaceTab = 'execution' | 'documents' | 'activity' | 'settings';

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
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('execution');
  const [priority, setPriority] = useState<OperationPriority>('Medium');
  const [status, setStatus] = useState<OperationStatus>('Pending');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [cancelRequested, setCancelRequested] = useState(false);

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

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !cancelRequested) onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [cancelRequested, onClose]);

  const saveSettings = async () => {
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
    if (!operation) return;
    setSaving(true);
    try {
      apply(await updateOperationStatus(operation.id, 'Cancelled'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel operation');
    } finally {
      setSaving(false);
    }
  };

  const attention = useMemo(() => {
    if (!operation) return { overdue: 0, proofPending: 0 };
    const today = startOfToday();
    return {
      overdue: operation.items.filter(
        (item) =>
          item.mounting.scheduledDate &&
          new Date(item.mounting.scheduledDate) < today &&
          !item.mounting.completed,
      ).length,
      proofPending: operation.items.filter(
        (item) => item.mounting.completed && !item.proof.uploaded,
      ).length,
    };
  }, [operation]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55">
        <div className="rounded-md bg-white px-5 py-4 text-sm font-medium text-slate-700 shadow-xl">
          Loading Work Order...
        </div>
      </div>
    );
  }
  if (!operation) return null;

  const progress = operation.overallProgress;
  const tabs: Array<{ id: WorkspaceTab; label: string; count?: number }> = [
    { id: 'execution', label: 'Execution Items', count: operation.items.length },
    { id: 'documents', label: 'Documents' },
    { id: 'activity', label: 'Activity' },
    { id: 'settings', label: 'Work Order Settings' },
  ];

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/60 p-0 sm:p-4">
      <div role="dialog" aria-modal="true" aria-label={`Work Order ${operation.operationCode}`} className="mx-auto flex h-full w-full max-w-[1500px] flex-col overflow-hidden bg-slate-50 shadow-2xl sm:rounded-lg">
        <header className="shrink-0 border-b border-slate-200 bg-white">
          <div className="flex items-start justify-between gap-4 px-5 py-4 lg:px-7">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-emerald-700">{operation.operationCode}</p>
                <OperationStatusBadge status={operation.status} />
                <PriorityBadge priority={operation.priority} />
              </div>
              <h2 className="mt-2 truncate text-xl font-semibold text-slate-900">
                {operation.campaignTitle}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {operation.clientName} · {operation.campaignCode} · Plan {operation.planVersionLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              aria-label="Close Work Order"
            >
              Close
            </button>
          </div>

          <div className="grid border-t border-slate-100 sm:grid-cols-2 lg:grid-cols-5">
            <HeaderMetric label="Overall progress" value={`${progress.percentage}%`}>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-emerald-600"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </HeaderMetric>
            <HeaderMetric
              label="Execution items"
              value={`${progress.completedItemCount} of ${progress.totalItems} complete`}
            />
            <HeaderMetric
              label="Next mounting"
              value={formatDate(operation.importantDates.firstMountingDate)}
            />
            <HeaderMetric
              label="Needs attention"
              value={
                attention.overdue
                  ? `${attention.overdue} overdue`
                  : attention.proofPending
                    ? `${attention.proofPending} proof pending`
                    : 'Nothing urgent'
              }
              alert={Boolean(attention.overdue)}
            />
            <HeaderMetric
              label="Owner"
              value={operation.operationOwner?.name || operation.operationOwner?.email || 'Unassigned'}
            />
          </div>

          <nav className="flex gap-1 overflow-x-auto border-t border-slate-200 px-4 lg:px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium ${
                  activeTab === tab.id
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
                {tab.count !== undefined ? (
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {tab.count}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          {error ? (
            <p className="mx-5 mt-5 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 lg:mx-7">
              {error}
            </p>
          ) : null}

          {activeTab === 'execution' ? (
            <div className="mx-auto max-w-7xl px-5 py-6 lg:px-7">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Execution Items</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Open an item, then complete its stages from creative through proof.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <ProgressChip label="Creative" value={progress.creativeReceivedCount} total={progress.totalItems} />
                  <ProgressChip label="PO" value={progress.poSentCount} total={progress.totalItems} />
                  <ProgressChip label="Mounted" value={progress.mountingCompletedCount} total={progress.totalItems} />
                  <ProgressChip label="Proof" value={progress.proofUploadedCount} total={progress.totalItems} />
                </div>
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
                {!operation.items.length ? (
                  <p className="rounded-md border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                    No execution items are attached to this Work Order.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeTab === 'documents' ? (
            <div className="mx-auto max-w-7xl px-5 py-6 lg:px-7">
              <OperationDocumentPanel operation={operation} />
            </div>
          ) : null}

          {activeTab === 'activity' ? (
            <div className="mx-auto max-w-5xl px-5 py-6 lg:px-7">
              <div className="rounded-md border border-slate-200 bg-white p-5">
                <h3 className="font-semibold text-slate-900">Work Order Activity</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Saved changes and execution updates for this Work Order.
                </p>
                <div className="mt-5">
                  <ActivityTimeline entityType="Operation" entityId={operation.id} />
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'settings' ? (
            <div className="mx-auto max-w-3xl px-5 py-6 lg:px-7">
              <section className="rounded-md border border-slate-200 bg-white p-5">
                <h3 className="font-semibold text-slate-900">Work Order Settings</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Manage overall ownership, priority, status, and internal notes.
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className={label}>Status</span>
                    <select
                      value={status}
                      onChange={(event) => setStatus(event.target.value as OperationStatus)}
                      className={input}
                    >
                      {statuses
                        .filter((item) => isAdmin || item !== 'Cancelled')
                        .map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className={label}>Priority</span>
                    <select
                      value={priority}
                      onChange={(event) => setPriority(event.target.value as OperationPriority)}
                      className={input}
                    >
                      {priorities.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                </div>
                <div className="mt-4 rounded-md bg-slate-50 px-4 py-3">
                  <p className={label}>Operation owner</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {operation.operationOwner?.name || operation.operationOwner?.email || 'Unassigned'}
                  </p>
                </div>
                <label className="mt-4 block">
                  <span className={label}>Internal Work Order notes</span>
                  <textarea
                    rows={5}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className={input}
                  />
                </label>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveSettings()}
                    className={primary}
                  >
                    {saving ? 'Saving...' : 'Save Settings'}
                  </button>
                  {isAdmin && operation.status !== 'Cancelled' ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setCancelRequested(true)}
                      className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Cancel Work Order
                    </button>
                  ) : null}
                </div>
              </section>
            </div>
          ) : null}
        </main>
      </div>
      <ConfirmDialog
        open={cancelRequested}
        title="Cancel this Work Order?"
        description="The Work Order will remain available for audit history, but execution tracking will be marked Cancelled."
        confirmText="Cancel Work Order"
        danger
        busy={saving}
        onClose={() => setCancelRequested(false)}
        onConfirm={() => {
          setCancelRequested(false);
          void cancel();
        }}
      />
    </div>
  );
};

const HeaderMetric = ({
  label: text,
  value,
  alert,
  children,
}: {
  label: string;
  value: string;
  alert?: boolean;
  children?: React.ReactNode;
}) => (
  <div className="border-b border-slate-100 px-5 py-3 sm:border-r lg:border-b-0 lg:last:border-r-0">
    <p className="text-xs font-medium text-slate-500">{text}</p>
    <p className={`mt-1 truncate text-sm font-semibold ${alert ? 'text-red-700' : 'text-slate-900'}`}>
      {value}
    </p>
    {children}
  </div>
);

const ProgressChip = ({
  label: text,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) => (
  <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600">
    {text} <strong className="text-slate-900">{value}/{total}</strong>
  </span>
);

const PriorityBadge = ({ priority }: { priority: OperationPriority }) => {
  const tone =
    priority === 'High'
      ? 'bg-red-50 text-red-700'
      : priority === 'Low'
        ? 'bg-slate-100 text-slate-600'
        : 'bg-amber-50 text-amber-700';
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{priority} priority</span>;
};

const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(value))
    : 'Not scheduled';
const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};
const label = 'text-xs font-medium text-slate-600';
const input = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600';
const primary = 'rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400';

export default OperationDetail;
