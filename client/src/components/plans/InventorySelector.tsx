import { useEffect, useState } from 'react';

import { getInventory } from '../../api/inventoryApi';
import {
  INVENTORY_CATEGORIES,
  INVENTORY_CATEGORY_GROUPS,
} from '../../constants/inventoryCategories';
import type { InventoryItem } from '../../types/inventory';

const InventorySelector = ({
  selectedIds,
  onAdd,
}: {
  selectedIds: string[];
  onAdd: (inventory: InventoryItem) => void;
}) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [categoryGroup, setCategoryGroup] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [availabilityStatus, setAvailabilityStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const subCategories = categoryGroup
    ? INVENTORY_CATEGORIES[categoryGroup as keyof typeof INVENTORY_CATEGORIES]
    : [...new Set(Object.values(INVENTORY_CATEGORIES).flat())];

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await getInventory({
          search,
          categoryGroup,
          subCategory,
          city,
          area,
          availabilityStatus,
          status: 'active',
          confirmationStatus: 'fresh',
          page: 1,
          limit: 100,
        });
        if (!cancelled) {
          setItems(
            response.data.filter(
              (item) =>
                item.status === 'active' &&
                item.confirmationStatus === 'fresh' &&
                ['available', 'hold'].includes(item.availabilityStatus),
            ),
          );
        }
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [area, availabilityStatus, categoryGroup, city, search, subCategory]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-4">
        <h3 className="font-semibold">Inventory Selection</h3>
        <p className="mt-1 text-xs text-slate-500">
          Only active, recently confirmed inventory can be added to plans.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-6">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search inventory" className={input} />
          <select
            value={categoryGroup}
            onChange={(event) => {
              setCategoryGroup(event.target.value);
              setSubCategory('');
            }}
            className={input}
          >
            <option value="">All categories</option>
            {INVENTORY_CATEGORY_GROUPS.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={subCategory} onChange={(event) => setSubCategory(event.target.value)} className={input}>
            <option value="">All subcategories</option>
            {subCategories.map((item) => <option key={item}>{item}</option>)}
          </select>
          <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="City" className={input} />
          <input value={area} onChange={(event) => setArea(event.target.value)} placeholder="Area" className={input} />
          <select value={availabilityStatus} onChange={(event) => setAvailabilityStatus(event.target.value)} className={input}>
            <option value="">Available or hold</option>
            <option value="available">Available</option>
            <option value="hold">Hold</option>
          </select>
        </div>
      </div>
      {loading ? <p className="p-4 text-sm text-slate-500">Loading confirmed inventory...</p> : (
        <div className="max-h-80 overflow-auto">
          <table className="hidden w-full text-left text-sm md:table">
            <thead className="sticky top-0 bg-slate-50 text-slate-500"><tr>{['Code', 'Title', 'Category', 'City / Area', 'Size', 'Selling Price', 'Add'].map((heading) => <th key={heading} className="px-3 py-2 font-medium">{heading}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const selected = selectedIds.includes(item.id);
                return <tr key={item.id}><td className="px-3 py-3 font-medium">{item.inventoryCode}</td><td className="px-3 py-3">{item.title}</td><td className="px-3 py-3 text-slate-600">{item.categoryGroup} / {item.subCategory}</td><td className="px-3 py-3 text-slate-600">{item.city} / {item.area}</td><td className="px-3 py-3 text-slate-600">{item.width && item.height ? `${item.width} x ${item.height}` : '-'}</td><td className="px-3 py-3 text-slate-600">{formatCurrency(item.sellingPrice)}</td><td className="px-3 py-3"><button type="button" disabled={selected} onClick={() => onAdd(item)} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:bg-slate-300">{selected ? 'Added' : 'Add'}</button></td></tr>;
              })}
            </tbody>
          </table>
          <div className="divide-y divide-slate-100 md:hidden">
            {items.map((item) => {
              const selected = selectedIds.includes(item.id);
              return (
                <article key={item.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-emerald-700">{item.inventoryCode}</p>
                      <h4 className="mt-1 font-semibold text-slate-900">{item.title}</h4>
                      <p className="mt-1 text-xs text-slate-500">{item.subCategory} · {item.city} / {item.area}</p>
                    </div>
                    <button type="button" disabled={selected} onClick={() => onAdd(item)} className="shrink-0 rounded-md bg-emerald-800 px-3 py-2 text-xs font-medium text-white disabled:bg-slate-300">
                      {selected ? 'Added' : 'Add'}
                    </button>
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-800">{formatCurrency(item.sellingPrice)}</p>
                </article>
              );
            })}
          </div>
          {!items.length ? <p className="p-5 text-center text-sm text-slate-500">No fresh inventory matches these filters.</p> : null}
        </div>
      )}
    </section>
  );
};

const formatCurrency = (value?: number) => value === undefined ? '-' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
const input = 'rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900';

export default InventorySelector;
