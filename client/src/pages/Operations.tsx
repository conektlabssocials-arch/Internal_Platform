import { useEffect, useMemo, useState } from 'react';

import { getOperations, getOperationSummary } from '../api/operationApi';
import OperationDetail from '../components/operations/OperationDetail';
import OperationStatusBadge from '../components/operations/OperationStatusBadge';
import type {
  Operation,
  OperationFilters,
  OperationStatus,
  OperationSummary,
} from '../types/operation';

const emptySummary: OperationSummary = {
  total: 0,
  pending: 0,
  inProgress: 0,
  mounted: 0,
  proofPending: 0,
  completed: 0,
  overdueMountings: 0,
  proofPendingCount: 0,
  creativePendingCount: 0,
  poPendingCount: 0,
};

const statusOptions: OperationStatus[] = [
  'Pending',
  'In Progress',
  'Partially Mounted',
  'Mounted',
  'Proof Pending',
  'Completed',
  'On Hold',
  'Cancelled',
];

const Operations = () => {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [summary, setSummary] = useState(emptySummary);
  const [filters, setFilters] = useState<OperationFilters>({ page: 1, limit: 20 });
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [list, nextSummary] = await Promise.all([
        getOperations(filters),
        getOperationSummary(),
      ]);
      setOperations(list.data);
      setPagination({
        page: list.pagination.page,
        total: list.pagination.total,
        totalPages: list.pagination.totalPages,
      });
      setSummary(nextSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Operations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timeout);
  }, [filters]);

  const owners = useMemo(() => {
    const values = new Map<string, string>();
    operations.forEach((operation) => {
      if (operation.operationOwner) {
        values.set(
          operation.operationOwner.id,
          operation.operationOwner.name || operation.operationOwner.email || 'Owner',
        );
      }
    });
    return [...values.entries()];
  }, [operations]);

  const updateFilter = (key: keyof OperationFilters, value: string | boolean | number) =>
    setFilters((current) => ({ ...current, [key]: value, page: key === 'page' ? Number(value) : 1 }));

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-slate-500">Won Plan execution</p>
        <h1 className="text-2xl font-semibold text-slate-900">Operations Work Orders</h1>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <SummaryCard label="Total Work Orders" value={summary.total} />
        <SummaryCard label="Pending" value={summary.pending} />
        <SummaryCard label="In Progress" value={summary.inProgress} />
        <SummaryCard label="Mounted" value={summary.mounted} />
        <SummaryCard label="Proof Pending" value={summary.proofPendingCount} />
        <SummaryCard label="Completed" value={summary.completed} />
        <SummaryCard label="Overdue Mountings" value={summary.overdueMountings} alert />
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <input value={filters.search || ''} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search operations" className={input} />
          <select value={filters.status || ''} onChange={(event) => updateFilter('status', event.target.value)} className={input}><option value="">All statuses</option>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select>
          <input value={filters.city || ''} onChange={(event) => updateFilter('city', event.target.value)} placeholder="City" className={input} />
          <select value={filters.categoryGroup || ''} onChange={(event) => updateFilter('categoryGroup', event.target.value)} className={input}><option value="">All categories</option>{['Outdoor', 'Auto', 'Bus', 'Mobile Van'].map((item) => <option key={item}>{item}</option>)}</select>
          <select value={filters.operationOwner || ''} onChange={(event) => updateFilter('operationOwner', event.target.value)} className={input}><option value="">All owners</option>{owners.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
          <label className={check}><input type="checkbox" checked={Boolean(filters.proofPending)} onChange={(event) => updateFilter('proofPending', event.target.checked)} />Proof pending</label>
          <label className={check}><input type="checkbox" checked={Boolean(filters.overdue)} onChange={(event) => updateFilter('overdue', event.target.checked)} />Overdue</label>
        </div>
      </section>

      {error ? <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>{['Operation Code', 'Campaign', 'Client', 'Plan', 'Status', 'Progress', 'Items', 'Proof Pending', 'Next Mounting', 'Owner', 'Actions'].map((heading) => <th key={heading} className="px-4 py-3 font-medium">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {operations.map((operation) => {
                const proofPending = operation.items.filter((item) => item.mounting.completed && !item.proof.uploaded).length;
                return (
                  <tr key={operation.id}>
                    <td className="px-4 py-4 font-semibold text-emerald-700">{operation.operationCode}</td>
                    <td className="px-4 py-4"><p className="font-medium">{operation.campaignTitle}</p><p className="text-xs text-slate-500">{operation.campaignCode}</p></td>
                    <td className="px-4 py-4 text-slate-600">{operation.clientName}</td>
                    <td className="px-4 py-4">{operation.planVersionLabel}</td>
                    <td className="px-4 py-4"><OperationStatusBadge status={operation.status} /></td>
                    <td className="px-4 py-4"><div className="flex items-center gap-2"><div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-emerald-600" style={{ width: `${operation.overallProgress.percentage}%` }} /></div><span>{operation.overallProgress.percentage}%</span></div></td>
                    <td className="px-4 py-4">{operation.overallProgress.totalItems}</td>
                    <td className="px-4 py-4">{proofPending}</td>
                    <td className="px-4 py-4 text-slate-600">{formatDate(operation.importantDates.firstMountingDate)}</td>
                    <td className="px-4 py-4 text-slate-600">{operation.operationOwner?.name || 'Unassigned'}</td>
                    <td className="px-4 py-4"><button type="button" onClick={() => setSelectedId(operation.id)} className="font-medium text-emerald-700 hover:text-emerald-900">Open Work Order</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {loading ? <p className="p-8 text-center text-sm text-slate-500">Loading Operations...</p> : null}
        {!loading && !operations.length ? <p className="p-8 text-center text-sm text-slate-500">No Work Orders match these filters. Work Orders are created automatically when Plans are marked Won.</p> : null}
        <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
          <span className="text-slate-500">{pagination.total} Work Orders</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={pagination.page <= 1} onClick={() => updateFilter('page', pagination.page - 1)} className={pageButton}>Previous</button>
            <span>{pagination.page} / {pagination.totalPages}</span>
            <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => updateFilter('page', pagination.page + 1)} className={pageButton}>Next</button>
          </div>
        </footer>
      </section>

      {selectedId ? (
        <OperationDetail
          operationId={selectedId}
          onClose={() => setSelectedId('')}
          onUpdated={(updated) => {
            setOperations((current) => current.map((item) => item.id === updated.id ? updated : item));
            void getOperationSummary().then(setSummary);
          }}
        />
      ) : null}
    </div>
  );
};

const SummaryCard = ({ label, value, alert }: { label: string; value: number; alert?: boolean }) => (
  <article className="rounded-md border border-slate-200 bg-white p-4">
    <p className="text-xs font-medium text-slate-500">{label}</p>
    <p className={`mt-2 text-2xl font-semibold ${alert && value ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
  </article>
);

const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '-';
const input = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900';
const check = 'flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700';
const pageButton = 'rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40';

export default Operations;
