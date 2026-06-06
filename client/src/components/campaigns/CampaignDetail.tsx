import type { ReactNode } from 'react';

import type { Campaign } from '../../types/campaign';

const money = (value?: number) =>
  value === undefined ? '-' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
const date = (value?: string) => (value ? new Date(value).toLocaleString('en-IN') : '-');

const CampaignDetail = ({
  campaign,
  onClose,
  onEdit,
  onStatus,
}: {
  campaign: Campaign;
  onClose: () => void;
  onEdit: () => void;
  onStatus: () => void;
}) => (
  <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/40 px-4 py-8">
    <div className="mx-auto max-w-5xl rounded-lg bg-white p-6 shadow-xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-sm font-medium text-slate-500">{campaign.campaignCode}</p><h2 className="mt-1 text-xl font-semibold">{campaign.title}</h2><p className="mt-1 text-sm text-slate-500">{campaign.client.displayName || campaign.client.name}</p></div>
        <div className="flex gap-2"><button type="button" onClick={onStatus} className={secondary}>Change Status</button><button type="button" onClick={onEdit} className={secondary}>Edit</button><button type="button" onClick={onClose} className={secondary}>Close</button></div>
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Section title="Client and Requirement">
          <Detail label="Client" value={`${campaign.client.displayName || campaign.client.name} (${campaign.clientType})`} />
          <Detail label="Agency Brand" value={campaign.agencyBrandName} />
          <Detail label="Source" value={campaign.source} />
          <Detail label="Status" value={campaign.status} />
          <Detail label="Brief" value={campaign.brief} wide />
          <Detail label="Objective" value={campaign.objective} wide />
        </Section>
        <Section title="Budget and Schedule">
          <Detail label="Budget Type" value={campaign.budgetType} />
          <Detail label="Fixed" value={money(campaign.budget?.fixed)} />
          <Detail label="Range" value={campaign.budget?.min !== undefined || campaign.budget?.max !== undefined ? `${money(campaign.budget?.min)} - ${money(campaign.budget?.max)}` : '-'} />
          <Detail label="Expected Revenue" value={money(campaign.expectedRevenue)} />
          <Detail label="Start" value={date(campaign.startDate)} />
          <Detail label="End" value={date(campaign.endDate)} />
        </Section>
        <Section title="Targeting">
          <Detail label="Geos" value={campaign.geos.join(', ')} wide />
          <Detail label="Target Audience" value={campaign.targetAudience} wide />
          <Detail label="Categories" value={campaign.categoriesOfInterest.join(', ')} wide />
        </Section>
        <Section title="Ownership and Follow-up">
          <Detail label="Owner" value={campaign.ownerUser.name} />
          <Detail label="Priority" value={campaign.priority} />
          <Detail label="Next Follow-up" value={date(campaign.nextFollowUpAt)} />
          <Detail label="Tags" value={campaign.tags.join(', ')} />
          <Detail label="Notes" value={campaign.notes} wide />
          {campaign.status === 'Lost' ? <Detail label="Lost Reason" value={campaign.lostReason} wide /> : null}
          {campaign.status === 'On Hold' ? <Detail label="On Hold Reason" value={campaign.onHoldReason} wide /> : null}
        </Section>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Placeholder title="Plans" text="Plans will be created in Prompt 6." />
        <Placeholder title="Activity" text="Campaign activity will appear here later." />
      </div>
      <button type="button" disabled className="mt-5 rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-500">Create Plan — Coming in Prompt 6</button>
    </div>
  </div>
);

const Section = ({ title, children }: { title: string; children: ReactNode }) => <section className="rounded-lg border border-slate-200 bg-slate-50/60 p-4"><h3 className="mb-3 font-semibold">{title}</h3><dl className="grid gap-3 sm:grid-cols-2">{children}</dl></section>;
const Detail = ({ label, value, wide }: { label: string; value?: string; wide?: boolean }) => <div className={wide ? 'sm:col-span-2' : ''}><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{value || '-'}</dd></div>;
const Placeholder = ({ title, text }: { title: string; text: string }) => <section className="rounded-lg border border-dashed border-slate-300 p-4"><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm text-slate-500">{text}</p></section>;
const secondary = 'rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100';

export default CampaignDetail;
