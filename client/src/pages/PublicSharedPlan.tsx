import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { getPublicShare, PublicShareError } from '../api/shareApi';
import PlanItemDetailModal, { type PlanItemDetail } from '../components/maps/PlanItemDetailModal';
import SharedPlanMap from '../components/maps/SharedPlanMap';
import Pagination from '../components/ui/Pagination';
import type { PublicSharedPlan as PublicSharedPlanData } from '../types/share';
import InventoryImage from '../components/ui/InventoryImage';

const ALL_CITIES = 'all';
const ALL_AREAS = 'all';
const PAGE_SIZE = 12;

type PublicPlanItem = PublicSharedPlanData['plan']['items'][number];
type FilterableItem = PlanItemDetail & {
  city?: string;
  area?: string;
  categoryGroup?: string;
  subCategory?: string;
  width?: number;
  height?: number;
  totalSqFt?: number;
  totalSellingPrice?: number;
};
type ViewMode = 'grid' | 'map';
type SortMode = 'recommended' | 'price-low' | 'price-high' | 'title';

const pendingRequests = new Map<string, Promise<PublicSharedPlanData>>();

const loadPublicShare = (token: string) => {
  const existing = pendingRequests.get(token);
  if (existing) return existing;

  const request = getPublicShare(token);
  pendingRequests.set(token, request);
  window.setTimeout(() => pendingRequests.delete(token), 1000);
  return request;
};

