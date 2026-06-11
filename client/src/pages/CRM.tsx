import { useEffect, useState } from 'react';

import {
  activateContact,
  activateCrmEntity,
  createContact,
  createCrmEntity,
  deactivateContact,
  deactivateCrmEntity,
  deleteContact,
  getCrmEntities,
  getCrmEntityById,
  getCrmSummary,
  updateContact,
  updateCrmEntity,
} from '../api/crmApi';
import ContactForm from '../components/crm/ContactForm';
import CrmEntityDetail from '../components/crm/CrmEntityDetail';
import CrmEntityForm from '../components/crm/CrmEntityForm';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PageHeader from '../components/ui/PageHeader';
import { useAuth } from '../context/AuthContext';
import type {
  Contact,
  ContactPayload,
  CrmEntity,
  CrmEntityPayload,
  CrmEntityType,
  CrmFilters,
} from '../types/crm';

const categories: {
  type: CrmEntityType;
  label: string;
  description: string;
}[] = [
  {
    type: 'Brand',
    label: 'Brands',
    description: 'Direct clients who buy campaigns from Conekt Ads.',
  },
  {
    type: 'Agency',
    label: 'Agencies',
    description: 'Agencies buying media on behalf of brands.',
  },
  {
    type: 'Individual',
    label: 'Individuals',
    description: 'Small advertisers and one-off clients.',
  },
  {
    type: 'SupplierOwner',
    label: 'Suppliers / Owners',
    description:
      'Inventory owners and media suppliers linked to outdoor, auto, bus and mobile van assets.',
  },
];

type CategorySummary = {
  total: number;
  active: number;
  inactive: number;
};

