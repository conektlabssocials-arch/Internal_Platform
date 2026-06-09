import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { clonePlan, createPlan, deletePlan, getPlansByCampaign, updatePlanStatus } from '../../api/planApi';
import { useAuth } from '../../context/AuthContext';
import type { Campaign } from '../../types/campaign';
import type { Plan, PlanStatus } from '../../types/plan';
import ActivityTimeline from '../activity/ActivityTimeline';
import PlanBuilder from '../plans/PlanBuilder';

const money = (value?: number) => value === undefined ? '-' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
const date = (value?: string) => (value ? new Date(value).toLocaleString('en-IN') : '-');

const CampaignDetail = ({
  campaign,
  onClose,
  onEdit,
  onStatus,
  onChanged,
}: {
  campaign: Campaign;
  onClose: () => void;
  onEdit: () => void;
  onStatus: () => void;
  onChanged?: () => void;
}) => {
  const { isAdmin } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState<string | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [planError, setPlanError] = useState('');

  const loadPlans = async () => {
    setLoadingPlans(true);
    try {
      setPlans(await getPlansByCampaign(campaign.id));
      setPlanError('');
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Failed to load plans');
    } finally {
      setLoadingPlans(false);
    }
  };

  useEffect(() => { loadPlans(); }, [campaign.id]);

  const create = async () => {
    try {
      const plan = await createPlan(campaign.id);
      await loadPlans();
      setPlanId(plan.id);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Failed to create plan');
    }
  };

  const clone = async (id: string) => {
    try {
      const plan = await clonePlan(id);
      await loadPlans();
      setPlanId(plan.id);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Failed to clone plan');
    }
  };

  const status = async (id: string, nextStatus: PlanStatus) => {
    try {
      await updatePlanStatus(id, nextStatus);
      await loadPlans();
      onChanged?.();
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Failed to update plan');
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this draft plan?')) return;
    try {
      await deletePlan(id);
      await loadPlans();
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Failed to delete plan');
    }
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/40 px-4 py-8">
      <div className="mx-auto max-w-6xl rounded-lg bg-white p-6 shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="text-sm font-medium text-slate-500">{campaign.campaignCode}</p><h2 className="mt-1 text-xl font-semibold">{campaign.title}</h2><p className="mt-1 text-sm text-slate-500">{campaign.client.displayName || campaign.client.name}</p></div>
          <div className="flex gap-2"><button type="button" onClick={onStatus} className={secondary}>Change Status</button><button type="button" onClick={onEdit} className={secondary}>Edit</button><button type="button" onClick={onClose} className={secondary}>Close</button></div>
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <Section title="Client and Requirement"><Detail label="Client" value={`${campaign.client.displayName || campaign.client.name} (${campaign.clientType})`} /><Detail label="Agency Brand" value={campaign.agencyBrandName} /><Detail label="Source" value={campaign.source} /><Detail label="Status" value={campaign.status} /><Detail label="Brief" value={campaign.brief} wide /><Detail label="Objective" value={campaign.objective} wide /></Section>
          <Section title="Budget and Schedule"><Detail label="Budget Type" value={campaign.budgetType} /><Detail label="Fixed" value={money(campaign.budget?.fixed)} /><Detail label="Range" value={campaign.budget?.min !== undefined || campaign.budget?.max !== undefined ? `${money(campaign.budget?.min)} - ${money(campaign.budget?.max)}` : '-'} /><Detail label="Expected Revenue" value={money(campaign.expectedRevenue)} /><Detail label="Start" value={date(campaign.startDate)} /><Detail label="End" value={date(campaign.endDate)} /></Section>
          <Section title="Targeting"><Detail label="Geos" value={campaign.geos.join(', ')} wide /><Detail label="Target Audience" value={campaign.targetAudience} wide /><Detail label="Categories" value={campaign.categoriesOfInterest.join(', ')} wide /></Section>
          <Section title="Ownership and Follow-up"><Detail label="Owner" value={campaign.ownerUser.name} /><Detail label="Priority" value={campaign.priority} /><Detail label="Next Follow-up" value={date(campaign.nextFollowUpAt)} /><Detail label="Tags" value={campaign.tags.join(', ')} /><Detail label="Notes" value={campaign.notes} wide /></Section>
        </div>

        <section className="mt-5 overflow-hidden rounded-lg border border-slate-200">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3"><div><h3 className="font-semibold">Plans</h3><p className="mt-1 text-xs text-slate-500">Versioned media plans for this campaign.</p></div><button type="button" onClick={create} className={primary}>Create Plan</button></div>
          {planError ? <p className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{planError}</p> : null}
          {loadingPlans ? <p className="p-5 text-sm text-slate-500">Loading plans...</p> : plans.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">No plans yet. Create v1 plan for this campaign.</p> : (
            <div className="divide-y divide-slate-100">
              {plans.map((plan, index) => <div key={plan.id} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-3"><span className="font-semibold">{plan.versionLabel}</span><PlanBadge status={plan.status} />{index === 0 ? <span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">Latest</span> : null}<span className="text-sm text-slate-600">{money(plan.pricing.grandTotal)}</span><span className="text-xs text-slate-500">{date(plan.createdAt)}</span></div>
                <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setPlanId(plan.id)} className={small}>Open Plan</button><button type="button" onClick={() => clone(plan.id)} className={small}>Clone Version</button>{plan.status === 'Draft' ? <button type="button" onClick={() => status(plan.id, 'Shared')} className={small}>Mark Shared</button> : null}{['Shared', 'Negotiating'].includes(plan.status) ? <><button type="button" onClick={() => status(plan.id, 'Won')} className={small}>Mark Won</button><button type="button" onClick={() => status(plan.id, 'Lost')} className={small}>Mark Lost</button></> : null}{isAdmin && plan.status === 'Draft' && !plan.isLocked ? <button type="button" onClick={() => remove(plan.id)} className={small}>Delete</button> : null}</div>
              </div>)}
            </div>
          )}
        </section>
        <div className="mt-5"><ActivityTimeline entityType="Campaign" entityId={campaign.id} /></div>
      </div>
      {planId ? <PlanBuilder planId={planId} onClose={() => setPlanId(null)} onChanged={() => { loadPlans(); onChanged?.(); }} /> : null}
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: ReactNode }) => <section className="rounded-lg border border-slate-200 bg-slate-50/60 p-4"><h3 className="mb-3 font-semibold">{title}</h3><dl className="grid gap-3 sm:grid-cols-2">{children}</dl></section>;
const Detail = ({ label, value, wide }: { label: string; value?: string; wide?: boolean }) => <div className={wide ? 'sm:col-span-2' : ''}><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{value || '-'}</dd></div>;
const PlanBadge = ({ status }: { status: PlanStatus }) => <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium">{status}</span>;
const secondary = 'rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100';
const small = 'rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100';
const primary = 'rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700';

export default CampaignDetail;
