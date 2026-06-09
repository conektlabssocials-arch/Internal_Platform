import { useEffect, useState } from 'react';

import { getEntityActivities } from '../../api/activityApi';
import type { ActivityLog } from '../../types/activity';

type Props = {
  entityType: string;
  entityId: string;
  compact?: boolean;
};

const ActivityTimeline = ({ entityType, entityId, compact = false }: Props) => {
  const [items, setItems] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    getEntityActivities(entityType, entityId, { limit: compact ? 8 : 20 })
      .then((result) => {
        if (active) {
          setItems(result.data);
          setError('');
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load activity');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [compact, entityId, entityType]);

  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="font-semibold text-slate-900">Activity</h3>
        <p className="mt-1 text-xs text-slate-500">Saved changes and important actions for this record.</p>
      </div>
      {loading ? (
        <p className="px-4 py-5 text-sm text-slate-500">Loading activity...</p>
      ) : error ? (
        <p className="px-4 py-5 text-sm text-red-700">{error}</p>
      ) : items.length === 0 ? (
        <p className="px-4 py-5 text-sm text-slate-500">No activity recorded yet.</p>
      ) : (
        <ol className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="relative px-4 py-3 pl-9">
              <span className="absolute left-4 top-[18px] h-2 w-2 rounded-full bg-emerald-600" />
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <p className="text-sm text-slate-800">{item.message}</p>
                <time className="shrink-0 text-xs text-slate-500">{formatActivityTime(item.createdAt)}</time>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {item.actorName} · {item.actionLabel}
              </p>
              {item.changes.length ? (
                <p className="mt-1 text-xs text-slate-500">{formatChanges(item.changes)}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};

const formatActivityTime = (value: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const formatChanges = (changes: ActivityLog['changes']) =>
  changes
    .slice(0, 3)
    .map((change) => `${change.field}: ${display(change.from)} → ${display(change.to)}`)
    .join(' · ');

const display = (value: unknown) => {
  if (value === null || value === undefined || value === '') return 'empty';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export default ActivityTimeline;
