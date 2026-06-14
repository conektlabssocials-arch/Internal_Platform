import { Fragment, FormEvent, useCallback, useEffect, useState } from 'react';

import { getAuditLogs } from '../api/activityApi';
import PageHeader from '../components/ui/PageHeader';
import type { ActivityFilters, ActivityLog } from '../types/activity';

const entityTypes = [
  '', 'User', 'Inventory', 'CRM', 'Contact', 'Campaign', 'Plan',
  'Document', 'Share', 'Operation', 'OperationItem', 'System',
];

const AuditLogs = () => {
  const [filters, setFilters] = useState<ActivityFilters>({ page: 1, limit: 25 });
  const [draft, setDraft] = useState<ActivityFilters>({});
  const [items, setItems] = useState<ActivityLog[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAuditLogs(filters);
      setItems(result.data);
      setTotalPages(result.pagination.totalPages);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    setFilters({ ...draft, page: 1, limit: 25 });
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Audit Logs" eyebrow="Settings" description="Admin traceability for saved actions and system events." />

      <form onSubmit={applyFilters} className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-3 xl:grid-cols-7">
        <input
          aria-label="Search audit logs"
          placeholder="Search message, entity, actor"
          value={draft.search || ''}
          onChange={(event) => setDraft({ ...draft, search: event.target.value })}
          className={inputClass}
        />
        <select
          aria-label="Entity type"
          value={draft.entityType || ''}
          onChange={(event) => setDraft({ ...draft, entityType: event.target.value })}
          className={inputClass}
        >
          {entityTypes.map((type) => <option key={type || 'all'} value={type}>{type || 'All entities'}</option>)}
        </select>
        <input
          aria-label="Action"
          placeholder="Action, e.g. PLAN_WON"
          value={draft.action || ''}
          onChange={(event) => setDraft({ ...draft, action: event.target.value })}
          className={inputClass}
        />
        <input
          aria-label="Actor user ID"
          placeholder="Actor user ID"
          value={draft.actor || ''}
          onChange={(event) => setDraft({ ...draft, actor: event.target.value })}
          className={inputClass}
        />
        <input
          aria-label="Date from"
          type="date"
          value={draft.from || ''}
          onChange={(event) => setDraft({ ...draft, from: event.target.value })}
          className={inputClass}
        />
        <input
          aria-label="Date to"
          type="date"
          value={draft.to || ''}
          onChange={(event) => setDraft({ ...draft, to: event.target.value })}
          className={inputClass}
        />
        <div className="flex gap-2">
          <button type="submit" className="flex-1 rounded-md bg-emerald-800 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">Apply</button>
          <button
            type="button"
            onClick={() => {
              setDraft({});
              setFilters({ page: 1, limit: 25 });
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Clear
          </button>
        </div>
      </form>

      {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {['Date', 'Actor', 'Action', 'Entity', 'Message', 'IP', 'User Agent', ''].map((heading) => (
                  <th key={heading} className="px-4 py-3 font-medium">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <Fragment key={item.id}>
                  <tr>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(item.createdAt)}</td>
                    <td className="px-4 py-3"><p className="font-medium">{item.actorName}</p><p className="text-xs text-slate-500">{item.actorEmail || item.actorRole || '-'}</p></td>
                    <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium">{item.actionLabel}</span></td>
                    <td className="px-4 py-3"><p>{item.entityType}</p><p className="text-xs text-slate-500">{item.entityCode || item.entityTitle || '-'}</p></td>
                    <td className="max-w-sm px-4 py-3 text-slate-700">{item.message}</td>
                    <td className="px-4 py-3 text-slate-500">{item.ipAddress || '-'}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-slate-500" title={item.userAgent}>{item.userAgent || '-'}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => setExpanded(expanded === item.id ? null : item.id)} className="text-xs font-medium text-emerald-700">
                        {expanded === item.id ? 'Hide' : 'Details'}
                      </button>
                    </td>
                  </tr>
                  {expanded === item.id ? (
                    <tr className="bg-slate-50">
                      <td colSpan={8} className="px-4 py-4">
                        <div className="grid gap-4 lg:grid-cols-2">
                          <Detail title="Changes" value={item.changes} />
                          <Detail title="Metadata" value={item.metadata} />
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-slate-100 md:hidden">
          {items.map((item) => (
            <article key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">{formatDate(item.createdAt)}</p>
                  <h3 className="mt-1 font-medium text-slate-900">{item.message}</h3>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">{item.entityType}</span>
              </div>
              <p className="mt-3 text-sm text-slate-600">{item.actorName} · {item.actionLabel}</p>
              <button type="button" onClick={() => setExpanded(expanded === item.id ? null : item.id)} className="mt-3 text-sm font-medium text-emerald-700">
                {expanded === item.id ? 'Hide details' : 'Show details'}
              </button>
              {expanded === item.id ? (
                <div className="mt-3 space-y-3">
                  <Detail title="Changes" value={item.changes} />
                  <Detail title="Metadata" value={item.metadata} />
                </div>
              ) : null}
            </article>
          ))}
        </div>
        {loading ? <p className="p-5 text-sm text-slate-500">Loading audit logs...</p> : null}
        {!loading && items.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">No audit logs match these filters.</p> : null}
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
          <span className="text-slate-500">Page {filters.page || 1} of {totalPages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={(filters.page || 1) <= 1 || loading} onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })} className={pageButton}>Previous</button>
            <button type="button" disabled={(filters.page || 1) >= totalPages || loading} onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })} className={pageButton}>Next</button>
          </div>
        </div>
      </section>
    </div>
  );
};

const Detail = ({ title, value }: { title: string; value: unknown }) => (
  <div>
    <p className="text-xs font-semibold uppercase text-slate-500">{title}</p>
    <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded-md bg-white p-3 text-xs text-slate-700">{JSON.stringify(value, null, 2)}</pre>
  </div>
);

const formatDate = (value: string) => new Date(value).toLocaleString('en-IN');
const inputClass = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900';
const pageButton = 'rounded-md border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-40';

export default AuditLogs;
