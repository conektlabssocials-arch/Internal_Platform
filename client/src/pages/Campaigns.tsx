import { useEffect, useState } from 'react';

import {
  createCampaign,
  getCampaignById,
  getCampaigns,
  getCampaignSummary,
  previewCampaignCode,
  updateCampaign,
  updateCampaignStatus,
} from '../api/campaignApi';
import { getUsers } from '../api/userApi';
import CampaignDetail from '../components/campaigns/CampaignDetail';
import CampaignForm from '../components/campaigns/CampaignForm';
import CampaignStatusModal from '../components/campaigns/CampaignStatusModal';
import PageHeader from '../components/ui/PageHeader';
import { useAuth } from '../context/AuthContext';
import type { User } from '../types/auth';
import type {
  Campaign,
  CampaignFilters,
  CampaignPayload,
  CampaignStatus,
  CampaignSummary,
} from '../types/campaign';

const emptySummary: CampaignSummary = {
  total: 0, new: 0, inDiscussion: 0, planShared: 0, negotiating: 0,
  won: 0, lost: 0, onHold: 0, openPipelineValue: 0, wonValue: 0, followUpsDueToday: 0,
};
const statuses: CampaignStatus[] = ['New', 'In Discussion', 'Plan Shared', 'Negotiating', 'Won', 'Lost', 'On Hold'];
const sources = ['Call', 'WhatsApp', 'Email', 'Referral', 'Walk-in', 'Website', 'Other'];
const categories = ['Outdoor', 'Auto', 'Bus', 'Mobile Van'];
const priorities = ['Low', 'Medium', 'High'];

