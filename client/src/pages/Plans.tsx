import { useEffect, useState } from 'react';

import { getRecentPlans } from '../api/planApi';
import PlanBuilder from '../components/plans/PlanBuilder';
import PageHeader from '../components/ui/PageHeader';
import type { Plan } from '../types/plan';

const Plans = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [search, setSearch] = useState('');
  const [planId, setPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try { setPlans(await getRecentPlans()); setError(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load plans'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const visible = plans.filter((plan) =>
    [plan.title, plan.versionLabel, plan.campaign.campaignCode, plan.campaign.title, plan.campaign.client?.name]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <section className="space-y-6">
      <PageHeader title="Plans" eyebrow="Planning" description="Plans are created from Campaign detail. Recent plan versions appear here." />
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <div className="rounded-lg border border-slate-200 bg-white p-4"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search plans or campaigns" className="w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900" /></div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {loading ? <p className="p-5 text-sm text-slate-500">Loading plans...</p> : visible.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No plans found. Create a plan from Campaign detail.</p> : (
          <>
            <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['Campaign', 'Plan', 'Version', 'Status', 'Grand Total', 'Updated', 'Action'].map((heading) => <th key={heading} className="px-4 py-3 font-medium">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visible.map((plan) => <tr key={plan.id}><td className="px-4 py-4"><p className="font-medium">{plan.campaign.campaignCode}</p><p className="text-xs text-slate-500">{plan.campaign.title}</p></td><td className="px-4 py-4">{plan.title}</td><td className="px-4 py-4">{plan.versionLabel}</td><td className="px-4 py-4">{plan.status}</td><td className="px-4 py-4">{currency(plan.pricing.grandTotal)}</td><td className="px-4 py-4 text-slate-600">{plan.updatedAt ? new Date(plan.updatedAt).toLocaleDateString('en-IN') : '-'}</td><td className="px-4 py-4"><button type="button" onClick={() => setPlanId(plan.id)} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium hover:bg-slate-100">Open Plan</button></td></tr>)}</tbody></table></div>
            <div className="divide-y divide-slate-100 md:hidden">
              {visible.map((plan) => (
                <article key={plan.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-emerald-700">{plan.campaign.campaignCode} · {plan.versionLabel}</p>
                      <h3 className="mt-1 font-semibold text-slate-900">{plan.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">{plan.campaign.client?.name || plan.campaign.title}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{plan.status}</span>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-500">Grand total</p>
                      <p className="mt-1 font-semibold text-slate-900">{currency(plan.pricing.grandTotal)}</p>
                    </div>
                    <button type="button" onClick={() => setPlanId(plan.id)} className="rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white">Open Plan</button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
      {planId ? <PlanBuilder planId={planId} onClose={() => setPlanId(null)} onChanged={load} /> : null}
    </section>
  );
};

const currency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);

export default Plans;
