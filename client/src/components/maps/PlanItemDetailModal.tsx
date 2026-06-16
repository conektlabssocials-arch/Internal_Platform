import { useEffect, useMemo, useState } from 'react';

import InventoryImage from '../ui/InventoryImage';

export type PlanItemDetail = {
  title?: string;
  inventoryCode?: string;
  categoryGroup?: string;
  subCategory?: string;
  city?: string;
  area?: string;
  address?: string;
  route?: string;
  depot?: string;
  itinerary?: string;
  width?: number;
  height?: number;
  totalSqFt?: number;
  startDate?: string;
  endDate?: string;
  quantity?: number;
  unitSellingPrice?: number;
  totalSellingPrice?: number;
  notes?: string;
  photoUrl?: string;
  photos?: string[];
};

const PlanItemDetailModal = ({
  item,
  onClose,
}: {
  item: PlanItemDetail | null;
  onClose: () => void;
}) => {
  const photos = useMemo(() => {
    if (!item) return [];
    const list = item.photos?.length ? item.photos : item.photoUrl ? [item.photoUrl] : [];
    return list.filter(Boolean);
  }, [item]);

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [item]);

  useEffect(() => {
    if (!item) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  const activePhoto = photos[activeIndex];

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={item.title || item.inventoryCode || 'Site details'}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            {item.inventoryCode ? (
              <p className="text-xs font-semibold uppercase text-emerald-700">{item.inventoryCode}</p>
            ) : null}
            <h3 className="truncate text-base font-semibold text-slate-900">{item.title || 'Site details'}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            title="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto">
          <div className="bg-slate-100 p-3">
            <InventoryImage
              src={activePhoto}
              alt={item.title || 'Inventory photo'}
              displaySize={1600}
              className="h-64 w-full rounded-md object-contain"
            />
            {photos.length > 1 ? (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {photos.map((photo, index) => (
                  <button
                    key={`${photo}-${index}`}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    aria-label={`View photo ${index + 1}`}
                    aria-current={index === activeIndex}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 ${
                      index === activeIndex ? 'border-emerald-600' : 'border-transparent'
                    }`}
                  >
                    <InventoryImage
                      src={photo}
                      alt={`${item.title || 'Inventory'} thumbnail ${index + 1}`}
                      displaySize={200}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 p-4 text-sm">
            <Row label="Category" value={[item.categoryGroup, item.subCategory].filter(Boolean).join(' / ')} />
            <Row label="Location" value={[item.city, item.area].filter(Boolean).join(' / ')} />
            {item.address ? <Row label="Address" value={item.address} /> : null}
            {item.route ? <Row label="Route" value={item.route} /> : null}
            {item.depot ? <Row label="Depot" value={item.depot} /> : null}
            {item.itinerary ? <Row label="Itinerary" value={item.itinerary} /> : null}
            <Row label="Size" value={formatSize(item)} />
            <Row label="Dates" value={`${formatDate(item.startDate)} - ${formatDate(item.endDate)}`} />
            <Row label="Quantity" value={String(item.quantity ?? '-')} />
            {item.unitSellingPrice ? <Row label="Unit price" value={currency(item.unitSellingPrice)} /> : null}
            <Row label="Total price" value={currency(item.totalSellingPrice || 0)} strong />
            {item.notes ? <Row label="Notes" value={item.notes} /> : null}
          </dl>
        </div>
      </div>
    </div>
  );
};

const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <>
    <dt className="text-slate-500">{label}</dt>
    <dd className={strong ? 'font-semibold text-slate-900' : 'text-slate-700'}>{value || '-'}</dd>
  </>
);

const currency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);

const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
    : '-';

const formatSize = (item: PlanItemDetail) => {
  if (item.width && item.height) return `${item.width} x ${item.height} ft = ${item.totalSqFt || item.width * item.height} sq ft`;
  if (item.totalSqFt) return `${item.totalSqFt} sq ft`;
  return '-';
};

export default PlanItemDetailModal;