const CRM = () => {
  const { isAdmin, can } = useAuth();
  const canManage = can('crm.manage');
  const [selectedType, setSelectedType] = useState<CrmEntityType | null>(null);
  const [summaries, setSummaries] = useState<Record<string, CategorySummary>>({});
  const [entities, setEntities] = useState<CrmEntity[]>([]);
  const [filters, setFilters] = useState<CrmFilters>({ page: 1, limit: 20 });
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<CrmEntity | null>(null);
  const [detailEntity, setDetailEntity] = useState<CrmEntity | null>(null);
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [statusEntity, setStatusEntity] = useState<CrmEntity | null>(null);

  const loadSummary = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await getCrmSummary();
      setSummaries(
        Object.fromEntries(
          result.map((item) => [
            item.entityType,
            { total: item.total, active: item.active, inactive: item.inactive },
          ]),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CRM summary');
    } finally {
      setLoading(false);
    }
  };

  const loadEntities = async () => {
    if (!selectedType) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await getCrmEntities({ ...filters, entityType: selectedType });
      setEntities(response.data);
      setPagination({
        total: response.pagination.total,
        page: response.pagination.page,
        totalPages: response.pagination.totalPages,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CRM records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedType) {
      loadEntities();
    } else {
      loadSummary();
    }
  }, [selectedType, filters]);

  const updateFilter = (key: keyof CrmFilters, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value || undefined,
      page: 1,
    }));
  };

  const setPage = (page: number) => {
    setFilters((current) => ({ ...current, page }));
  };

  const openCategory = (entityType: CrmEntityType) => {
    setSelectedType(entityType);
    setFilters({ page: 1, limit: 20 });
  };

  const openCreate = () => {
    setEditingEntity(null);
    setFormOpen(true);
  };

  const saveEntity = async (payload: CrmEntityPayload) => {
    setSaving(true);
    setError('');

    try {
      if (editingEntity) {
        await updateCrmEntity(editingEntity.id, payload);
      } else {
        await createCrmEntity(payload);
      }
      setFormOpen(false);
      setEditingEntity(null);
      await loadEntities();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save CRM record');
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (entity: CrmEntity) => {
    setLoading(true);
    setError('');

    try {
      setDetailEntity(await getCrmEntityById(entity.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CRM record');
    } finally {
      setLoading(false);
    }
  };

  const refreshDetail = async () => {
    if (detailEntity) {
      setDetailEntity(await getCrmEntityById(detailEntity.id));
    }
  };

  const toggleEntity = async (entity: CrmEntity) => {
    setError('');

    try {
      if (entity.status === 'active') {
        await deactivateCrmEntity(entity.id);
      } else {
        await activateCrmEntity(entity.id);
      }
      await loadEntities();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update CRM status');
    }
  };

  const saveContact = async (payload: ContactPayload) => {
    if (!detailEntity) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (editingContact) {
        await updateContact(editingContact.id, payload);
      } else {
        await createContact(detailEntity.id, payload);
      }
      setContactFormOpen(false);
      setEditingContact(null);
      await refreshDetail();
      await loadEntities();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save contact');
    } finally {
      setSaving(false);
    }
  };

  const toggleContact = async (contact: Contact) => {
    try {
      if (contact.status === 'active') {
        await deactivateContact(contact.id);
      } else {
        await activateContact(contact.id);
      }
      await refreshDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update contact');
    }
  };

  const removeContact = async (contact: Contact) => {
    if (!window.confirm(`Delete ${contact.name}?`)) {
      return;
    }

    try {
      await deleteContact(contact.id);
      await refreshDetail();
      await loadEntities();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete contact');
    }
  };

  const selectedCategory = categories.find((category) => category.type === selectedType);

  return (
    <section className="space-y-6">
      <PageHeader
        title="CRM"
        eyebrow="Clients and partners"
        description={
          selectedCategory
            ? `Manage ${selectedCategory.label.toLowerCase()} and their contacts.`
            : 'Manage clients, agencies, advertisers, suppliers, and contacts.'
        }
        actions={
          selectedType && canManage ? (
            <button type="button" onClick={openCreate} className={primaryButtonClass}>
              Add {selectedCategory?.label}
            </button>
          ) : null
        }
      />

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!selectedType ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-4">
            <h2 className="font-semibold text-slate-900">CRM Categories</h2>
            <p className="mt-1 text-sm text-slate-500">Choose a category to view its records.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <article key={category.type} className="flex flex-col rounded-lg border border-slate-200 bg-white p-5">
                <h3 className="text-lg font-semibold text-slate-950">{category.label}</h3>
                <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{category.description}</p>
                <dl className="mt-5 grid grid-cols-3 gap-2">
                  <Metric label="Total" value={summaries[category.type]?.total || 0} />
                  <Metric label="Active" value={summaries[category.type]?.active || 0} />
                  <Metric label="Inactive" value={summaries[category.type]?.inactive || 0} />
                </dl>
                <button type="button" onClick={() => openCategory(category.type)} className={`${primaryButtonClass} mt-5 w-full`}>
                  View {category.label}
                </button>
              </article>
            ))}
          </div>
          {loading ? <p className="mt-4 text-sm text-slate-500">Loading CRM summary...</p> : null}
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <button type="button" onClick={() => setSelectedType(null)} className="text-sm font-medium text-slate-700 hover:text-slate-950">
              Back to CRM Categories
            </button>
            <h2 className="mt-4 text-base font-semibold text-slate-900">{selectedCategory?.label}</h2>
            <p className="mt-1 text-sm text-slate-500">{selectedCategory?.description}</p>
          </div>

          <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-4">
            <input value={filters.search || ''} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search" className={inputClass} />
            <input value={filters.city || ''} onChange={(event) => updateFilter('city', event.target.value)} placeholder="City" className={inputClass} />
            <select value={filters.status || ''} onChange={(event) => updateFilter('status', event.target.value)} className={inputClass}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <input value={filters.tag || ''} onChange={(event) => updateFilter('tag', event.target.value)} placeholder="Tag" className={inputClass} />
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {loading ? (
              <p className="p-5 text-sm text-slate-500">Loading CRM records...</p>
            ) : entities.length === 0 ? (
              <div className="p-8 text-center">
                <p className="font-medium text-slate-900">No CRM records found.</p>
                <p className="mt-1 text-sm text-slate-500">Add the first record in this category.</p>
              </div>
            ) : (
              <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Phone</th>
                      <th className="px-4 py-3 font-medium">City</th>
                      <th className="px-4 py-3 font-medium">Primary Contact</th>
                      <th className="px-4 py-3 font-medium">Tags</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {entities.map((entity) => (
                      <tr key={entity.id}>
                        <td className="px-4 py-4 font-medium text-slate-900">{entity.displayName || entity.name}</td>
                        <td className="px-4 py-4 text-slate-600">{entity.email || '-'}</td>
                        <td className="px-4 py-4 text-slate-600">{entity.phone || '-'}</td>
                        <td className="px-4 py-4 text-slate-600">{entity.address?.city || '-'}</td>
                        <td className="px-4 py-4 text-slate-600">{entity.primaryContact?.name || '-'}</td>
                        <td className="max-w-48 px-4 py-4 text-slate-600">{entity.tags.join(', ') || '-'}</td>
                        <td className="px-4 py-4"><StatusBadge status={entity.status} /></td>
                        <td className="px-4 py-4">
                          <div className="flex gap-2">
                            <button type="button" onClick={() => openDetail(entity)} className={smallButtonClass}>{canManage ? 'View / Edit' : 'View'}</button>
                            {isAdmin ? (
                              <button type="button" onClick={() => setStatusEntity(entity)} className={smallButtonClass}>
                                {entity.status === 'active' ? 'Deactivate' : 'Activate'}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-slate-100 md:hidden">
                {entities.map((entity) => (
                  <article key={entity.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900">{entity.displayName || entity.name}</h3>
                        <p className="mt-1 break-all text-sm text-slate-500">{entity.email || entity.phone || 'No contact details'}</p>
                      </div>
                      <StatusBadge status={entity.status} />
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <MobileDetail label="City" value={entity.address?.city || '-'} />
                      <MobileDetail label="Primary contact" value={entity.primaryContact?.name || '-'} />
                    </dl>
                    {entity.tags.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {entity.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{tag}</span>)}
                      </div>
                    ) : null}
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => openDetail(entity)} className={smallButtonClass}>{canManage ? 'View / Edit' : 'View'}</button>
                      {isAdmin ? (
                        <button type="button" onClick={() => setStatusEntity(entity)} className={smallButtonClass}>
                          {entity.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
              </>
            )}
            <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Showing {entities.length} of {pagination.total} records.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(pagination.page - 1, 1))}
                  disabled={pagination.page <= 1 || loading}
                  className={paginationButtonClass}
                >
                  Previous
                </button>
                <span className="min-w-24 text-center text-sm text-slate-600">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPage(Math.min(pagination.page + 1, pagination.totalPages))
                  }
                  disabled={pagination.page >= pagination.totalPages || loading}
                  className={paginationButtonClass}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {formOpen && selectedType ? (
        <CrmEntityForm entityType={selectedType} entity={editingEntity} saving={saving} onClose={() => { setFormOpen(false); setEditingEntity(null); }} onSave={saveEntity} />
      ) : null}

      {detailEntity ? (
        <CrmEntityDetail
          entity={detailEntity}
          onClose={() => setDetailEntity(null)}
          onEditEntity={() => { setEditingEntity(detailEntity); setFormOpen(true); setDetailEntity(null); }}
          onAddContact={() => { setEditingContact(null); setContactFormOpen(true); }}
          onEditContact={(contact) => { setEditingContact(contact); setContactFormOpen(true); }}
          onToggleContact={toggleContact}
          onDeleteContact={removeContact}
          readOnly={!canManage}
        />
      ) : null}

      {contactFormOpen ? (
        <ContactForm
          contact={editingContact}
          saving={saving}
          onClose={() => { setContactFormOpen(false); setEditingContact(null); }}
          onSave={saveContact}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(statusEntity)}
        title={statusEntity?.status === 'active' ? 'Deactivate CRM record?' : 'Activate CRM record?'}
        description={
          statusEntity?.status === 'active'
            ? `${statusEntity.displayName || statusEntity.name} will be hidden from active selections.`
            : `${statusEntity?.displayName || statusEntity?.name || 'This record'} will become active again.`
        }
        confirmText={statusEntity?.status === 'active' ? 'Deactivate' : 'Activate'}
        danger={statusEntity?.status === 'active'}
        onClose={() => setStatusEntity(null)}
        onConfirm={() => {
          if (!statusEntity) return;
          void toggleEntity(statusEntity).finally(() => setStatusEntity(null));
        }}
      />
    </section>
  );
};

const MobileDetail = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt className="text-xs text-slate-500">{label}</dt>
    <dd className="mt-0.5 text-slate-800">{value}</dd>
  </div>
);

const Metric = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-md bg-slate-50 px-3 py-2">
    <dt className="text-xs text-slate-500">{label}</dt>
    <dd className="mt-1 text-lg font-semibold text-slate-900">{value}</dd>
  </div>
);

const StatusBadge = ({ status }: { status: 'active' | 'inactive' }) => (
  <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
    {status}
  </span>
);

const inputClass = 'rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900';
const primaryButtonClass = 'rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700';
const smallButtonClass = 'rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100';
const paginationButtonClass = 'rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40';

export default CRM;
