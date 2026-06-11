import { useEffect, useState } from 'react';

import {
  getPlatformSettings,
  updatePlatformSettings,
} from '../api/platformSettingsApi';
import ErrorState from '../components/ui/ErrorState';
import LoadingState from '../components/ui/LoadingState';
import PageHeader from '../components/ui/PageHeader';
import type {
  MemberPermission,
  PlatformSettings as PlatformSettingsType,
} from '../types/platformSettings';

const permissionGroups: Array<{
  title: string;
  description: string;
  permissions: Array<{
    key: MemberPermission;
    label: string;
    description: string;
  }>;
}> = [
  {
    title: 'Inventory',
    description: 'Control how Members contribute to the inventory library.',
    permissions: [
      {
        key: 'inventory.create',
        label: 'Add inventory',
        description: 'Create new Outdoor, Auto, Bus, and Mobile Van inventory.',
      },
      {
        key: 'inventory.edit',
        label: 'Edit inventory',
        description: 'Change inventory details, pricing, location, and supplier information.',
      },
      {
        key: 'inventory.confirm',
        label: 'Confirm inventory',
        description: 'Refresh availability, confirmation date, and current pricing.',
      },
      {
        key: 'uploads.manage',
        label: 'Upload files and photos',
        description: 'Upload inventory photos, creatives, purchase orders, and proof images.',
      },
    ],
  },
  {
    title: 'Sales Workflow',
    description: 'Control Member access to client and campaign work.',
    permissions: [
      {
        key: 'crm.manage',
        label: 'Manage CRM',
        description: 'Create and edit CRM entities and contacts.',
      },
      {
        key: 'campaigns.manage',
        label: 'Manage campaigns',
        description: 'Create campaigns, edit requirements, and change campaign status.',
      },
      {
        key: 'plans.manage',
        label: 'Manage plans',
        description: 'Create versions, edit pricing, clone plans, and change plan status.',
      },
      {
        key: 'shares.manage',
        label: 'Manage share links',
        description: 'Create and disable client-facing plan links.',
      },
      {
        key: 'documents.generate',
        label: 'Generate documents',
        description: 'Generate plan, quotation, work order, PO, and execution PDFs.',
      },
    ],
  },
  {
    title: 'Operations',
    description: 'Control execution tracking after a plan is Won.',
    permissions: [
      {
        key: 'operations.manage',
        label: 'Manage Operations',
        description: 'Update creative, PO, mounting, proof, takedown, and Work Order status.',
      },
    ],
  },
];

const PlatformSettings = () => {
  const [settings, setSettings] = useState<PlatformSettingsType | null>(null);
  const [draft, setDraft] = useState<PlatformSettingsType['memberPermissions'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getPlatformSettings();
      setSettings(data);
      setDraft(data.memberPermissions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Platform Settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await updatePlatformSettings(draft);
      setSettings(updated);
      setDraft(updated.memberPermissions);
      setSuccess('Member permissions were updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save Platform Settings');
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    settings && draft
      ? JSON.stringify(settings.memberPermissions) !== JSON.stringify(draft)
      : false;

  return (
    <section className="space-y-6">
      <PageHeader
        title="Platform Settings"
        eyebrow="Admin only"
        description="Control what Members can change. Admins always retain full platform access."
        actions={
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => void save()}
            className="rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? 'Saving...' : 'Save Permissions'}
          </button>
        }
      />

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {success ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</p> : null}

      {loading || !draft ? (
        <LoadingState label="Loading Platform Settings..." />
      ) : (
        <>
          <section className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
            <h2 className="font-semibold text-emerald-950">Role policy</h2>
            <p className="mt-1 text-sm leading-6 text-emerald-900">
              Members always have read access to operational modules. The controls below grant write access.
              User administration, Audit Logs, CSV imports, Platform Settings, record activation/deactivation,
              upload deletion, and draft-plan deletion remain Admin-only.
            </p>
          </section>

          <div className="space-y-5">
            {permissionGroups.map((group) => (
              <section key={group.title} className="rounded-md border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-4">
                  <h2 className="font-semibold text-slate-900">{group.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{group.description}</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {group.permissions.map((permission) => (
                    <label
                      key={permission.key}
                      className="flex cursor-pointer items-start justify-between gap-5 px-5 py-4 hover:bg-slate-50"
                    >
                      <span>
                        <span className="block text-sm font-medium text-slate-900">{permission.label}</span>
                        <span className="mt-1 block max-w-3xl text-sm leading-6 text-slate-500">{permission.description}</span>
                      </span>
                      <span className="relative mt-1 inline-flex shrink-0 items-center">
                        <input
                          type="checkbox"
                          checked={draft[permission.key]}
                          onChange={(event) =>
                            setDraft((current) => current
                              ? { ...current, [permission.key]: event.target.checked }
                              : current)
                          }
                          className="peer sr-only"
                        />
                        <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-emerald-700 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-600 peer-focus-visible:ring-offset-2" />
                        <span className="absolute left-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <section className="grid gap-4 md:grid-cols-3">
            <SettingSummary label="Authentication" value="Google Workspace SSO" />
            <SettingSummary label="File storage" value="Cloudinary" />
            <SettingSummary label="Database" value="MongoDB" />
          </section>
        </>
      )}
    </section>
  );
};

const SettingSummary = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-slate-200 bg-white p-4">
    <p className="text-xs font-medium text-slate-500">{label}</p>
    <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
  </div>
);

export default PlatformSettings;
