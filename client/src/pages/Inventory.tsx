import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  activateInventory,
  confirmInventory,
  createInventory,
  deactivateInventory,
  getInventory,
  getInventoryCodePreview,
  getInventorySummary,
  importInventory,
  reverseGeocode,
  updateInventory,
  uploadInventoryImages,
} from '../api/inventoryApi';
import InventoryCategoryCard from '../components/inventory/InventoryCategoryCard';
import LocationPicker from '../components/map/LocationPicker';
import {
  INVENTORY_CATEGORIES,
  INVENTORY_CATEGORY_DESCRIPTIONS,
  INVENTORY_CATEGORY_GROUPS,
} from '../constants/inventoryCategories';
import {
  downloadCategoryTemplate,
  downloadCombinedTemplate,
  getImportFieldRows,
  IMPORT_CATEGORY_GROUPS,
  IMPORT_CONDITIONAL_NOTE,
  IMPORT_SUBCATEGORIES,
} from '../constants/inventoryImport';
import type { ImportFieldRequirement } from '../constants/inventoryImport';
import { useAuth } from '../context/AuthContext';
import type {
  AvailabilityStatus,
  CategoryGroup,
  ConfirmationStatus,
  ConfirmInventoryPayload,
  InventoryFilters,
  InventoryImportResult,
  InventoryItem,
  InventoryPayload,
  InventoryStatus,
  InventorySummaryItem,
} from '../types/inventory';

const availabilityStatuses: AvailabilityStatus[] = ['available', 'booked', 'hold', 'unknown'];
const inventoryStatuses: InventoryStatus[] = ['active', 'inactive'];
const confirmationStatuses: ConfirmationStatus[] = ['fresh', 'stale', 'never_confirmed'];

type InventoryFormState = {
  categoryGroup: CategoryGroup;
  subCategory: string;
  title: string;
  city: string;
  area: string;
  address: string;
  latitude: string;
  longitude: string;
  photos: string[];
  ownerName: string;
  ownerPhone: string;
  supplierName: string;
  internalCost: string;
  sellingPrice: string;
  minSpend: string;
  minDurationDays: string;
  availabilityStatus: AvailabilityStatus;
  status: InventoryStatus;
  tagsText: string;
  internalNotes: string;
  width: string;
  height: string;
  illumination: string;
  facingDirection: string;
  trafficDirection: string;
  estimatedTraffic: string;
  loopLengthSeconds: string;
  spotsPerHour: string;
  screenSpecs: string;
  numberOfVehicles: string;
  route: string;
  depot: string;
  brandingType: string;
  ratePerVehiclePerMonth: string;
  operatorName: string;
  itinerary: string;
  operationDays: string;
  hasLedScreen: boolean;
  hasAudioSystem: boolean;
  hasCanopy: boolean;
  ratePerDay: string;
};

type ConfirmFormState = {
  confirmationNote: string;
  availabilityStatus: AvailabilityStatus;
  internalCost: string;
  sellingPrice: string;
};

const createEmptyForm = (categoryGroup: CategoryGroup = 'Outdoor'): InventoryFormState => ({
  categoryGroup,
  subCategory: INVENTORY_CATEGORIES[categoryGroup][0],
  title: '',
  city: '',
  area: '',
  address: '',
  latitude: '',
  longitude: '',
  photos: [],
  ownerName: '',
  ownerPhone: '',
  supplierName: '',
  internalCost: '',
  sellingPrice: '',
  minSpend: '',
  minDurationDays: '',
  availabilityStatus: 'unknown',
  status: 'active',
  tagsText: '',
  internalNotes: '',
  width: '',
  height: '',
  illumination: 'NA',
  facingDirection: '',
  trafficDirection: '',
  estimatedTraffic: '',
  loopLengthSeconds: '',
  spotsPerHour: '',
  screenSpecs: '',
  numberOfVehicles: '',
  route: '',
  depot: '',
  brandingType: '',
  ratePerVehiclePerMonth: '',
  operatorName: '',
  itinerary: '',
  operationDays: '',
  hasLedScreen: false,
  hasAudioSystem: false,
  hasCanopy: false,
  ratePerDay: '',
});

const emptyConfirmForm: ConfirmFormState = {
  confirmationNote: '',
  availabilityStatus: 'available',
  internalCost: '',
  sellingPrice: '',
};

const numberOrUndefined = (value: string) => {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const splitCsv = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const currency = (value?: number) => {
  if (value === undefined) {
    return '-';
  }

  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
    style: 'currency',
    currency: 'INR',
  }).format(value);
};

const labelize = (value: string) => value.replace('_', ' ');

const confirmationBadgeClass = (status: ConfirmationStatus) => {
  if (status === 'fresh') {
    return 'bg-emerald-50 text-emerald-700';
  }

  if (status === 'stale') {
    return 'bg-amber-50 text-amber-700';
  }

  return 'bg-rose-50 text-rose-700';
};