const Campaigns = () => {
  const { user, can } = useAuth();
  const canManageCampaigns = can('campaigns.manage');
  const canManagePlans = can('plans.manage');
  const [items, setItems] = useState<Campaign[]>([]);
  const [summary, setSummary] = useState<CampaignSummary>(emptySummary);
  const [users, setUsers] = useState<User[]>([]);
  const [filters, setFilters] = useState<CampaignFilters>({ page: 1, limit: 20 });
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [previewCode, setPreviewCode] = useState('');
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [detail, setDetail] = useState<Campaign | null>(null);
  const [statusCampaign, setStatusCampaign] = useState<Campaign | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [list, nextSummary] = await Promise.all([getCampaigns(filters), getCampaignSummary()]);
      setItems(list.data);
      setSummary(nextSummary);
      setPagination({ page: list.pagination.page, total: list.pagination.total, totalPages: list.pagination.totalPages });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters]);
  useEffect(() => {
    getUsers().then(setUsers).catch(() => setUsers(user ? [user] : []));
  }, [user]);

  const updateFilter = (key: keyof CampaignFilters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value || undefined, page: 1 }));

  const openCreate = async () => {
    setEditing(null);
    setPreviewCode('');
    setFormOpen(true);
    try { setPreviewCode(await previewCampaignCode()); } catch { setPreviewCode('Generated on save'); }
  };

  const saveCampaign = async (payload: CampaignPayload) => {
    setSaving(true);
    setError('');
    try {
      if (editing) await updateCampaign(editing.id, payload);
      else await createCampaign(payload);
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save campaign');
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (campaign: Campaign) => {
    setLoading(true);
    try { setDetail(await getCampaignById(campaign.id)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load campaign'); }
    finally { setLoading(false); }
  };

  const saveStatus = async (status: CampaignStatus, reason: string) => {
    if (!statusCampaign) return;
    setSaving(true);
    try {
      const updated = await updateCampaignStatus(statusCampaign.id, { status, reason });
      setStatusCampaign(null);
      if (detail?.id === updated.id) setDetail(updated);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const cards = [
    ['Total Campaigns', summary.total],
    ['New', summary.new],
    ['In Discussion', summary.inDiscussion],
    ['Plan Shared', summary.planShared],
    ['Negotiating', summary.negotiating],
    ['Won', summary.won],
    ['Follow-ups Due', summary.followUpsDueToday],
  ] as const;

  return (
    <section className="space-y-6">
      <PageHeader
        title="Campaigns"
        eyebrow="Sales pipeline"
        description="Capture client requirements and manage the sales pipeline."
        actions={canManageCampaigns ? <button type="button" onClick={openCreate} className={primary}>Add Campaign</button> : null}
      />

      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {cards.map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <input value={filters.search || ''} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search campaigns" className={input} />
          <Filter value={filters.status} options={statuses} placeholder="All statuses" onChange={(value) => updateFilter('status', value)} />
          <Filter value={filters.clientType} options={['Brand', 'Agency', 'Individual']} placeholder="All client types" onChange={(value) => updateFilter('clientType', value)} />
          <Filter value={filters.source} options={sources} placeholder="All sources" onChange={(value) => updateFilter('source', value)} />
          <Filter value={filters.ownerUser} options={users.map((item) => item.id)} labels={Object.fromEntries(users.map((item) => [item.id, item.name]))} placeholder="All owners" onChange={(value) => updateFilter('ownerUser', value)} />
          <Filter value={filters.category} options={categories} placeholder="All categories" onChange={(value) => updateFilter('category', value)} />
          <Filter value={filters.priority} options={priorities} placeholder="All priorities" onChange={(value) => updateFilter('priority', value)} />
          <label className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"><input type="checkbox" checked={filters.followUpDue === 'true'} onChange={(event) => updateFilter('followUpDue', event.target.checked ? 'true' : '')} />Follow-up due</label>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {loading ? <p className="p-5 text-sm text-slate-500">Loading campaigns...</p> : items.length === 0 ? (
          <div className="p-8 text-center"><p className="font-medium">No campaigns yet.</p><p className="mt-1 text-sm text-slate-500">Create your first campaign from a client request.</p></div>
        ) : (
          <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500"><tr>{['Code', 'Title', 'Client', 'Source', 'Budget', 'Categories', 'Status', 'Owner', 'Next Follow-up', 'Actions'].map((heading) => <th key={heading} className="px-4 py-3 font-medium">{heading}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((campaign) => (
                  <tr key={campaign.id}>
                    <td className="whitespace-nowrap px-4 py-4 font-medium">{campaign.campaignCode}</td>
                    <td className="min-w-56 px-4 py-4">{campaign.title}</td>
                    <td className="px-4 py-4 text-slate-600">{campaign.client.displayName || campaign.client.name}</td>
                    <td className="px-4 py-4 text-slate-600">{campaign.source}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">{formatBudget(campaign)}</td>
                    <td className="px-4 py-4 text-slate-600">{campaign.categoriesOfInterest.join(', ') || '-'}</td>
                    <td className="px-4 py-4"><StatusBadge status={campaign.status} /></td>
                    <td className="px-4 py-4 text-slate-600">{campaign.ownerUser.name}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">{campaign.nextFollowUpAt ? new Date(campaign.nextFollowUpAt).toLocaleDateString('en-IN') : '-'}</td>
                    <td className="px-4 py-4"><div className="flex gap-2"><button type="button" onClick={() => openDetail(campaign)} className={small}>{canManageCampaigns ? 'View / Edit' : 'View'}</button>{canManageCampaigns ? <button type="button" onClick={() => setStatusCampaign(campaign)} className={small}>Change Status</button> : null}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-slate-100 md:hidden">
            {items.map((campaign) => (
              <article key={campaign.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-emerald-700">{campaign.campaignCode}</p>
                    <h3 className="mt-1 font-semibold text-slate-900">{campaign.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">{campaign.client.displayName || campaign.client.name}</p>
                  </div>
                  <StatusBadge status={campaign.status} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <CampaignInfo label="Budget" value={formatBudget(campaign)} />
                  <CampaignInfo label="Owner" value={campaign.ownerUser.name} />
                  <CampaignInfo label="Follow-up" value={campaign.nextFollowUpAt ? new Date(campaign.nextFollowUpAt).toLocaleDateString('en-IN') : '-'} />
                  <CampaignInfo label="Priority" value={campaign.priority} />
                </dl>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => openDetail(campaign)} className={small}>{canManageCampaigns ? 'View / Edit' : 'View'}</button>
                  {canManageCampaigns ? <button type="button" onClick={() => setStatusCampaign(campaign)} className={small}>Change Status</button> : null}
                </div>
              </article>
            ))}
          </div>
          </>
        )}
        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">Showing {items.length} of {pagination.total} campaigns.</p>
          <div className="flex items-center gap-2"><button type="button" disabled={pagination.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: pagination.page - 1 }))} className={pager}>Previous</button><span className="text-sm text-slate-600">Page {pagination.page} of {pagination.totalPages}</span><button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => setFilters((current) => ({ ...current, page: pagination.page + 1 }))} className={pager}>Next</button></div>
        </div>
      </div>

      {formOpen ? <CampaignForm campaign={editing} previewCode={previewCode} users={users} currentUserId={user?.id} saving={saving} onClose={() => { setFormOpen(false); setEditing(null); }} onSave={saveCampaign} /> : null}
      {detail ? <CampaignDetail campaign={detail} readOnly={!canManageCampaigns} canManagePlans={canManagePlans} onClose={() => setDetail(null)} onEdit={() => { setEditing(detail); setDetail(null); setFormOpen(true); }} onStatus={() => setStatusCampaign(detail)} onChanged={async () => { await load(); setDetail(await getCampaignById(detail.id)); }} /> : null}
      {statusCampaign ? <CampaignStatusModal campaign={statusCampaign} saving={saving} onClose={() => setStatusCampaign(null)} onSave={saveStatus} /> : null}
    </section>
  );
};

const CampaignInfo = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt className="text-xs text-slate-500">{label}</dt>
    <dd className="mt-0.5 text-slate-800">{value}</dd>
  </div>
);

const formatMoney = (value?: number) => value === undefined ? '-' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
const formatBudget = (campaign: Campaign) => campaign.budgetType === 'fixed' ? formatMoney(campaign.budget?.fixed) : campaign.budgetType === 'range' ? `${formatMoney(campaign.budget?.min)} - ${formatMoney(campaign.budget?.max)}` : 'Unknown';
const statusClasses: Record<CampaignStatus, string> = { New: 'bg-sky-50 text-sky-700', 'In Discussion': 'bg-purple-50 text-purple-700', 'Plan Shared': 'bg-indigo-50 text-indigo-700', Negotiating: 'bg-orange-50 text-orange-700', Won: 'bg-emerald-50 text-emerald-700', Lost: 'bg-red-50 text-red-700', 'On Hold': 'bg-amber-50 text-amber-700' };
const StatusBadge = ({ status }: { status: CampaignStatus }) => <span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${statusClasses[status]}`}>{status}</span>;
const Filter = ({ value, options, labels = {}, placeholder, onChange }: { value?: string; options: readonly string[]; labels?: Record<string, string>; placeholder: string; onChange: (value: string) => void }) => <select value={value || ''} onChange={(event) => onChange(event.target.value)} className={input}><option value="">{placeholder}</option>{options.map((option) => <option key={option} value={option}>{labels[option] || option}</option>)}</select>;
const input = 'rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900';
const primary = 'rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700';
const small = 'whitespace-nowrap rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100';
const pager = 'rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40';

export default Campaigns;
