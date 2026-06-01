import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  activateInventory,
  confirmInventory,
  createInventory,
  deactivateInventory,
  getInventory,
  getInventoryCodePreview,
  reverseGeocode,
  updateInventory,
} from '../api/inventoryApi';
import LocationPicker from '../components/map/LocationPicker';
import { useAuth } from '../context/AuthContext';
import type {
  AvailabilityStatus,
  ConfirmationStatus,
  ConfirmInventoryPayload,
  InventoryCategory,
  InventoryFilters,
  InventoryItem,
  InventoryPayload,
  InventoryStatus,
} from '../types/inventory';

const categories: InventoryCategory[] = ['OOH', 'DOOH', 'Auto', 'Bus', 'Mobile Van'];
const availabilityStatuses: AvailabilityStatus[] = ['available', 'booked', 'hold', 'unknown'];
const inventoryStatuses: InventoryStatus[] = ['active', 'inactive'];
const confirmationStatuses: ConfirmationStatus[] = ['fresh', 'stale', 'never_confirmed'];

type InventoryFormState = {
  inventoryCode: string;
  category: InventoryCategory;
  subType: string;
  title: string;
  city: string;
  area: string;
  address: string;
  latitude: string;
  longitude: string;
  photosText: string;
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

const emptyForm: InventoryFormState = {
  inventoryCode: '',
  category: 'OOH',
  subType: '',
  title: '',
  city: '',
  area: '',
  address: '',
  latitude: '',
  longitude: '',
  photosText: '',
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
};

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

const confirmationBadgeClass = (status: ConfirmationStatus) => {
  if (status === 'fresh') {
    return 'bg-emerald-50 text-emerald-700';
  }

  if (status === 'stale') {
    return 'bg-amber-50 text-amber-700';
  }

  return 'bg-rose-50 text-rose-700';
};

const labelize = (value: string) => value.replace('_', ' ');

const itemToForm = (item: InventoryItem): InventoryFormState => ({
  ...emptyForm,
  inventoryCode: item.inventoryCode,
  category: item.category,
  subType: item.subType || '',
  title: item.title,
  city: item.city,
  area: item.area || '',
  address: item.location?.address || '',
  latitude: item.location?.latitude?.toString() || '',
  longitude: item.location?.longitude?.toString() || '',
  photosText: item.photos?.join(', ') || '',
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
  category: form.category,
  subType: form.subType,
  title: form.title,
  city: form.city,
  area: form.area,
  location: {
    address: form.address,
    latitude: numberOrUndefined(form.latitude),
    longitude: numberOrUndefined(form.longitude),
    city: form.city,
    area: form.area,
    source:
      numberOrUndefined(form.latitude) !== undefined && numberOrUndefined(form.longitude) !== undefined
        ? 'map_picker'
        : 'manual',
  },
  photos: splitCsv(form.photosText),
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
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filters, setFilters] = useState<InventoryFilters>({ page: 1, limit: 20 });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<InventoryFormState>(emptyForm);
  const [previewCode, setPreviewCode] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState('');
  const [confirmingItem, setConfirmingItem] = useState<InventoryItem | null>(null);
  const [confirmForm, setConfirmForm] = useState<ConfirmFormState>(emptyConfirmForm);

  const category = form.category;
  const showOutdoorFields = category === 'OOH' || category === 'DOOH';
  const showVehicleFields = category === 'Auto' || category === 'Bus';
  const showMobileVanFields = category === 'Mobile Van';

  const filterParams = useMemo(() => filters, [filters]);

  const loadInventory = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await getInventory(filterParams);
      setItems(response.data);
      setPagination(response.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [filterParams]);

  useEffect(() => {
    if (!formOpen || editingItem || !form.category || !form.city.trim() || !form.area.trim()) {
      setPreviewCode('');
      return;
    }

    let isCancelled = false;

    const loadPreview = async () => {
      setPreviewLoading(true);

      try {
        const nextPreviewCode = await getInventoryCodePreview({
          category: form.category,
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
  }, [editingItem, form.area, form.category, form.city, formOpen]);

  const updateFilter = (key: keyof InventoryFilters, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value || undefined,
      page: 1,
    }));
  };

  const openCreateForm = () => {
    setEditingItem(null);
    setForm(emptyForm);
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
    setForm(emptyForm);
    setPreviewCode('');
    setGeocodeError('');
  };

  const validateForm = () => {
    if (!form.title.trim() || !form.city.trim() || !form.area.trim()) {
      return 'Title, city, and area are required';
    }

    if ((form.category === 'OOH' || form.category === 'DOOH') && (!form.latitude || !form.longitude)) {
      return 'Please pick an exact map location for OOH and DOOH inventory';
    }

    if (form.category === 'Auto' && !form.numberOfVehicles.trim() && !form.route.trim()) {
      return 'Auto inventory requires number of vehicles or route';
    }

    if (form.category === 'Bus' && !form.route.trim() && !form.depot.trim()) {
      return 'Bus inventory requires route or depot';
    }

    if (form.category === 'Mobile Van' && !form.itinerary.trim()) {
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
      await loadInventory();
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
      await loadInventory();
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

      await loadInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update inventory status');
    }
  };

  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="mt-2 text-slate-600">Manage media inventory and reconfirm availability.</p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Add Inventory
        </button>
      </div>

      {error ? (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-5">
        <input
          value={filters.search || ''}
          onChange={(event) => updateFilter('search', event.target.value)}
          placeholder="Search inventory"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
        <select
          value={filters.category || ''}
          onChange={(event) => updateFilter('category', event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        >
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
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

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
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
                  <th className="px-4 py-3 font-medium">City</th>
                  <th className="px-4 py-3 font-medium">Area</th>
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
                    <td className="px-4 py-4 text-slate-600">{item.category}</td>
                    <td className="px-4 py-4 text-slate-600">{item.city}</td>
                    <td className="px-4 py-4 text-slate-600">{item.area || '-'}</td>
                    <td className="px-4 py-4 text-slate-600">{currency(item.sellingPrice)}</td>
                    <td className="px-4 py-4 capitalize text-slate-600">
                      {item.availabilityStatus}
                    </td>
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
                        <button
                          type="button"
                          onClick={() => openEditForm(item)}
                          className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          View/Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => openConfirmModal(item)}
                          className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Confirm
                        </button>
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(item)}
                            className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            {item.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-3 text-sm text-slate-500">
        Showing {items.length} of {pagination.total} inventory items.
      </p>

      {formOpen ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/40 px-4 py-8">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">
                  {editingItem ? 'Edit Inventory' : 'Add Inventory'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">Fill the core inventory fields.</p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                Close
              </button>
            </div>

            <form onSubmit={submitForm} className="mt-6 space-y-6">
              <div>
                <h3 className="mb-3 font-semibold text-slate-900">1. Category</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <SelectField label="Category" value={form.category} options={categories} onChange={(value) => setForm({ ...form, category: value as InventoryCategory })} />
                  <TextField label="Title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} required />
                  <TextField label="Sub Type" value={form.subType} onChange={(value) => setForm({ ...form, subType: value })} />
                </div>
              </div>

              <div>
                <h3 className="mb-3 font-semibold text-slate-900">
                  {showOutdoorFields ? '2. Pick Exact Site Location' : '2. Optional Base Location / Depot Pin'}
                </h3>
                <LocationPicker
                  compact={!showOutdoorFields}
                  latitude={numberOrUndefined(form.latitude)}
                  longitude={numberOrUndefined(form.longitude)}
                  onChange={handleLocationChange}
                />
                {geocodeLoading ? (
                  <p className="mt-2 text-xs text-slate-500">Looking up address...</p>
                ) : null}
                {geocodeError ? (
                  <p className="mt-2 text-xs text-amber-700">{geocodeError}</p>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <ReadOnlyField
                  label="Inventory Code Preview"
                  value={
                    editingItem
                      ? form.inventoryCode
                      : previewLoading
                        ? 'Loading...'
                        : previewCode || 'Fill category, city, and area'
                  }
                  helper="Final code will be generated automatically on save."
                />
                <TextField label="City" value={form.city} onChange={(value) => setForm({ ...form, city: value })} required />
                <TextField label="Area" value={form.area} onChange={(value) => setForm({ ...form, area: value })} required />
                <TextField label="Address" value={form.address} onChange={(value) => setForm({ ...form, address: value })} />
                <TextField label="Latitude" value={form.latitude} onChange={(value) => setForm({ ...form, latitude: value })} />
                <TextField label="Longitude" value={form.longitude} onChange={(value) => setForm({ ...form, longitude: value })} />
                <TextField label="Owner Name" value={form.ownerName} onChange={(value) => setForm({ ...form, ownerName: value })} />
                <TextField label="Owner Phone" value={form.ownerPhone} onChange={(value) => setForm({ ...form, ownerPhone: value })} />
                <TextField label="Supplier Name" value={form.supplierName} onChange={(value) => setForm({ ...form, supplierName: value })} />
                <TextField label="Internal Cost" value={form.internalCost} onChange={(value) => setForm({ ...form, internalCost: value })} />
                <TextField label="Selling Price" value={form.sellingPrice} onChange={(value) => setForm({ ...form, sellingPrice: value })} />
                <TextField label="Min Spend" value={form.minSpend} onChange={(value) => setForm({ ...form, minSpend: value })} />
                <TextField label="Min Duration Days" value={form.minDurationDays} onChange={(value) => setForm({ ...form, minDurationDays: value })} />
                <SelectField label="Availability" value={form.availabilityStatus} options={availabilityStatuses} onChange={(value) => setForm({ ...form, availabilityStatus: value as AvailabilityStatus })} />
                <SelectField label="Status" value={form.status} options={inventoryStatuses} onChange={(value) => setForm({ ...form, status: value as InventoryStatus })} />
                <TextField label="Photo URLs" value={form.photosText} onChange={(value) => setForm({ ...form, photosText: value })} />
                <TextField label="Tags" value={form.tagsText} onChange={(value) => setForm({ ...form, tagsText: value })} />
                <TextField label="Internal Notes" value={form.internalNotes} onChange={(value) => setForm({ ...form, internalNotes: value })} />
              </div>

              {showOutdoorFields ? (
                <FormSection title="OOH / DOOH">
                  <TextField label="Width" value={form.width} onChange={(value) => setForm({ ...form, width: value })} />
                  <TextField label="Height" value={form.height} onChange={(value) => setForm({ ...form, height: value })} />
                  <SelectField label="Illumination" value={form.illumination} options={['Lit', 'Non-lit', 'Backlit', 'Frontlit', 'NA']} onChange={(value) => setForm({ ...form, illumination: value })} />
                  <TextField label="Facing Direction" value={form.facingDirection} onChange={(value) => setForm({ ...form, facingDirection: value })} />
                  <TextField label="Traffic Direction" value={form.trafficDirection} onChange={(value) => setForm({ ...form, trafficDirection: value })} />
                  <TextField label="Estimated Traffic" value={form.estimatedTraffic} onChange={(value) => setForm({ ...form, estimatedTraffic: value })} />
                  <TextField label="Loop Length Seconds" value={form.loopLengthSeconds} onChange={(value) => setForm({ ...form, loopLengthSeconds: value })} />
                  <TextField label="Spots Per Hour" value={form.spotsPerHour} onChange={(value) => setForm({ ...form, spotsPerHour: value })} />
                  <TextField label="Screen Specs" value={form.screenSpecs} onChange={(value) => setForm({ ...form, screenSpecs: value })} />
                </FormSection>
              ) : null}

              {showVehicleFields ? (
                <FormSection title="Auto / Bus">
                  <TextField label="Number Of Vehicles" value={form.numberOfVehicles} onChange={(value) => setForm({ ...form, numberOfVehicles: value })} />
                  <TextField label="Route" value={form.route} onChange={(value) => setForm({ ...form, route: value })} />
                  <TextField label="Depot" value={form.depot} onChange={(value) => setForm({ ...form, depot: value })} />
                  <TextField label="Branding Type" value={form.brandingType} onChange={(value) => setForm({ ...form, brandingType: value })} />
                  <TextField label="Rate Per Vehicle / Month" value={form.ratePerVehiclePerMonth} onChange={(value) => setForm({ ...form, ratePerVehiclePerMonth: value })} />
                  <TextField label="Operator Name" value={form.operatorName} onChange={(value) => setForm({ ...form, operatorName: value })} />
                </FormSection>
              ) : null}

              {showMobileVanFields ? (
                <FormSection title="Mobile Van">
                  <TextField label="Itinerary" value={form.itinerary} onChange={(value) => setForm({ ...form, itinerary: value })} />
                  <TextField label="Operation Days" value={form.operationDays} onChange={(value) => setForm({ ...form, operationDays: value })} />
                  <CheckboxField label="LED Screen" checked={form.hasLedScreen} onChange={(value) => setForm({ ...form, hasLedScreen: value })} />
                  <CheckboxField label="Audio System" checked={form.hasAudioSystem} onChange={(value) => setForm({ ...form, hasAudioSystem: value })} />
                  <CheckboxField label="Canopy" checked={form.hasCanopy} onChange={(value) => setForm({ ...form, hasCanopy: value })} />
                  <TextField label="Rate Per Day" value={form.ratePerDay} onChange={(value) => setForm({ ...form, ratePerDay: value })} />
                </FormSection>
              ) : null}

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button type="button" onClick={closeForm} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400">
                  {saving ? 'Saving...' : 'Save Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {confirmingItem ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 px-4">
          <form onSubmit={submitConfirmation} className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-xl font-semibold">Confirm Inventory</h2>
            <p className="mt-1 text-sm text-slate-500">{confirmingItem.title}</p>

            <div className="mt-5 space-y-4">
              <TextField label="Confirmation Note" value={confirmForm.confirmationNote} onChange={(value) => setConfirmForm({ ...confirmForm, confirmationNote: value })} />
              <SelectField label="Availability" value={confirmForm.availabilityStatus} options={availabilityStatuses} onChange={(value) => setConfirmForm({ ...confirmForm, availabilityStatus: value as AvailabilityStatus })} />
              <TextField label="Internal Cost" value={confirmForm.internalCost} onChange={(value) => setConfirmForm({ ...confirmForm, internalCost: value })} />
              <TextField label="Selling Price" value={confirmForm.sellingPrice} onChange={(value) => setConfirmForm({ ...confirmForm, sellingPrice: value })} />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmingItem(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400">
                {saving ? 'Confirming...' : 'Confirm'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
};

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
  <div>
    <h3 className="mb-3 font-semibold text-slate-900">{title}</h3>
    <div className="grid gap-4 md:grid-cols-3">{children}</div>
  </div>
);

export default Inventory;
