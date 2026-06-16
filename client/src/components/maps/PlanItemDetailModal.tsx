import { useCallback, useEffect, useMemo, useState } from 'react';

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

  const hasMultiple = photos.length > 1;

  const goTo = useCallback(
    (next: number) => {
      if (!photos.length) return;
      setActiveIndex((next + photos.length) % photos.length);
    },
    [photos.length],
  );

  useEffect(() => {
    if (!item) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') goTo(activeIndex + 1);
      if (event.key === 'ArrowLeft') goTo(activeIndex - 1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onClose, goTo, activeIndex]);

  if (!item) return null;

  const activePhoto = photos[activeIndex];
  const subtitle = [item.categoryGroup, item.subCategory].filter(Boolean).join(' · ');

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={item.title || item.inventoryCode || 'Site details'}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div className="relative flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl lg:flex-row">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          title="Close"
          className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/55 text-lg text-white backdrop-blur transition hover:bg-slate-900/80 lg:bg-white/90 lg:text-slate-700 lg:hover:bg-white"
        >
          ×
        </button>

        {/* Image stage — fixed height so the frame never resizes with the photo */}
        <div className="flex h-[44vh] min-w-0 shrink-0 flex-col bg-slate-900 lg:h-auto lg:min-h-0 lg:flex-1">
          <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center">
            <InventoryImage
              src={activePhoto}
              alt={item.title || 'Inventory photo'}
              displaySize={2400}
              className="h-full w-full object-contain p-2"
            />

            {hasMultiple ? (
              <>
                <NavButton side="left" onClick={() => goTo(activeIndex - 1)} />
                <NavButton side="right" onClick={() => goTo(activeIndex + 1)} />
                <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-slate-900/70 px-3 py-1 text-xs font-medium text-white">
                  {activeIndex + 1} / {photos.length}
                </span>
              </>
            ) : null}

            {!photos.length ? (
              <p className="px-6 py-16 text-sm text-slate-400">No photos available for this site.</p>
            ) : null}
          </div>

          {hasMultiple ? (
            <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-white/10 bg-slate-900/60 p-3">
              {photos.map((photo, index) => (
                <button
                  key={`${photo}-${index}`}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`View photo ${index + 1}`}
                  aria-current={index === activeIndex}
                  className={`h-16 w-20 shrink-0 overflow-hidden rounded-md border-2 transition ${
                    index === activeIndex
                      ? 'border-emerald-400 opacity-100'
                      : 'border-transparent opacity-60 hover:opacity-100'
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

        {/* Details panel */}
        <div className="flex min-h-0 w-full flex-1 flex-col border-t border-slate-200 lg:w-[360px] lg:flex-none lg:border-l lg:border-t-0">
          <div className="border-b border-slate-200 px-5 py-4 pr-14">
            {item.inventoryCode ? (
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{item.inventoryCode}</p>
            ) : null}
            <h3 className="mt-1 truncate text-lg font-semibold leading-tight text-slate-900">{item.title || 'Site details'}</h3>
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <dl className="space-y-3 text-sm">
              <Row label="Location" value={[item.city, item.area].filter(Boolean).join(' / ')} />
              {item.address ? <Row label="Address" value={item.address} /> : null}
              {item.route ? <Row label="Route" value={item.route} /> : null}
              {item.depot ? <Row label="Depot" value={item.depot} /> : null}
              {item.itinerary ? <Row label="Itinerary" value={item.itinerary} /> : null}
              <Row label="Size" value={formatSize(item)} />
              <Row label="Dates" value={`${formatDate(item.startDate)} - ${formatDate(item.endDate)}`} />
              <Row label="Quantity" value={String(item.quantity ?? '-')} />
              {item.unitSellingPrice ? <Row label="Unit price" value={currency(item.unitSellingPrice)} /> : null}
              {item.notes ? <Row label="Notes" value={item.notes} /> : null}
            </dl>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-4">
            <span className="text-sm text-slate-500">Total price</span>
            <span className="text-lg font-semibold text-slate-900">{currency(item.totalSellingPrice || 0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const NavButton = ({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={side === 'left' ? 'Previous photo' : 'Next photo'}
    className={`absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-slate-900/55 text-xl text-white backdrop-blur transition hover:bg-slate-900/80 ${
      side === 'left' ? 'left-3' : 'right-3'
    }`}
  >
    {side === 'left' ? '‹' : '›'}
  </button>
);

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="grid grid-cols-[96px_1fr] gap-3">
    <dt className="text-slate-500">{label}</dt>
    <dd className="font-medium text-slate-800">{value || '-'}</dd>
  </div>
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
