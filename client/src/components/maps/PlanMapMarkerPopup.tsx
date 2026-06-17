import type { PlanMapItem } from '../../types/share';
import InventoryImage from '../ui/InventoryImage';

const PlanMapMarkerPopup = ({
  item,
  onClose,
}: {
  item: PlanMapItem;
  onClose: () => void;
}) => {
  const photoCount = item.photos?.length || (item.photoUrl ? 1 : 0);

  return (
    <div
      role="dialog"
      aria-label={item.title || item.inventoryCode || 'Site details'}
      onMouseDown={(event) => event.stopPropagation()}
      className="absolute inset-x-2 bottom-2 z-10 max-h-[calc(100%-1rem)] overflow-y-auto rounded-xl bg-white shadow-2xl ring-1 ring-slate-900/10 sm:inset-x-auto sm:bottom-4 sm:left-4 sm:w-[330px]"
    >
      <div className="relative">
        <InventoryImage
          src={item.photoUrl}
          alt={item.title || 'Outdoor inventory'}
          displaySize={800}
          className="h-32 w-full object-cover sm:h-40"
        />
        {item.subCategory ? (
          <span className="absolute left-2 top-2 rounded-full bg-slate-900/65 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
            {item.subCategory}
          </span>
        ) : null}
        {photoCount > 1 ? (
          <span className="absolute bottom-2 right-2 rounded-full bg-slate-900/65 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
            {photoCount} photos
          </span>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close map detail"
          title="Close"
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/55 text-lg text-white backdrop-blur transition hover:bg-slate-900/80"
        >
          ×
        </button>
      </div>

      <div className="p-4">
        {item.inventoryCode ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{item.inventoryCode}</p>
        ) : null}
        <h3 className="mt-0.5 break-words font-semibold leading-tight text-slate-900">{item.title}</h3>
        <p className="mt-1 break-words text-xs text-slate-500">{[item.city, item.area].filter(Boolean).join(' / ')}</p>

        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <Cell label="Size" value={formatSize(item)} />
          <Cell label="Quantity" value={String(item.quantity)} />
          <Cell label="Dates" value={`${formatDate(item.startDate)} - ${formatDate(item.endDate)}`} span />
          {item.address ? <Cell label="Address" value={item.address} span /> : null}
        </dl>

        <div className="mt-3 flex items-start justify-between gap-3 border-t border-slate-100 pt-3">
          <span className="text-xs text-slate-500">Total price</span>
          <span className="shrink-0 text-right text-sm font-semibold text-slate-900">{currency(item.totalSellingPrice)}</span>
        </div>
      </div>
    </div>
  );
};

const Cell = ({ label, value, span }: { label: string; value: string; span?: boolean }) => (
  <div className={`min-w-0 ${span ? 'col-span-2' : ''}`}>
    <dt className="text-slate-400">{label}</dt>
    <dd className="mt-0.5 break-words font-medium text-slate-700">{value || '-'}</dd>
  </div>
);

const currency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
    : '-';

const formatSize = (item: PlanMapItem) => {
  if (item.width && item.height) return `${item.width} x ${item.height} ft = ${item.totalSqFt || item.width * item.height} sq ft`;
  if (item.totalSqFt) return `${item.totalSqFt} sq ft`;
  return '-';
};

export default PlanMapMarkerPopup;