const PublicSharedPlan = () => {
  const { token = '' } = useParams();
  const [data, setData] = useState<PublicSharedPlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [cityFilter, setCityFilter] = useState<string>(ALL_CITIES);
  const [areaFilter, setAreaFilter] = useState<string>(ALL_AREAS);
  const [categoryFilters, setCategoryFilters] = useState<Set<string>>(new Set());
  const [subCategoryFilters, setSubCategoryFilters] = useState<Set<string>>(new Set());
  const [dimensionFilters, setDimensionFilters] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortMode, setSortMode] = useState<SortMode>('recommended');
  const [selectedItem, setSelectedItem] = useState<PlanItemDetail | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadPublicShare(token)
      .then((response) => {
        if (!cancelled) {
          setData(response);
          setError(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError({
          status: err instanceof PublicShareError ? err.status : 500,
          message: err instanceof Error ? err.message : 'Unable to open this shared plan',
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const allFilterItems = useMemo<FilterableItem[]>(() => {
    if (!data) return [];
    // mapItems / nonMapItems are derived subsets of plan.items, so including
    // them here would double-count those categories in the filter options.
    return data.plan.items;
  }, [data]);

  const cities = useMemo(() => uniqueSorted(allFilterItems.map((item) => item.city)), [allFilterItems]);

  const matchesCity = (city?: string) => cityFilter === ALL_CITIES || city?.trim() === cityFilter;
  const matchesArea = (area?: string) => areaFilter === ALL_AREAS || area?.trim() === areaFilter;
  const matchesSet = (value: string | undefined, filters: Set<string>) =>
    !filters.size || (value ? filters.has(value.trim()) : false);
  const matchesDimension = (item: FilterableItem) => {
    if (!dimensionFilters.size) return true;
    const dimension = dimensionLabel(item);
    return Boolean(dimension) && dimensionFilters.has(dimension);
  };

  const areas = useMemo(() => {
    return uniqueSorted(allFilterItems.filter((item) => matchesCity(item.city)).map((item) => item.area));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFilterItems, cityFilter]);

  const categoryOptions = useMemo(
    () => optionCounts(allFilterItems.filter((item) => matchesCity(item.city) && matchesArea(item.area)), 'categoryGroup'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allFilterItems, cityFilter, areaFilter],
  );

  const subCategoryOptions = useMemo(
    () => optionCounts(allFilterItems.filter((item) => matchesCity(item.city) && matchesArea(item.area)), 'subCategory'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allFilterItems, cityFilter, areaFilter],
  );

  const dimensionOptions = useMemo(() => {
    const scopedItems = allFilterItems.filter((item) => matchesCity(item.city) && matchesArea(item.area));
    const counts = new Map<string, number>();
    scopedItems.forEach((item) => {
      const dimension = dimensionLabel(item);
      if (dimension) counts.set(dimension, (counts.get(dimension) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFilterItems, cityFilter, areaFilter]);

  const matchesFilters = (item: FilterableItem) =>
    matchesCity(item.city) &&
    matchesArea(item.area) &&
    matchesSet(item.categoryGroup, categoryFilters) &&
    matchesSet(item.subCategory, subCategoryFilters) &&
    matchesDimension(item);

  const filteredPlanItems = useMemo(() => {
    const items = (data?.plan.items || []).filter(matchesFilters);
    return sortItems(items, sortMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, cityFilter, areaFilter, categoryFilters, subCategoryFilters, dimensionFilters, sortMode]);

  const mapItems = useMemo(
    () => (data?.mapItems || []).filter(matchesFilters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, cityFilter, areaFilter, categoryFilters, subCategoryFilters, dimensionFilters],
  );

  const nonMapItems = useMemo(
    () => (data?.nonMapItems || []).filter(matchesFilters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, cityFilter, areaFilter, categoryFilters, subCategoryFilters, dimensionFilters],
  );

  useEffect(() => {
    setAreaFilter(ALL_AREAS);
  }, [cityFilter]);

  useEffect(() => {
    setPage(1);
  }, [cityFilter, areaFilter, categoryFilters, subCategoryFilters, dimensionFilters, sortMode, viewMode]);

  const totalPages = Math.max(1, Math.ceil(filteredPlanItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pagedItems = filteredPlanItems.slice(pageStart, pageStart + PAGE_SIZE);
  const activeFilterCount =
    (cityFilter !== ALL_CITIES ? 1 : 0) +
    (areaFilter !== ALL_AREAS ? 1 : 0) +
    categoryFilters.size +
    subCategoryFilters.size +
    dimensionFilters.size;

  const clearFilters = () => {
    setCityFilter(ALL_CITIES);
    setAreaFilter(ALL_AREAS);
    setCategoryFilters(new Set());
    setSubCategoryFilters(new Set());
    setDimensionFilters(new Set());
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f2] text-slate-600">
        Loading shared plan...
      </main>
    );
  }

  if (error || !data) {
    const expired = error?.status === 410;
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f2] px-5">
        <div className="w-full max-w-lg border-t-4 border-emerald-700 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-bold tracking-wide text-emerald-700">CONEKT ADS</p>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">
            {expired ? 'This plan link has expired' : 'Shared plan not found'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {expired
              ? 'Please contact the Conekt Ads team for a new link.'
              : 'This link may be invalid or may have been disabled.'}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f7f2] text-slate-900">
      <header className="border-b border-emerald-900/10 bg-[#173f35] text-white">
        <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-100">Conekt Ads</p>
              <h1 className="mt-3 max-w-4xl break-words text-2xl font-semibold leading-tight sm:text-4xl">
                {data.campaign.title}
              </h1>
              <p className="mt-2 break-words text-sm text-emerald-50 sm:text-base">{data.campaign.clientName}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm lg:w-[390px]">
              <HeroStat label="Media" value={String(data.plan.items.length)} />
              <HeroStat label="Plan" value={data.plan.versionLabel} />
              <HeroStat label="Status" value={data.plan.status} />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-0 lg:grid-cols-[286px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-white lg:min-h-[calc(100vh-116px)] lg:border-b-0 lg:border-r lg:border-slate-200">
          <div className="lg:sticky lg:top-0">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6 lg:px-5">
              <div>
                <h2 className="text-lg font-semibold">Filters</h2>
                <p className="mt-0.5 text-xs text-slate-500">{activeFilterCount || 'No'} active</p>
              </div>
              {activeFilterCount ? (
                <button type="button" onClick={clearFilters} className="text-sm font-medium text-emerald-700 hover:text-emerald-900">
                  Clear
                </button>
              ) : null}
            </div>

            <div className="max-h-none overflow-visible lg:max-h-[calc(100vh-72px)] lg:overflow-y-auto">
              <FilterSection title="Location">
                <label className="block text-xs font-semibold text-slate-500" htmlFor="city-filter">City</label>
                <select
                  id="city-filter"
                  value={cityFilter}
                  onChange={(event) => setCityFilter(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                >
                  <option value={ALL_CITIES}>All cities</option>
                  {cities.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>

                <label className="mt-4 block text-xs font-semibold text-slate-500" htmlFor="area-filter">Area</label>
                <select
                  id="area-filter"
                  value={areaFilter}
                  onChange={(event) => setAreaFilter(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                >
                  <option value={ALL_AREAS}>All areas</option>
                  {areas.map((area) => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
              </FilterSection>

              <FilterSection title="Ad Options">
                <CheckboxList options={categoryOptions} selected={categoryFilters} onChange={setCategoryFilters} />
              </FilterSection>

              <FilterSection title="Media Type">
                <CheckboxList options={subCategoryOptions} selected={subCategoryFilters} onChange={setSubCategoryFilters} />
              </FilterSection>

              <FilterSection title="Dimensions">
                <CheckboxList options={dimensionOptions} selected={dimensionFilters} onChange={setDimensionFilters} />
              </FilterSection>

              <section className="border-b border-slate-200 px-4 py-5 sm:px-6 lg:px-5">
                <h3 className="text-sm font-semibold uppercase text-slate-700">Pricing Summary</h3>
                <dl className="mt-4 space-y-3 text-sm">
                  <Price label="Subtotal" value={data.plan.pricing.subtotal} />
                  <Price label={`Tax (${data.plan.pricing.taxPercentage}%)`} value={data.plan.pricing.taxAmount} />
                  <div className="flex items-start justify-between gap-4 border-t-2 border-emerald-600 pt-4 text-base font-semibold">
                    <dt className="min-w-0">Grand Total</dt>
                    <dd className="shrink-0 text-right">{currency(data.plan.pricing.grandTotal)}</dd>
                  </div>
                </dl>
              </section>
            </div>
          </div>
        </aside>

        <div className="min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
                <span className="font-medium text-emerald-700">Home</span>
                <span className="px-2 text-slate-300">/</span>
                <span>Outdoor</span>
              </nav>
              <h2 className="mt-2 break-words text-2xl font-semibold text-slate-950 sm:text-3xl">Outdoor Advertising Agency</h2>
              <p className="mt-2 max-w-4xl whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                {data.campaign.brief || 'No campaign brief provided.'}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:shrink-0">
              <div className="inline-flex w-full rounded-md border border-slate-300 bg-white p-1 sm:w-auto" aria-label="View mode">
                <ViewButton active={viewMode === 'grid'} label="Grid" icon="▦" onClick={() => setViewMode('grid')} />
                <ViewButton active={viewMode === 'map'} label="Map" icon="⌖" onClick={() => setViewMode('map')} />
              </div>
              <label className="flex items-center gap-2 rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm text-slate-600">
                <span className="shrink-0 font-medium">Sort by</span>
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as SortMode)}
                  className="min-w-0 bg-transparent font-semibold text-slate-900 outline-none"
                >
                  <option value="recommended">Recommended</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="title">Title</option>
                </select>
              </label>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              <span className="font-semibold text-slate-900">{filteredPlanItems.length}</span> selected media
              {mapItems.length ? <span> · {mapItems.length} mapped</span> : null}
              {nonMapItems.length ? <span> · {nonMapItems.length} transit/mobile</span> : null}
            </p>
            {activeFilterCount ? (
              <div className="flex flex-wrap gap-2">
                {cityFilter !== ALL_CITIES ? <ActiveFilter label={cityFilter} onClear={() => setCityFilter(ALL_CITIES)} /> : null}
                {areaFilter !== ALL_AREAS ? <ActiveFilter label={areaFilter} onClear={() => setAreaFilter(ALL_AREAS)} /> : null}
                {[...categoryFilters].map((value) => (
                  <ActiveFilter key={`category-${value}`} label={value} onClear={() => toggleSetValue(categoryFilters, value, setCategoryFilters)} />
                ))}
                {[...subCategoryFilters].map((value) => (
                  <ActiveFilter key={`sub-${value}`} label={value} onClear={() => toggleSetValue(subCategoryFilters, value, setSubCategoryFilters)} />
                ))}
                {[...dimensionFilters].map((value) => (
                  <ActiveFilter key={`dimension-${value}`} label={value} onClear={() => toggleSetValue(dimensionFilters, value, setDimensionFilters)} />
                ))}
              </div>
            ) : null}
          </div>

          {viewMode === 'map' ? (
            <section className="mt-5">
              <SharedPlanMap mapItems={mapItems} shareToken={token} publicMode />
              {nonMapItems.length ? (
                <div className="mt-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold">Transit and Mobile Inventory</h3>
                    <span className="text-sm text-slate-500">{nonMapItems.length} items</span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {nonMapItems.map((item) => (
                      <InventoryCard key={item.planItemId} item={item} onSelect={() => setSelectedItem(item)} />
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : (
            <section className="mt-5">
              {filteredPlanItems.length ? (
                <>
                  <div className="grid gap-x-6 gap-y-9 md:grid-cols-2 xl:grid-cols-3">
                    {pagedItems.map((item, index) => (
                      <InventoryCard
                        key={`${item.title}-${pageStart + index}`}
                        item={item}
                        onSelect={() => setSelectedItem(item)}
                      />
                    ))}
                  </div>
                  {filteredPlanItems.length > PAGE_SIZE ? (
                    <div className="mt-7 overflow-hidden rounded-md border border-slate-200 bg-white">
                      <Pagination
                        page={currentPage}
                        totalPages={totalPages}
                        rangeStart={pageStart + 1}
                        rangeEnd={pageStart + pagedItems.length}
                        total={filteredPlanItems.length}
                        onChange={setPage}
                        label="media"
                      />
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                  <h3 className="text-base font-semibold text-slate-900">
                    {data.plan.items.length ? 'No media items match these filters.' : 'No media items included.'}
                  </h3>
                  {activeFilterCount ? (
                    <button type="button" onClick={clearFilters} className="mt-3 text-sm font-medium text-emerald-700 hover:text-emerald-900">
                      Clear filters
                    </button>
                  ) : null}
                </div>
              )}
            </section>
          )}

          <section className="mt-8 grid gap-6 border-t border-slate-200 pt-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">Client Notes</h2>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                {data.plan.clientNotes || 'No additional notes.'}
              </p>
            </div>
            <div className="min-w-0 border-l-4 border-emerald-700 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="font-semibold">Plan Snapshot</h2>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <PublicItemInfo label="Version" value={data.plan.versionLabel} />
                <PublicItemInfo label="Status" value={data.plan.status} />
                <PublicItemInfo label="Items" value={String(data.plan.items.length)} />
                <PublicItemInfo label="Total" value={currency(data.plan.pricing.grandTotal)} strong />
              </dl>
            </div>
          </section>

          <footer className="border-t border-slate-200 py-5 text-center text-xs text-slate-500">
            This shared plan is read-only.
          </footer>
        </div>
      </div>

      <PlanItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
    </main>
  );
};

const HeroStat = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 rounded-md border border-white/15 bg-white/10 px-3 py-2">
    <dt className="text-xs text-emerald-100">{label}</dt>
    <dd className="mt-0.5 truncate text-sm font-semibold text-white">{value}</dd>
  </div>
);

const FilterSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="border-b border-slate-200 px-4 py-5 sm:px-6 lg:px-5">
    <h3 className="text-sm font-semibold uppercase text-slate-700">{title}</h3>
    <div className="mt-4">{children}</div>
  </section>
);

const CheckboxList = ({
  options,
  selected,
  onChange,
}: {
  options: { label: string; count: number }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) => {
  if (!options.length) return <p className="text-sm text-slate-400">No options</p>;

  return (
    <div className="space-y-3">
      {options.map((option) => (
        <label key={option.label} className="flex min-w-0 items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={selected.has(option.label)}
            onChange={() => toggleSetValue(selected, option.label, onChange)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
          />
          <span className="min-w-0 flex-1 break-words">{option.label}</span>
          <span className="shrink-0 text-xs text-slate-400">({option.count})</span>
        </label>
      ))}
    </div>
  );
};

const ViewButton = ({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`inline-flex flex-1 items-center justify-center gap-2 rounded px-3 py-1.5 text-sm font-semibold transition sm:flex-none ${
      active ? 'bg-emerald-800 text-white shadow-sm' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'
    }`}
  >
    <span aria-hidden="true">{icon}</span>
    {label}
  </button>
);

const ActiveFilter = ({ label, onClear }: { label: string; onClear: () => void }) => (
  <span className="inline-flex max-w-[14rem] items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
    <span className="truncate">{label}</span>
    <button type="button" onClick={onClear} aria-label={`Remove ${label}`} className="text-sm leading-none text-emerald-700 hover:text-emerald-950">
      ×
    </button>
  </span>
);

const InventoryCard = ({ item, onSelect }: { item: PlanItemDetail; onSelect: () => void }) => {
  const location = [item.city, item.area].filter(Boolean).join(', ');
  const subtitle = [item.categoryGroup, item.subCategory].filter(Boolean).join(' / ');
  const photoCount = item.photos?.length || (item.photoUrl ? 1 : 0);

  return (
    <article
      className="group min-w-0 cursor-pointer"
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-slate-100 shadow-sm transition group-hover:border-emerald-400 group-hover:shadow-md">
        <InventoryImage
          src={item.photoUrl}
          alt={item.title || 'Outdoor inventory'}
          displaySize={1200}
          className="aspect-[16/9] w-full object-cover transition duration-300 group-hover:scale-[1.02]"
        />
        {item.subCategory ? (
          <span className="absolute left-3 top-3 max-w-[70%] truncate rounded-full bg-slate-950/70 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
            {item.subCategory}
          </span>
        ) : null}
        {photoCount > 1 ? (
          <span className="absolute bottom-3 right-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm">
            {photoCount} photos
          </span>
        ) : null}
      </div>
      <div className="px-2 pt-4">
        <p className="text-xs font-semibold uppercase text-emerald-700">{item.inventoryCode || subtitle || 'Media'}</p>
        <h3 className="mt-1 line-clamp-2 break-words text-lg font-semibold leading-snug text-slate-950 group-hover:text-emerald-900">
          {item.title || 'Untitled media'}
        </h3>
        <p className="mt-2 line-clamp-2 min-h-10 break-words text-sm leading-5 text-slate-600">{location || item.address || 'Location unavailable'}</p>
        <dl className="mt-4 grid gap-2 text-sm text-slate-700">
          <CardMetric icon="●" label="Size" value={formatSize(item)} />
          <CardMetric icon="◆" label="Spend" value={currency(item.totalSellingPrice || 0)} strong />
        </dl>
      </div>
    </article>
  );
};

const CardMetric = ({
  icon,
  label,
  value,
  strong,
}: {
  icon: string;
  label: string;
  value: string;
  strong?: boolean;
}) => (
  <div className="flex min-w-0 items-center gap-2">
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[10px] text-emerald-700" aria-hidden="true">
      {icon}
    </span>
    <span className="sr-only">{label}</span>
    <span className={`min-w-0 break-words ${strong ? 'font-semibold text-slate-950' : 'text-slate-700'}`}>{value}</span>
  </div>
);

const Price = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-start justify-between gap-4">
    <dt className="min-w-0 text-slate-600">{label}</dt>
    <dd className="shrink-0 text-right font-medium">{currency(value)}</dd>
  </div>
);

const PublicItemInfo = ({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) => (
  <div className="min-w-0">
    <dt className="text-xs text-slate-500">{label}</dt>
    <dd className={`mt-0.5 break-words ${strong ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{value}</dd>
  </div>
);

const toggleSetValue = (selected: Set<string>, value: string, onChange: (next: Set<string>) => void) => {
  const next = new Set(selected);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  onChange(next);
};

const uniqueSorted = (values: Array<string | undefined>) =>
  Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))).sort((a, b) =>
    a.localeCompare(b),
  );

const optionCounts = (items: FilterableItem[], key: 'categoryGroup' | 'subCategory') => {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const value = item[key]?.trim();
    if (value) counts.set(value, (counts.get(value) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
};

const sortItems = (items: PublicPlanItem[], sortMode: SortMode) => {
  const sorted = [...items];
  if (sortMode === 'price-low') return sorted.sort((a, b) => (a.totalSellingPrice || 0) - (b.totalSellingPrice || 0));
  if (sortMode === 'price-high') return sorted.sort((a, b) => (b.totalSellingPrice || 0) - (a.totalSellingPrice || 0));
  if (sortMode === 'title') return sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  return sorted;
};

const currency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(value))
    : '-';

const dimensionLabel = (item: FilterableItem) => {
  if (item.width && item.height) return `${item.width}W x ${item.height}H`;
  if (item.totalSqFt) return `${item.totalSqFt} sq ft`;
  return '';
};

const formatSize = (item: PlanItemDetail) => {
  if (item.width && item.height) return `${item.width} x ${item.height} ft`;
  if (item.totalSqFt) return `${item.totalSqFt} sq ft`;
  return 'Size on request';
};

export default PublicSharedPlan;