const itemToForm = (item: InventoryItem): InventoryFormState => ({
  ...createEmptyForm(item.categoryGroup),
  categoryGroup: item.categoryGroup,
  subCategory: item.subCategory,
  title: item.title,
  city: item.city,
  area: item.area,
  address: item.location?.address || '',
  latitude: item.location?.latitude?.toString() || '',
  longitude: item.location?.longitude?.toString() || '',
  photos: item.photos || [],
  ownerName: item.ownerName || '',
  ownerPhone: item.ownerPhone || '',
  supplierName: item.supplierName || '',
  internalCost: item.internalCost?.toString() || '',
  sellingPrice: item.sellingPrice?.toString() || '',
  minSpend: item.minSpend?.toString() || '',
  minDurationDays: item.minDurationDays?.toString() || '',
  availabilityStatus: item.availabilityStatus,
  status: item.status,
  tagsText: item.tags?.join(', ') || '',
  internalNotes: item.internalNotes || '',
  width: item.width?.toString() || '',
  height: item.height?.toString() || '',
  illumination: item.illumination || 'NA',
  facingDirection: item.facingDirection || '',
  trafficDirection: item.trafficDirection || '',
  estimatedTraffic: item.estimatedTraffic || '',
  loopLengthSeconds: item.loopLengthSeconds?.toString() || '',
  spotsPerHour: item.spotsPerHour?.toString() || '',
  screenSpecs: item.screenSpecs || '',
  numberOfVehicles: item.numberOfVehicles?.toString() || '',
  route: item.route || '',
  depot: item.depot || '',
  brandingType: item.brandingType || '',
  ratePerVehiclePerMonth: item.ratePerVehiclePerMonth?.toString() || '',
  operatorName: item.operatorName || '',
  itinerary: item.itinerary || '',
  operationDays: item.operationDays?.toString() || '',
  hasLedScreen: Boolean(item.hasLedScreen),
  hasAudioSystem: Boolean(item.hasAudioSystem),
  hasCanopy: Boolean(item.hasCanopy),
  ratePerDay: item.ratePerDay?.toString() || '',
});

const formToPayload = (form: InventoryFormState): InventoryPayload => ({
  categoryGroup: form.categoryGroup,
  subCategory: form.subCategory,
  title: form.title,
  city: form.city,
  area: form.area,
  location:
    form.categoryGroup === 'Outdoor'
      ? {
          address: form.address,
          latitude: numberOrUndefined(form.latitude),
          longitude: numberOrUndefined(form.longitude),
          source: 'map_picker',
        }
      : undefined,
  photos: form.photos,
  ownerName: form.ownerName,
  ownerPhone: form.ownerPhone,
  supplierName: form.supplierName,
  internalCost: numberOrUndefined(form.internalCost),
  sellingPrice: numberOrUndefined(form.sellingPrice),
  minSpend: numberOrUndefined(form.minSpend),
  minDurationDays: numberOrUndefined(form.minDurationDays),
  availabilityStatus: form.availabilityStatus,
  status: form.status,
  tags: splitCsv(form.tagsText),
  internalNotes: form.internalNotes,
  width: numberOrUndefined(form.width),
  height: numberOrUndefined(form.height),
  illumination: form.illumination as InventoryPayload['illumination'],
  facingDirection: form.facingDirection,
  trafficDirection: form.trafficDirection,
  estimatedTraffic: form.estimatedTraffic,
  loopLengthSeconds: numberOrUndefined(form.loopLengthSeconds),
  spotsPerHour: numberOrUndefined(form.spotsPerHour),
  screenSpecs: form.screenSpecs,
  numberOfVehicles: numberOrUndefined(form.numberOfVehicles),
  route: form.route,
  depot: form.depot,
  brandingType: form.brandingType,
  ratePerVehiclePerMonth: numberOrUndefined(form.ratePerVehiclePerMonth),
  operatorName: form.operatorName,
  itinerary: form.itinerary,
  operationDays: numberOrUndefined(form.operationDays),
  hasLedScreen: form.hasLedScreen,
  hasAudioSystem: form.hasAudioSystem,
  hasCanopy: form.hasCanopy,
  ratePerDay: numberOrUndefined(form.ratePerDay),
});

