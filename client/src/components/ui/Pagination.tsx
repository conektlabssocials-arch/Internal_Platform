const getPageWindow = (page: number, totalPages: number): (number | 'ellipsis')[] => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  const result: (number | 'ellipsis')[] = [];
  sorted.forEach((p, index) => {
    if (index > 0 && p - sorted[index - 1] > 1) result.push('ellipsis');
    result.push(p);
  });
  return result;
};

const Pagination = ({
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  total,
  onChange,
  label = 'items',
}: {
  page: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  onChange: (page: number) => void;
  label?: string;
}) => (
  <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row">
    <p className="text-xs text-slate-500">
      Showing <span className="font-medium text-slate-700">{rangeStart}</span>–
      <span className="font-medium text-slate-700">{rangeEnd}</span> of{' '}
      <span className="font-medium text-slate-700">{total}</span> {label}
    </p>
    <nav className="flex items-center gap-1" aria-label="Pagination">
      <PageButton label="‹" ariaLabel="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)} />
      {getPageWindow(page, totalPages).map((entry, index) =>
        entry === 'ellipsis' ? (
          <span key={`ellipsis-${index}`} className="px-2 text-sm text-slate-400">
            …
          </span>
        ) : (
          <PageButton key={entry} label={String(entry)} active={entry === page} onClick={() => onChange(entry)} />
        ),
      )}
      <PageButton label="›" ariaLabel="Next page" disabled={page >= totalPages} onClick={() => onChange(page + 1)} />
    </nav>
  </div>
);

const PageButton = ({
  label,
  ariaLabel,
  active,
  disabled,
  onClick,
}: {
  label: string;
  ariaLabel?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    aria-current={active ? 'page' : undefined}
    className={`flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm transition ${
      active
        ? 'border-emerald-600 bg-emerald-600 font-medium text-white'
        : 'border-slate-300 bg-white text-slate-600 hover:border-emerald-400 hover:text-emerald-700'
    } disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-300 disabled:hover:text-slate-600`}
  >
    {label}
  </button>
);

export default Pagination;
