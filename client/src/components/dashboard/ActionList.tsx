import EmptyState from './EmptyState';
import StatusPill from './StatusPill';

export type ActionListItem = {
  id: string;
  title: string;
  meta?: string;
  detail?: string;
  status?: string;
  tone?: 'default' | 'green' | 'yellow' | 'red' | 'blue';
  onClick?: () => void;
};

const ActionList = ({
  items,
  emptyMessage,
}: {
  items: ActionListItem[];
  emptyMessage: string;
}) => {
  if (!items.length) return <EmptyState message={emptyMessage} />;

  return (
    <div className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
      {items.map((item) => {
        const content = (
          <>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
              {item.meta ? <p className="mt-1 text-xs text-slate-500">{item.meta}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {item.detail ? <span className="text-xs text-slate-500">{item.detail}</span> : null}
              {item.status ? <StatusPill label={item.status} tone={item.tone} /> : null}
            </div>
          </>
        );

        return item.onClick ? (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
          >
            {content}
          </button>
        ) : (
          <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
            {content}
          </div>
        );
      })}
    </div>
  );
};

export default ActionList;
