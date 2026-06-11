import { useEffect, useState } from 'react';

import {
  createPlanShare,
  disableShare,
  getPlanShares,
} from '../../api/shareApi';
import type {
  CreateSharePayload,
  PlanShare,
  ShareChannel,
} from '../../types/share';
import { useAuth } from '../../context/AuthContext';

const initialForm: CreateSharePayload = {
  sharedWithName: '',
  sharedWithEmail: '',
  sharedWithPhone: '',
  channel: 'Other',
  expiresAt: '',
};

const SharePanel = ({
  planId,
  beforeCreate,
  onPlanShared,
}: {
  planId: string;
  beforeCreate: () => Promise<boolean>;
  onPlanShared: () => Promise<void>;
}) => {
  const { can } = useAuth();
  const canManageShares = can('shares.manage');
  const [shares, setShares] = useState<PlanShare[]>([]);
  const [form, setForm] = useState<CreateSharePayload>(initialForm);
  const [latestUrl, setLatestUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setShares(await getPlanShares(planId));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load share links');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [planId]);

  const update = (key: keyof CreateSharePayload, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const create = async () => {
    setCreating(true);
    setError('');
    try {
      if (!(await beforeCreate())) return;
      const share = await createPlanShare(planId, form);
      setShares((current) => [share, ...current]);
      setLatestUrl(share.shareUrl);
      setForm(initialForm);
      await onPlanShared();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share link');
    } finally {
      setCreating(false);
    }
  };

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const disable = async (shareId: string) => {
    try {
      const disabled = await disableShare(shareId);
      setShares((current) =>
        current.map((share) => (share.id === disabled.id ? disabled : share)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable share link');
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Share Plan</h3>
          <p className="mt-1 text-xs text-slate-500">
            Creating a link from a Draft plan marks that version Shared and locks it.
          </p>
        </div>
        <button type="button" onClick={() => void load()} className={secondaryButton}>
          Refresh Tracking
        </button>
      </div>

      {canManageShares ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Shared with name" value={form.sharedWithName} onChange={(value) => update('sharedWithName', value)} />
        <Field label="Email" type="email" value={form.sharedWithEmail} onChange={(value) => update('sharedWithEmail', value)} />
        <Field label="Phone" value={form.sharedWithPhone} onChange={(value) => update('sharedWithPhone', value)} />
        <label>
          <span className={labelClass}>Channel</span>
          <select value={form.channel} onChange={(event) => update('channel', event.target.value as ShareChannel)} className={inputClass}>
            {(['WhatsApp', 'Email', 'Phone', 'Other'] as ShareChannel[]).map((channel) => <option key={channel}>{channel}</option>)}
          </select>
        </label>
        <Field label="Expiry date" type="date" value={form.expiresAt} onChange={(value) => update('expiresAt', value)} />
      </div> : <p className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">You can review share history, but share-link management is disabled for Members.</p>}
      {canManageShares ? <button type="button" disabled={creating} onClick={() => void create()} className={`${primaryButton} mt-3`}>
        {creating ? 'Creating...' : 'Create Share Link'}
      </button> : null}

      {latestUrl ? (
        <div className="mt-4 flex flex-col gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 sm:flex-row sm:items-center">
          <input readOnly value={latestUrl} className="min-w-0 flex-1 bg-transparent text-sm text-emerald-900 outline-none" />
          <button type="button" onClick={() => void copy(latestUrl)} className={secondaryButton}>
            {copied ? 'Copied' : 'Copy Link'}
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Shared With</th>
              <th className="px-3 py-2 font-medium">Channel</th>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2 font-medium">Views</th>
              <th className="px-3 py-2 font-medium">Last Viewed</th>
              <th className="px-3 py-2 font-medium">Map Opens</th>
              <th className="px-3 py-2 font-medium">Pin Clicks</th>
              <th className="px-3 py-2 font-medium">Last Map Activity</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shares.map((share) => (
              <tr key={share.id}>
                <td className="px-3 py-3">
                  <p className="font-medium">{share.sharedWithName || 'General link'}</p>
                  <p className="text-xs text-slate-500">{share.sharedWithEmail || share.sharedWithPhone}</p>
                </td>
                <td className="px-3 py-3 text-slate-600">{share.channel}</td>
                <td className="px-3 py-3 text-slate-600">{formatDateTime(share.createdAt)}</td>
                <td className="px-3 py-3 font-medium">{share.viewCount}</td>
                <td className="px-3 py-3 text-slate-600">{share.lastViewedAt ? formatDateTime(share.lastViewedAt) : 'Not viewed'}</td>
                <td className="px-3 py-3 font-medium">{share.mapOpenedCount}</td>
                <td className="px-3 py-3 font-medium">{share.pinClickCount}</td>
                <td className="px-3 py-3 text-slate-600">{share.lastMapInteractionAt ? formatDateTime(share.lastMapInteractionAt) : 'No activity'}</td>
                <td className="px-3 py-3"><Status status={share.status} /></td>
                <td className="px-3 py-3 text-right">
                  <button type="button" onClick={() => void copy(share.shareUrl)} className={linkButton}>Copy</button>
                  {canManageShares && share.status === 'active' ? (
                    <button type="button" onClick={() => void disable(share.id)} className="ml-3 text-sm font-medium text-red-600 hover:text-red-800">Disable</button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading ? <p className="p-4 text-center text-sm text-slate-500">Loading share history...</p> : null}
        {!loading && !shares.length ? <p className="p-4 text-center text-sm text-slate-500">No share links created yet.</p> : null}
      </div>
    </section>
  );
};

const Field = ({
  label,
  value,
  type = 'text',
  onChange,
}: {
  label: string;
  value?: string;
  type?: string;
  onChange: (value: string) => void;
}) => (
  <label>
    <span className={labelClass}>{label}</span>
    <input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} className={inputClass} />
  </label>
);

const Status = ({ status }: { status: PlanShare['status'] }) => (
  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
    status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
  }`}>
    {status}
  </span>
);

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const labelClass = 'text-xs font-medium text-slate-600';
const inputClass = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900';
const primaryButton = 'rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400';
const secondaryButton = 'rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50';
const linkButton = 'text-sm font-medium text-emerald-700 hover:text-emerald-900';

export default SharePanel;
