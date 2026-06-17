import type { NonMapPlanItem } from '../../types/share';
import InventoryImage from '../ui/InventoryImage';

const categoryOrder = ['Auto', 'Bus', 'Mobile Van'];

const NonMapInventoryList = ({
  items,
  onSelect,
}: {
  items: NonMapPlanItem[];
  onSelect?: (item: NonMapPlanItem) => void;
}) => {
  if (!items.length) return null;

  return (
    <div className="space-y-5">
      {categoryOrder.map((category) => {
        const categoryItems = items.filter((item) => item.categoryGroup === category);
        if (!categoryItems.length) return null;
        return (
          <section key={category}>
            <h3 className="text-sm font-semibold text-emerald-800">{category}</h3>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              {categoryItems.map((item) => (
                <article
                  key={item.planItemId}
                  className={`rounded-md border border-slate-200 bg-white p-4 ${
                    onSelect ? 'cursor-pointer transition hover:border-emerald-400 hover:shadow-sm' : ''
                  }`}
                  onClick={onSelect ? () => onSelect(item) : undefined}
                  role={onSelect ? 'button' : undefined}
                  tabIndex={onSelect ? 0 : undefined}
                  onKeyDown={
                    onSelect
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onSelect(item);
                          }
                        }
                      : undefined
                  }
                >
                  <InventoryImage
                    src={item.photoUrl}
                    alt={item.title || 'Inventory'}
                    className="mb-3 h-40 w-full rounded-md object-cover sm:h-32"
                  />
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 break-words">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500 break-words">{item.subCategory} · {item.city} / {item.area}</p>
                    </div>
                    <p className="shrink-0 text-base font-semibold sm:text-sm">{currency(item.totalSellingPrice)}</p>
                  </div>
                  <div className="mt-3 grid gap-1 text-xs text-slate-600">
                    {item.route ? <p><span className="font-medium">Route:</span> {item.route}</p> : null}
                    {item.depot ? <p><span className="font-medium">Depot:</span> {item.depot}</p> : null}
                    {item.itinerary ? <p><span className="font-medium">Itinerary:</span> {item.itinerary}</p> : null}
                    <p><span className="font-medium">Size:</span> {formatSize(item)}</p>
                    <p><span className="font-medium">Dates:</span> {formatDate(item.startDate)} - {formatDate(item.endDate)}</p>
                    <p><span className="font-medium">Quantity:</span> {item.quantity}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};

const currency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const formatDate = (value?: string) =>
  value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '-';
const formatSize = (item: NonMapPlanItem) =>
  item.width && item.height ? `${item.width} x ${item.height} ft` : item.totalSqFt ? `${item.totalSqFt} sq ft` : '-';

export default NonMapInventoryList;
