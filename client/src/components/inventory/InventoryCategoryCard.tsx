import type { CategoryGroup } from '../../types/inventory';

type InventoryCategoryCardProps = {
  categoryGroup: CategoryGroup;
  total: number;
  available: number;
  stale: number;
  neverConfirmed: number;
  description: string;
  onClick: () => void;
};

const InventoryCategoryCard = ({
  categoryGroup,
  total,
  available,
  stale,
  neverConfirmed,
  description,
  onClick,
}: InventoryCategoryCardProps) => {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{categoryGroup}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <Metric label="Total" value={total} />
        <Metric label="Available" value={available} />
        <Metric label="Stale" value={stale} />
        <Metric label="Never confirmed" value={neverConfirmed} />
      </dl>

      <button
        type="button"
        onClick={onClick}
        className="mt-5 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        View Inventory
      </button>
    </article>
  );
};

type MetricProps = {
  label: string;
  value: number;
};

const Metric = ({ label, value }: MetricProps) => (
  <div className="rounded-md bg-slate-50 px-3 py-2">
    <dt className="text-xs text-slate-500">{label}</dt>
    <dd className="mt-1 text-lg font-semibold text-slate-900">{value}</dd>
  </div>
);

export default InventoryCategoryCard;