const Inventory = () => {
  const { isAdmin } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<CategoryGroup | null>(null);
  const [summary, setSummary] = useState<InventorySummaryItem[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filters, setFilters] = useState<InventoryFilters>({ page: 1, limit: 20 });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<InventoryFormState>(createEmptyForm());
  const [previewCode, setPreviewCode] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState('');
  const [confirmingItem, setConfirmingItem] = useState<InventoryItem | null>(null);
  const [confirmForm, setConfirmForm] = useState<ConfirmFormState>(emptyConfirmForm);

  const totalSqFt = useMemo(() => {
    const width = numberOrUndefined(form.width);
    const height = numberOrUndefined(form.height);
    return width !== undefined && height !== undefined ? width * height : undefined;
  }, [form.width, form.height]);

  const loadSummary = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await getInventorySummary();
      setSummary(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory summary');
    } finally {
      setLoading(false);
    }
  };

  const loadInventory = async () => {
    if (!selectedCategory) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await getInventory({
        ...filters,
        categoryGroup: selectedCategory,
      });
      setItems(response.data);
      setPagination(response.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCategory) {
      loadInventory();
      return;
    }

    loadSummary();
  }, [selectedCategory, filters]);

  useEffect(() => {
    if (!formOpen || editingItem || !form.categoryGroup || !form.city.trim() || !form.area.trim()) {
      setPreviewCode('');
      return;
    }

    let isCancelled = false;

    const loadPreview = async () => {
      setPreviewLoading(true);

      try {
        const nextPreviewCode = await getInventoryCodePreview({
          categoryGroup: form.categoryGroup,
          city: form.city,
          area: form.area,
        });

        if (!isCancelled) {
          setPreviewCode(nextPreviewCode);
        }
      } catch {
        if (!isCancelled) {
          setPreviewCode('');
        }
      } finally {
        if (!isCancelled) {
          setPreviewLoading(false);
        }
      }
    };

    const timeoutId = window.setTimeout(loadPreview, 300);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [editingItem, form.area, form.categoryGroup, form.city, formOpen]);

  const showOverview = !selectedCategory;

  const refreshCurrentView = async () => {
    if (selectedCategory) {
      await loadInventory();
    } else {
      await loadSummary();
    }
  };

  const openCategory = (categoryGroup: CategoryGroup) => {
    setSelectedCategory(categoryGroup);
    setFilters({ page: 1, limit: 20 });
  };

  const updateFilter = (key: keyof InventoryFilters, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value || undefined,
      page: 1,
    }));
  };

  const openCreateForm = () => {
    const categoryGroup = selectedCategory || 'Outdoor';
    setEditingItem(null);
    setForm(createEmptyForm(categoryGroup));
    setPreviewCode('');
    setGeocodeError('');
    setFormOpen(true);
  };

  const openEditForm = (item: InventoryItem) => {
    setEditingItem(item);
    setForm(itemToForm(item));
    setPreviewCode(item.inventoryCode);
    setGeocodeError('');
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingItem(null);
    setForm(createEmptyForm(selectedCategory || 'Outdoor'));
    setPreviewCode('');
    setGeocodeError('');
  };

  const validateForm = () => {
    if (!form.categoryGroup || !form.subCategory || !form.title.trim()) {
      return 'Category, subcategory, and title are required';
    }

    if (!form.city.trim() || !form.area.trim()) {
      return 'City and area are required';
    }

    if (!form.width.trim() || !form.height.trim()) {
      return 'Width and height are required';
    }

    if (
      form.categoryGroup === 'Outdoor' &&
      (!form.address.trim() || !form.latitude.trim() || !form.longitude.trim())
    ) {
      return 'Outdoor inventory requires address and exact map location';
    }

    if (form.categoryGroup === 'Auto' && !form.numberOfVehicles.trim() && !form.route.trim()) {
      return 'Auto inventory requires number of vehicles or route';
    }

    if (form.categoryGroup === 'Bus' && !form.route.trim() && !form.depot.trim()) {
      return 'Bus inventory requires route or depot';
    }

    if (form.categoryGroup === 'Mobile Van' && !form.itinerary.trim()) {
      return 'Mobile Van inventory requires itinerary';
    }

    return '';
  };

  const handleLocationChange = async (location: { latitude: number; longitude: number }) => {
    setForm((current) => ({
      ...current,
      latitude: String(location.latitude),
      longitude: String(location.longitude),
    }));
    setGeocodeLoading(true);
    setGeocodeError('');

    try {
      const result = await reverseGeocode(location.latitude, location.longitude);

      setForm((current) => ({
        ...current,
        latitude: String(location.latitude),
        longitude: String(location.longitude),
        address: result.address || current.address,
        city: result.city || current.city,
        area: result.area || current.area,
      }));
    } catch {
      setGeocodeError('Reverse geocode failed. You can enter location details manually.');
    } finally {
      setGeocodeLoading(false);
    }
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const validationError = validateForm();

      if (validationError) {
        setError(validationError);
        return;
      }

      const payload = formToPayload(form);

      if (editingItem) {
        await updateInventory(editingItem.id, payload);
      } else {
        await createInventory(payload);
      }

      closeForm();
      await refreshCurrentView();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save inventory');
    } finally {
      setSaving(false);
    }
  };

  const openConfirmModal = (item: InventoryItem) => {
    setConfirmingItem(item);
    setConfirmForm({
      confirmationNote: item.confirmationNote || '',
      availabilityStatus: item.availabilityStatus,
      internalCost: item.internalCost?.toString() || '',
      sellingPrice: item.sellingPrice?.toString() || '',
    });
  };

  const submitConfirmation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!confirmingItem) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload: ConfirmInventoryPayload = {
        confirmationNote: confirmForm.confirmationNote,
        availabilityStatus: confirmForm.availabilityStatus,
        internalCost: numberOrUndefined(confirmForm.internalCost),
        sellingPrice: numberOrUndefined(confirmForm.sellingPrice),
      };

      await confirmInventory(confirmingItem.id, payload);
      setConfirmingItem(null);
      setConfirmForm(emptyConfirmForm);
      await refreshCurrentView();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm inventory');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (item: InventoryItem) => {
    setError('');

    try {
      if (item.status === 'active') {
        await deactivateInventory(item.id);
      } else {
        await activateInventory(item.id);
      }

      await refreshCurrentView();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update inventory status');
    }
  };

  const setFormCategoryGroup = (categoryGroup: CategoryGroup) => {
    setForm((current) => ({
      ...current,
      categoryGroup,
      subCategory: INVENTORY_CATEGORIES[categoryGroup][0],
      address: categoryGroup === 'Outdoor' ? current.address : '',
      latitude: categoryGroup === 'Outdoor' ? current.latitude : '',
      longitude: categoryGroup === 'Outdoor' ? current.longitude : '',
    }));
  };

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Inventory</h1>
            <p className="mt-2 text-slate-600">
              {showOverview
                ? 'Choose a category to manage inventory.'
                : `Manage ${selectedCategory} inventory.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Bulk Import CSV
            </button>
            {!showOverview ? (
              <button
                type="button"
                onClick={openCreateForm}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Add Inventory
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {showOverview ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">Inventory Categories</h2>
            <p className="mt-1 text-sm text-slate-500">
              Select a category to view and manage its inventory.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {INVENTORY_CATEGORY_GROUPS.map((categoryGroup) => {
              const summaryItem = summary.find((item) => item.categoryGroup === categoryGroup);

              return (
                <InventoryCategoryCard
                  key={categoryGroup}
                  categoryGroup={categoryGroup}
                  total={summaryItem?.total || 0}
                  available={summaryItem?.available || 0}
                  stale={summaryItem?.stale || 0}
                  neverConfirmed={summaryItem?.neverConfirmed || 0}
                  description={INVENTORY_CATEGORY_DESCRIPTIONS[categoryGroup]}
                  onClick={() => openCategory(categoryGroup)}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className="text-sm font-medium text-slate-700 hover:text-slate-950"
            >
              Back to Inventory Categories
            </button>

            <div className="mt-4">
              <h2 className="text-base font-semibold text-slate-900">
                {selectedCategory} Subcategories
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <Chip active={!filters.subCategory} onClick={() => updateFilter('subCategory', '')}>
                  All
                </Chip>
                {INVENTORY_CATEGORIES[selectedCategory].map((subCategory) => (
                  <Chip
                    key={subCategory}
                    active={filters.subCategory === subCategory}
                    onClick={() => updateFilter('subCategory', subCategory)}
                  >
                    {subCategory}
                  </Chip>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-5">
            <input
              value={filters.search || ''}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Search inventory"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
            <input
              value={filters.city || ''}
              onChange={(event) => updateFilter('city', event.target.value)}
              placeholder="City"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
            <select
              value={filters.status || ''}
              onChange={(event) => updateFilter('status', event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            >
              <option value="">All statuses</option>
              {inventoryStatuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              value={filters.availabilityStatus || ''}
              onChange={(event) => updateFilter('availabilityStatus', event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            >
              <option value="">All availability</option>
              {availabilityStatuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              value={filters.confirmationStatus || ''}
              onChange={(event) => updateFilter('confirmationStatus', event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            >
              <option value="">All confirmations</option>
              {confirmationStatuses.map((item) => (
                <option key={item} value={item}>
                  {labelize(item)}
                </option>
              ))}
            </select>
          </div>

          <InventoryTable
            isAdmin={isAdmin}
            items={items}
            loading={loading}
            paginationTotal={pagination.total}
            onEdit={openEditForm}
            onConfirm={openConfirmModal}
            onStatusChange={handleStatusChange}
          />
        </>
      )}

      {formOpen ? (
        <InventoryFormModal
          editingItem={editingItem}
          form={form}
          previewCode={previewCode}
          previewLoading={previewLoading}
          totalSqFt={totalSqFt}
          geocodeLoading={geocodeLoading}
          geocodeError={geocodeError}
          saving={saving}
          onClose={closeForm}
          onSubmit={submitForm}
          onFormChange={setForm}
          onCategoryGroupChange={setFormCategoryGroup}
          onLocationChange={handleLocationChange}
        />
      ) : null}

      {confirmingItem ? (
        <ConfirmInventoryModal
          item={confirmingItem}
          form={confirmForm}
          saving={saving}
          onChange={setConfirmForm}
          onClose={() => setConfirmingItem(null)}
          onSubmit={submitConfirmation}
        />
      ) : null}

      {importOpen ? (
        <ImportInventoryModal
          onClose={() => setImportOpen(false)}
          onImported={refreshCurrentView}
        />
      ) : null}
    </section>
  );
};

type ChipProps = {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
};

const Chip = ({ active, children, onClick }: ChipProps) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      'rounded-full border px-3 py-1.5 text-sm font-medium',
      active
        ? 'border-slate-900 bg-slate-900 text-white'
        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100',
    ].join(' ')}
  >
    {children}
  </button>
);

type InventoryTableProps = {
  isAdmin: boolean;
  items: InventoryItem[];
  loading: boolean;
  paginationTotal: number;
  onEdit: (item: InventoryItem) => void;
  onConfirm: (item: InventoryItem) => void;
  onStatusChange: (item: InventoryItem) => void;
};

const InventoryTable = ({
  isAdmin,
  items,
  loading,
  paginationTotal,
  onEdit,
  onConfirm,
  onStatusChange,
}: InventoryTableProps) => (
  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
    {loading ? (
      <p className="p-5 text-sm text-slate-500">Loading inventory...</p>
    ) : items.length === 0 ? (
      <div className="p-8 text-center">
        <p className="font-medium text-slate-900">No inventory found.</p>
        <p className="mt-1 text-sm text-slate-500">Add your first inventory item.</p>
      </div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Subcategory</th>
              <th className="px-4 py-3 font-medium">City</th>
              <th className="px-4 py-3 font-medium">Area</th>
              <th className="px-4 py-3 font-medium">Size</th>
              <th className="px-4 py-3 font-medium">Selling Price</th>
              <th className="px-4 py-3 font-medium">Availability</th>
              <th className="px-4 py-3 font-medium">Confirmation</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-4 font-medium text-slate-900">{item.inventoryCode}</td>
                <td className="min-w-56 px-4 py-4 text-slate-700">{item.title}</td>
                <td className="px-4 py-4 text-slate-600">{item.categoryGroup}</td>
                <td className="px-4 py-4 text-slate-600">{item.subCategory}</td>
                <td className="px-4 py-4 text-slate-600">{item.city}</td>
                <td className="px-4 py-4 text-slate-600">{item.area}</td>
                <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                  {item.width && item.height
                    ? `${item.width} x ${item.height} = ${item.totalSqFt || item.width * item.height} sq.ft.`
                    : '-'}
                </td>
                <td className="px-4 py-4 text-slate-600">{currency(item.sellingPrice)}</td>
                <td className="px-4 py-4 capitalize text-slate-600">{item.availabilityStatus}</td>
                <td className="px-4 py-4">
                  <span
                    className={[
                      'whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium capitalize',
                      confirmationBadgeClass(item.confirmationStatus),
                    ].join(' ')}
                  >
                    {labelize(item.confirmationStatus)}
                  </span>
                </td>
                <td className="px-4 py-4 capitalize text-slate-600">{item.status}</td>
                <td className="px-4 py-4">
                  <div className="flex gap-2">
                    <ActionButton onClick={() => onEdit(item)}>View/Edit</ActionButton>
                    <ActionButton onClick={() => onConfirm(item)}>Confirm</ActionButton>
                    {isAdmin ? (
                      <ActionButton onClick={() => onStatusChange(item)}>
                        {item.status === 'active' ? 'Deactivate' : 'Activate'}
                      </ActionButton>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

    <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
      Showing {items.length} of {paginationTotal} inventory items.
    </p>
  </div>
);

type ActionButtonProps = {
  children: ReactNode;
  onClick: () => void;
};

const ActionButton = ({ children, onClick }: ActionButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
  >
    {children}
  </button>
);

type InventoryFormModalProps = {
  editingItem: InventoryItem | null;
  form: InventoryFormState;
  previewCode: string;
  previewLoading: boolean;
  totalSqFt?: number;
  geocodeLoading: boolean;
  geocodeError: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFormChange: (form: InventoryFormState) => void;
  onCategoryGroupChange: (categoryGroup: CategoryGroup) => void;
  onLocationChange: (location: { latitude: number; longitude: number }) => void;
};

const InventoryFormModal = ({
  editingItem,
  form,
  previewCode,
  previewLoading,
  totalSqFt,
  geocodeLoading,
  geocodeError,
  saving,
  onClose,
  onSubmit,
  onFormChange,
  onCategoryGroupChange,
  onLocationChange,
}: InventoryFormModalProps) => (
  <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/40 px-4 py-8">
    <div className="mx-auto max-w-5xl overflow-hidden rounded-lg bg-white p-6 shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">
            {editingItem ? 'Edit Inventory' : 'Add Inventory'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">Fill the inventory details.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
        >
          Close
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-6">
        <FormSection title="1. Category">
          <SelectField
            label="Category"
            value={form.categoryGroup}
            options={INVENTORY_CATEGORY_GROUPS}
            onChange={(value) => onCategoryGroupChange(value as CategoryGroup)}
          />
          <SelectField
            label="Subcategory"
            value={form.subCategory}
            options={INVENTORY_CATEGORIES[form.categoryGroup]}
            onChange={(value) => onFormChange({ ...form, subCategory: value })}
          />
          <TextField
            label="Title"
            value={form.title}
            onChange={(value) => onFormChange({ ...form, title: value })}
            required
          />
        </FormSection>

        <FormSection title="2. City and Area">
          <TextField
            label="City"
            value={form.city}
            onChange={(value) => onFormChange({ ...form, city: value })}
            required
          />
          <TextField
            label="Area"
            value={form.area}
            onChange={(value) => onFormChange({ ...form, area: value })}
            required
          />
          <ReadOnlyField
            label="Inventory Code Preview"
            value={
              editingItem
                ? editingItem.inventoryCode
                : previewLoading
                  ? 'Loading...'
                  : previewCode || 'Fill category, city, and area'
            }
            helper="Final code will be generated automatically on save."
          />
        </FormSection>

        {form.categoryGroup === 'Outdoor' ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <h3 className="mb-3 font-semibold text-slate-900">3. Outdoor Location</h3>
            <LocationPicker
              latitude={numberOrUndefined(form.latitude)}
              longitude={numberOrUndefined(form.longitude)}
              onChange={onLocationChange}
            />
            {geocodeLoading ? <p className="mt-2 text-xs text-slate-500">Looking up address...</p> : null}
            {geocodeError ? <p className="mt-2 text-xs text-amber-700">{geocodeError}</p> : null}
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <TextField
                label="Address"
                value={form.address}
                onChange={(value) => onFormChange({ ...form, address: value })}
                required
              />
              <TextField
                label="Latitude"
                value={form.latitude}
                onChange={(value) => onFormChange({ ...form, latitude: value })}
                required
              />
              <TextField
                label="Longitude"
                value={form.longitude}
                onChange={(value) => onFormChange({ ...form, longitude: value })}
                required
              />
            </div>
          </div>
        ) : null}

        <FormSection title="Common Details">
          <TextField
            label="Width"
            value={form.width}
            onChange={(value) => onFormChange({ ...form, width: value })}
            required
          />
          <TextField
            label="Height"
            value={form.height}
            onChange={(value) => onFormChange({ ...form, height: value })}
            required
          />
          <ReadOnlyField
            label="Total Sq.Ft."
            value={totalSqFt !== undefined ? `${totalSqFt} sq.ft.` : 'Enter width and height'}
          />
          <TextField label="Internal Cost" value={form.internalCost} onChange={(value) => onFormChange({ ...form, internalCost: value })} />
          <TextField label="Selling Price" value={form.sellingPrice} onChange={(value) => onFormChange({ ...form, sellingPrice: value })} />
          <TextField label="Min Spend" value={form.minSpend} onChange={(value) => onFormChange({ ...form, minSpend: value })} />
          <TextField label="Min Duration Days" value={form.minDurationDays} onChange={(value) => onFormChange({ ...form, minDurationDays: value })} />
          <SelectField label="Availability" value={form.availabilityStatus} options={availabilityStatuses} onChange={(value) => onFormChange({ ...form, availabilityStatus: value as AvailabilityStatus })} />
          <SelectField label="Status" value={form.status} options={inventoryStatuses} onChange={(value) => onFormChange({ ...form, status: value as InventoryStatus })} />
          <TextField label="Owner Name" value={form.ownerName} onChange={(value) => onFormChange({ ...form, ownerName: value })} />
          <TextField label="Owner Phone" value={form.ownerPhone} onChange={(value) => onFormChange({ ...form, ownerPhone: value })} />
          <TextField label="Supplier Name" value={form.supplierName} onChange={(value) => onFormChange({ ...form, supplierName: value })} />
          <ImageUploadField label="Photos" value={form.photos} onChange={(photos) => onFormChange({ ...form, photos })} />
          <TextField label="Tags" value={form.tagsText} onChange={(value) => onFormChange({ ...form, tagsText: value })} />
          <TextField label="Internal Notes" value={form.internalNotes} onChange={(value) => onFormChange({ ...form, internalNotes: value })} />
        </FormSection>

        {form.categoryGroup === 'Outdoor' ? (
          <FormSection title="Outdoor Details">
            <SelectField label="Illumination" value={form.illumination} options={['Lit', 'Non-lit', 'Backlit', 'Frontlit', 'NA']} onChange={(value) => onFormChange({ ...form, illumination: value })} />
            <TextField label="Facing Direction" value={form.facingDirection} onChange={(value) => onFormChange({ ...form, facingDirection: value })} />
            <TextField label="Traffic Direction" value={form.trafficDirection} onChange={(value) => onFormChange({ ...form, trafficDirection: value })} />
            <TextField label="Estimated Traffic" value={form.estimatedTraffic} onChange={(value) => onFormChange({ ...form, estimatedTraffic: value })} />
            <TextField label="Loop Length Seconds" value={form.loopLengthSeconds} onChange={(value) => onFormChange({ ...form, loopLengthSeconds: value })} />
            <TextField label="Spots Per Hour" value={form.spotsPerHour} onChange={(value) => onFormChange({ ...form, spotsPerHour: value })} />
            <TextField label="Screen Specs" value={form.screenSpecs} onChange={(value) => onFormChange({ ...form, screenSpecs: value })} />
          </FormSection>
        ) : null}

        {form.categoryGroup === 'Auto' ? (
          <FormSection title="Auto Details">
            <TextField label="Number Of Vehicles" value={form.numberOfVehicles} onChange={(value) => onFormChange({ ...form, numberOfVehicles: value })} />
            <TextField label="Route" value={form.route} onChange={(value) => onFormChange({ ...form, route: value })} />
            <TextField label="Branding Type" value={form.brandingType} onChange={(value) => onFormChange({ ...form, brandingType: value })} />
            <TextField label="Rate Per Vehicle / Month" value={form.ratePerVehiclePerMonth} onChange={(value) => onFormChange({ ...form, ratePerVehiclePerMonth: value })} />
            <TextField label="Operator Name" value={form.operatorName} onChange={(value) => onFormChange({ ...form, operatorName: value })} />
          </FormSection>
        ) : null}

        {form.categoryGroup === 'Bus' ? (
          <FormSection title="Bus Details">
            <TextField label="Number Of Vehicles" value={form.numberOfVehicles} onChange={(value) => onFormChange({ ...form, numberOfVehicles: value })} />
            <TextField label="Route" value={form.route} onChange={(value) => onFormChange({ ...form, route: value })} />
            <TextField label="Depot" value={form.depot} onChange={(value) => onFormChange({ ...form, depot: value })} />
            <TextField label="Branding Type" value={form.brandingType} onChange={(value) => onFormChange({ ...form, brandingType: value })} />
            <TextField label="Rate Per Vehicle / Month" value={form.ratePerVehiclePerMonth} onChange={(value) => onFormChange({ ...form, ratePerVehiclePerMonth: value })} />
            <TextField label="Operator Name" value={form.operatorName} onChange={(value) => onFormChange({ ...form, operatorName: value })} />
          </FormSection>
        ) : null}

        {form.categoryGroup === 'Mobile Van' ? (
          <FormSection title="Mobile Van Details">
            <TextField label="Itinerary" value={form.itinerary} onChange={(value) => onFormChange({ ...form, itinerary: value })} required />
            <TextField label="Operation Days" value={form.operationDays} onChange={(value) => onFormChange({ ...form, operationDays: value })} />
            <CheckboxField label="LED Screen" checked={form.hasLedScreen} onChange={(value) => onFormChange({ ...form, hasLedScreen: value })} />
            <CheckboxField label="Audio System" checked={form.hasAudioSystem} onChange={(value) => onFormChange({ ...form, hasAudioSystem: value })} />
            <CheckboxField label="Canopy" checked={form.hasCanopy} onChange={(value) => onFormChange({ ...form, hasCanopy: value })} />
            <TextField label="Rate Per Day" value={form.ratePerDay} onChange={(value) => onFormChange({ ...form, ratePerDay: value })} />
          </FormSection>
        ) : null}

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400">
            {saving ? 'Saving...' : 'Save Inventory'}
          </button>
        </div>
      </form>
    </div>
  </div>
);

type ConfirmInventoryModalProps = {
  item: InventoryItem;
  form: ConfirmFormState;
  saving: boolean;
  onChange: (form: ConfirmFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

const ConfirmInventoryModal = ({
  item,
  form,
  saving,
  onChange,
  onClose,
  onSubmit,
}: ConfirmInventoryModalProps) => (
  <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 px-4">
    <form onSubmit={onSubmit} className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
      <h2 className="text-xl font-semibold">Confirm Inventory</h2>
      <p className="mt-1 text-sm text-slate-500">{item.title}</p>

      <div className="mt-5 space-y-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
        <TextField label="Confirmation Note" value={form.confirmationNote} onChange={(value) => onChange({ ...form, confirmationNote: value })} />
        <SelectField label="Availability" value={form.availabilityStatus} options={availabilityStatuses} onChange={(value) => onChange({ ...form, availabilityStatus: value as AvailabilityStatus })} />
        <TextField label="Internal Cost" value={form.internalCost} onChange={(value) => onChange({ ...form, internalCost: value })} />
        <TextField label="Selling Price" value={form.sellingPrice} onChange={(value) => onChange({ ...form, sellingPrice: value })} />
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400">
          {saving ? 'Confirming...' : 'Confirm'}
        </button>
      </div>
    </form>
  </div>
);

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
};

const TextField = ({ label, value, onChange, required }: TextFieldProps) => (
  <label className="block">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
    />
  </label>
);

type ImageUploadFieldProps = {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
};

const ImageUploadField = ({ label, value, onChange }: ImageUploadFieldProps) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) {
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const urls = await uploadInventoryImages(Array.from(fileList));
      onChange([...value, ...urls]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (url: string) => {
    onChange(value.filter((item) => item !== url));
  };

  return (
    <div className="md:col-span-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1 flex flex-wrap gap-3">
        {value.map((url) => (
          <div key={url} className="group relative h-24 w-24 overflow-hidden rounded-md border border-slate-300">
            <img src={url} alt="Inventory" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removePhoto(url)}
              className="absolute right-1 top-1 hidden rounded-full bg-slate-900/80 px-1.5 text-xs text-white group-hover:block"
              aria-label="Remove photo"
            >
              ✕
            </button>
          </div>
        ))}
        <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-slate-300 text-center text-xs text-slate-500 hover:border-slate-900 hover:text-slate-700">
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={uploading}
            onChange={(event) => {
              void handleFiles(event.target.files);
              event.target.value = '';
            }}
            className="hidden"
          />
          {uploading ? 'Uploading...' : '+ Add image'}
        </label>
      </div>
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : null}
    </div>
  );
};

type SelectFieldProps = {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
};

const SelectField = ({ label, value, options, onChange }: SelectFieldProps) => (
  <label className="block">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  </label>
);

type ReadOnlyFieldProps = {
  label: string;
  value: string;
  helper?: string;
};

const ReadOnlyField = ({ label, value, helper }: ReadOnlyFieldProps) => (
  <label className="block">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    <input
      value={value}
      readOnly
      className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none"
    />
    {helper ? <span className="mt-1 block text-xs text-slate-500">{helper}</span> : null}
  </label>
);

type CheckboxFieldProps = {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
};

const CheckboxField = ({ label, checked, onChange }: CheckboxFieldProps) => (
  <label className="flex items-center gap-2 self-end rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4"
    />
    {label}
  </label>
);

type FormSectionProps = {
  title: string;
  children: ReactNode;
};

const FormSection = ({ title, children }: FormSectionProps) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
    <h3 className="mb-3 font-semibold text-slate-900">{title}</h3>
    <div className="grid gap-4 md:grid-cols-3">{children}</div>
  </div>
);

type ImportInventoryModalProps = {
  onClose: () => void;
  onImported: () => Promise<void> | void;
};

const requirementBadge: Record<ImportFieldRequirement, { label: string; className: string }> = {
  required: { label: 'Required', className: 'bg-rose-50 text-rose-700' },
  conditional: { label: 'Conditional', className: 'bg-amber-50 text-amber-700' },
  optional: { label: 'Optional', className: 'bg-slate-100 text-slate-600' },
};

const ImportInventoryModal = ({ onClose, onImported }: ImportInventoryModalProps) => {
  const [guideGroup, setGuideGroup] = useState<CategoryGroup>('Outdoor');
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<InventoryImportResult | null>(null);

  const fieldRows = getImportFieldRows(guideGroup);
  const conditionalNote = IMPORT_CONDITIONAL_NOTE[guideGroup];

  const handleImport = async () => {
    if (!file) {
      return;
    }

    setImporting(true);
    setError('');
    setResult(null);

    try {
      const importResult = await importInventory(file);
      setResult(importResult);

      if (importResult.created > 0) {
        await onImported();
      }
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/40 px-4 py-8">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Bulk Import Inventory</h2>
            <p className="mt-1 text-sm text-slate-500">
              Pick a category to see its fields, download a ready-to-fill template, then upload it.
              Each row becomes one inventory item with an auto-generated code.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
          >
            Close
          </button>
        </div>

        <div className="mt-5 space-y-5">
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-900">
              Step 1 — Choose a category
            </p>
            <div className="flex flex-wrap gap-2">
              {IMPORT_CATEGORY_GROUPS.map((group) => (
                <button
                  key={group}
                  type="button"
                  onClick={() => setGuideGroup(group)}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                    guideGroup === group
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {group}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">Valid sub categories:</span>{' '}
                {IMPORT_SUBCATEGORIES[guideGroup].join(', ')}
              </p>
              {conditionalNote ? (
                <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  {conditionalNote}
                </p>
              ) : null}
            </div>

            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-2 font-medium">Column</th>
                    <th className="px-4 py-2 font-medium">Need</th>
                    <th className="px-4 py-2 font-medium">Accepted values</th>
                    <th className="px-4 py-2 font-medium">Example</th>
                  </tr>
                </thead>
                <tbody>
                  {fieldRows.map((row) => {
                    const badge = requirementBadge[row.requirement];

                    return (
                      <tr key={row.name} className="border-b border-slate-100 align-top">
                        <td className="px-4 py-2">
                          <span className="font-mono text-xs text-slate-900">{row.name}</span>
                          <span className="block text-xs text-slate-500">{row.label}</span>
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate-600">{row.valueHint}</td>
                        <td className="px-4 py-2 text-slate-500">{row.example || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-4 py-3">
              <button
                type="button"
                onClick={() => downloadCategoryTemplate(guideGroup)}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Download {guideGroup} template
              </button>
              <button
                type="button"
                onClick={downloadCombinedTemplate}
                className="text-sm font-medium text-slate-700 underline"
              >
                Download template with all categories
              </button>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-700">Format tips</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>Keep the header row exactly as in the template; column order can vary.</li>
              <li>
                Multi-value fields (<code>photos</code>, <code>tags</code>) use <code>|</code> to
                separate values.
              </li>
              <li>Enum fields must match the accepted values exactly (case-sensitive).</li>
              <li>Leave a cell empty to skip an optional field. You can mix categories in one file.</li>
            </ul>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-900">Step 2 — Upload your file</p>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setResult(null);
                setError('');
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </div>

          {error ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {result ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-4 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm">
                <span className="text-slate-600">
                  Processed: <span className="font-semibold text-slate-900">{result.total}</span>
                </span>
                <span className="text-emerald-700">
                  Created: <span className="font-semibold">{result.created}</span>
                </span>
                <span className="text-rose-700">
                  Failed: <span className="font-semibold">{result.failed}</span>
                </span>
              </div>

              {result.errors.length > 0 ? (
                <div className="max-h-48 overflow-y-auto rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  <ul className="space-y-1">
                    {result.errors.map((rowError) => (
                      <li key={rowError.row}>
                        <span className="font-medium">Row {rowError.row}:</span> {rowError.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-emerald-700">All rows imported successfully.</p>
              )}
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            {result ? 'Done' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!file || importing}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
          >
            {importing ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Inventory;
