import type { PlanMapItem } from '../../types/share';
import InventoryImage from '../ui/InventoryImage';

const PlanMapMarkerPopup = ({
  item,
  onClose,
}: {
  item: PlanMapItem;
  onClose: () => void;
}) => (
  <div role="dialog" aria-label={item.title || item.inventoryCode || 'Site details'} className="absolute inset-x-2 bottom-2 z-10 max-h-[78%] overflow-y-auto rounded-md border border-slate-200 bg-white shadow-xl sm:inset-x-auto sm:bottom-4 sm:left-4 sm:w-[360px] sm:max-w-[calc(100%-2rem)]">
    <InventoryImage
      src={item.photoUrl}
      alt={item.title || 'Outdoor inventory'}
      className="h-36 w-full object-cover"
    />
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-700">{item.inventoryCode}</p>
          <h3 className="mt-1 font-semibold text-slate-900">{item.title}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Close map detail" className="text-xl leading-none text-slate-400 hover:text-slate-700">
          ×
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-[90px_1fr] gap-x-3 gap-y-2 text-xs">
        <dt className="text-slate-500">Type</dt><dd>{item.subCategory || '-'}</dd>
        <dt className="text-slate-500">Location</dt><dd>{item.city} / {item.area}</dd>
        <dt className="text-slate-500">Address</dt><dd>{item.address || '-'}</dd>
        <dt className="text-slate-500">Size</dt><dd>{formatSize(item)}</dd>
        <dt className="text-slate-500">Dates</dt><dd>{formatDate(item.startDate)} - {formatDate(item.endDate)}</dd>
        <dt className="text-slate-500">Quantity</dt><dd>{item.quantity}</dd>
        <dt className="text-slate-500">Unit price</dt><dd>{currency(item.unitSellingPrice)}</dd>
        <dt className="text-slate-500">Total price</dt><dd className="font-semibold">{currency(item.totalSellingPrice)}</dd>
      </dl>
    </div>
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
