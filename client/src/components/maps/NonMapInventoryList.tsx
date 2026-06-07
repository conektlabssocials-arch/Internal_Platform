import type { NonMapPlanItem } from '../../types/share';

const categoryOrder = ['Auto', 'Bus', 'Mobile Van'];

const NonMapInventoryList = ({ items }: { items: NonMapPlanItem[] }) => {
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
                <article key={item.planItemId} className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-900">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.subCategory} · {item.city} / {item.area}</p>
                    </div>
                    <p className="whitespace-nowrap text-sm font-semibold">{currency(item.totalSellingPrice)}</p>
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
