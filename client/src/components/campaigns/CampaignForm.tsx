import { FormEvent, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { searchCampaignClients } from '../../api/crmApi';
import type {
  Campaign,
  CampaignBudgetType,
  CampaignCategory,
  CampaignClientSearchItem,
  CampaignPayload,
  CampaignPriority,
  CampaignSource,
} from '../../types/campaign';
import type { User } from '../../types/auth';

const sources: CampaignSource[] = ['Call', 'WhatsApp', 'Email', 'Referral', 'Walk-in', 'Website', 'Other'];
const categories: CampaignCategory[] = ['Outdoor', 'Auto', 'Bus', 'Mobile Van'];
const priorities: CampaignPriority[] = ['Low', 'Medium', 'High'];

type CampaignFormProps = {
  campaign?: Campaign | null;
  previewCode: string;
  users: User[];
  currentUserId?: string;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: CampaignPayload) => Promise<void>;
};

const CampaignForm = ({
  campaign,
  previewCode,
  users,
  currentUserId,
  saving,
  onClose,
  onSave,
}: CampaignFormProps) => {
  const [client, setClient] = useState<CampaignClientSearchItem | null>(
    campaign
      ? {
          id: campaign.client.id,
          name: campaign.client.displayName || campaign.client.name,
          entityType: campaign.clientType,
          email: campaign.client.email,
          phone: campaign.client.phone,
        }
      : null,
  );
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<CampaignClientSearchItem[]>([]);
  const [form, setForm] = useState({
    title: campaign?.title || '',
    agencyBrandName: campaign?.agencyBrandName || '',
    source: campaign?.source || ('WhatsApp' as CampaignSource),
    brief: campaign?.brief || '',
    objective: campaign?.objective || '',
    budgetType: campaign?.budgetType || ('unknown' as CampaignBudgetType),
    budgetMin: campaign?.budget?.min?.toString() || '',
    budgetMax: campaign?.budget?.max?.toString() || '',
    budgetFixed: campaign?.budget?.fixed?.toString() || '',
    startDate: campaign?.startDate?.slice(0, 10) || '',
    endDate: campaign?.endDate?.slice(0, 10) || '',
    geos: campaign?.geos.join(', ') || '',
    targetAudience: campaign?.targetAudience || '',
    categories: campaign?.categoriesOfInterest || ([] as CampaignCategory[]),
    ownerUser: campaign?.ownerUser.id || currentUserId || '',
    expectedRevenue: campaign?.expectedRevenue?.toString() || '',
    priority: campaign?.priority || ('Medium' as CampaignPriority),
    nextFollowUpAt: campaign?.nextFollowUpAt?.slice(0, 16) || '',
    notes: campaign?.notes || '',
    tags: campaign?.tags.join(', ') || '',
  });

  useEffect(() => {
    if (!clientSearch.trim()) {
      setClientResults([]);
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        const results = await searchCampaignClients(clientSearch);
        if (!cancelled) setClientResults(results);
      } catch {
        if (!cancelled) setClientResults([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [clientSearch]);

  const update = (key: keyof typeof form, value: string | CampaignCategory[]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const toggleCategory = (category: CampaignCategory) =>
    update(
      'categories',
      form.categories.includes(category)
        ? form.categories.filter((item) => item !== category)
        : [...form.categories, category],
    );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!client) return;
    await onSave({
      client: client.id,
      title: form.title,
      agencyBrandName: form.agencyBrandName,
      source: form.source,
      brief: form.brief,
      objective: form.objective,
      budgetType: form.budgetType,
      budget: {
        min: form.budgetMin ? Number(form.budgetMin) : undefined,
        max: form.budgetMax ? Number(form.budgetMax) : undefined,
        fixed: form.budgetFixed ? Number(form.budgetFixed) : undefined,
      },
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      geos: form.geos.split(',').map((item) => item.trim()).filter(Boolean),
      targetAudience: form.targetAudience,
      categoriesOfInterest: form.categories,
      ownerUser: form.ownerUser,
      expectedRevenue: form.expectedRevenue ? Number(form.expectedRevenue) : undefined,
      priority: form.priority,
      nextFollowUpAt: form.nextFollowUpAt || undefined,
      notes: form.notes,
      tags: form.tags.split(',').map((item) => item.trim()).filter(Boolean),
    });
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/40 px-4 py-8">
      <form onSubmit={submit} className="mx-auto max-w-5xl rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{campaign ? 'Edit Campaign' : 'Add Campaign'}</h2>
            <p className="mt-1 text-sm text-slate-500">Capture the client requirement and next action.</p>
          </div>
          <button type="button" onClick={onClose} className={secondaryButton}>Close</button>
        </div>

        <div className="mt-6 space-y-5">
          <Section title="1. Client">
            <ReadOnly label="Campaign Code" value={campaign?.campaignCode || previewCode || 'Loading...'} />
            <div className="relative md:col-span-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Client</span>
                <input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Search Brand, Agency, or Individual" className={inputClass} />
              </label>
              {client ? <p className="mt-2 text-sm font-medium text-emerald-700">Selected: {client.name} ({client.entityType})</p> : null}
              {clientResults.length ? (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                  {clientResults.map((item) => (
                    <button key={item.id} type="button" onClick={() => { setClient(item); setClientSearch(''); setClientResults([]); }} className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50">
                      <span className="font-medium text-slate-900">{item.name}</span>
                      <span className="ml-2 text-xs text-slate-500">{item.entityType}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {client?.entityType === 'Agency' ? <Field label="Agency Brand Name" value={form.agencyBrandName} onChange={(value) => update('agencyBrandName', value)} /> : null}
          </Section>

          <Section title="2. Requirement">
            <Field label="Title" value={form.title} onChange={(value) => update('title', value)} required />
            <Select label="Source" value={form.source} options={sources} onChange={(value) => update('source', value)} />
            <label className="block md:col-span-3"><span className="text-sm font-medium text-slate-700">Brief</span><textarea value={form.brief} onChange={(event) => update('brief', event.target.value)} required rows={3} className={inputClass} /></label>
            <Field label="Objective" value={form.objective} onChange={(value) => update('objective', value)} />
            <Field label="Target Audience" value={form.targetAudience} onChange={(value) => update('targetAudience', value)} />
          </Section>

          <Section title="3. Budget, Dates and Geos">
            <Select label="Budget Type" value={form.budgetType} options={['unknown', 'fixed', 'range']} onChange={(value) => update('budgetType', value)} />
            {form.budgetType === 'fixed' ? <Field label="Fixed Budget" type="number" value={form.budgetFixed} onChange={(value) => update('budgetFixed', value)} /> : null}
            {form.budgetType === 'range' ? <>
              <Field label="Budget Min" type="number" value={form.budgetMin} onChange={(value) => update('budgetMin', value)} />
              <Field label="Budget Max" type="number" value={form.budgetMax} onChange={(value) => update('budgetMax', value)} />
            </> : null}
            <Field label="Start Date" type="date" value={form.startDate} onChange={(value) => update('startDate', value)} />
            <Field label="End Date" type="date" value={form.endDate} onChange={(value) => update('endDate', value)} />
            <Field label="Geos" value={form.geos} onChange={(value) => update('geos', value)} helper="Comma separated." />
          </Section>

          <Section title="4. Categories of Interest">
            {categories.map((category) => (
              <label key={category} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                <input type="checkbox" checked={form.categories.includes(category)} onChange={() => toggleCategory(category)} />
                {category}
              </label>
            ))}
          </Section>

          <Section title="5. Follow-up and Owner">
            <Select label="Owner" value={form.ownerUser} options={users.filter((user) => user.status === 'active').map((user) => user.id)} optionLabels={Object.fromEntries(users.map((user) => [user.id, user.name]))} onChange={(value) => update('ownerUser', value)} />
            <Select label="Priority" value={form.priority} options={priorities} onChange={(value) => update('priority', value)} />
            <Field label="Expected Revenue" type="number" value={form.expectedRevenue} onChange={(value) => update('expectedRevenue', value)} />
            <Field label="Next Follow-up" type="datetime-local" value={form.nextFollowUpAt} onChange={(value) => update('nextFollowUpAt', value)} />
            <Field label="Tags" value={form.tags} onChange={(value) => update('tags', value)} helper="Comma separated." />
            <label className="block md:col-span-3"><span className="text-sm font-medium text-slate-700">Notes</span><textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} rows={3} className={inputClass} /></label>
          </Section>
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button type="button" onClick={onClose} className={secondaryButton}>Cancel</button>
          <button type="submit" disabled={saving || !client} className={primaryButton}>{saving ? 'Saving...' : 'Save Campaign'}</button>
        </div>
      </form>
    </div>
  );
};

const inputClass = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900';
const secondaryButton = 'rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100';
const primaryButton = 'rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400';

const Section = ({ title, children }: { title: string; children: ReactNode }) => <section className="rounded-lg border border-slate-200 bg-slate-50/60 p-4"><h3 className="mb-3 font-semibold">{title}</h3><div className="grid gap-4 md:grid-cols-3">{children}</div></section>;
const Field = ({ label, value, onChange, type = 'text', required, helper }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; helper?: string }) => <label className="block"><span className="text-sm font-medium text-slate-700">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} className={inputClass} />{helper ? <span className="mt-1 block text-xs text-slate-500">{helper}</span> : null}</label>;
const Select = ({ label, value, options, optionLabels = {}, onChange }: { label: string; value: string; options: readonly string[]; optionLabels?: Record<string, string>; onChange: (value: string) => void }) => <label className="block"><span className="text-sm font-medium text-slate-700">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>{options.map((option) => <option key={option} value={option}>{optionLabels[option] || option}</option>)}</select></label>;
const ReadOnly = ({ label, value }: { label: string; value: string }) => <label className="block"><span className="text-sm font-medium text-slate-700">{label}</span><input readOnly value={value} className={`${inputClass} bg-slate-100`} /></label>;

export default CampaignForm;
