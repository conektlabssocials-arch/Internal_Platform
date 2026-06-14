import { FormEvent, useState } from 'react';

import type { Campaign, CampaignStatus } from '../../types/campaign';

const statuses: CampaignStatus[] = ['New', 'In Discussion', 'Plan Shared', 'Negotiating', 'Won', 'Lost', 'On Hold'];

const CampaignStatusModal = ({
  campaign,
  saving,
  onClose,
  onSave,
}: {
  campaign: Campaign;
  saving: boolean;
  onClose: () => void;
  onSave: (status: CampaignStatus, reason: string) => Promise<void>;
}) => {
  const [status, setStatus] = useState<CampaignStatus>(campaign.status);
  const [reason, setReason] = useState(
    campaign.status === 'Lost' ? campaign.lostReason || '' : campaign.onHoldReason || '',
  );
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await onSave(status, reason);
  };
  const reasonLabel = status === 'Lost' ? 'Lost reason' : status === 'On Hold' ? 'On hold reason' : 'Reason / note';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold">Change Campaign Status</h2>
        <p className="mt-1 text-sm text-slate-500">{campaign.campaignCode} · {campaign.title}</p>
        <div className="mt-5 space-y-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
          <label className="block"><span className="text-sm font-medium text-slate-700">Status</span><select value={status} onChange={(event) => setStatus(event.target.value as CampaignStatus)} className={inputClass}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="block"><span className="text-sm font-medium text-slate-700">{reasonLabel}</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} required={status === 'Lost'} rows={4} className={inputClass} /></label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondary}>Cancel</button>
          <button type="submit" disabled={saving} className={primary}>{saving ? 'Saving...' : 'Update Status'}</button>
        </div>
      </form>
    </div>
  );
};

const inputClass = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900';
const secondary = 'rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100';
const primary = 'rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-400';

export default CampaignStatusModal;
