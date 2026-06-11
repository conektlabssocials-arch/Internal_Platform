import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { getPublicShare, PublicShareError } from '../api/shareApi';
import NonMapInventoryList from '../components/maps/NonMapInventoryList';
import SharedPlanMap from '../components/maps/SharedPlanMap';
import type { PublicSharedPlan as PublicSharedPlanData } from '../types/share';

const pendingRequests = new Map<string, Promise<PublicSharedPlanData>>();

const loadPublicShare = (token: string) => {
  const existing = pendingRequests.get(token);
  if (existing) return existing;

  const request = getPublicShare(token);
  pendingRequests.set(token, request);
  window.setTimeout(() => pendingRequests.delete(token), 1000);
  return request;
};

const PublicSharedPlan = () => {
  const { token = '' } = useParams();
  const [data, setData] = useState<PublicSharedPlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadPublicShare(token)
      .then((response) => {
        if (!cancelled) {
          setData(response);
          setError(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError({
          status: err instanceof PublicShareError ? err.status : 500,
          message: err instanceof Error ? err.message : 'Unable to open this shared plan',
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f2] text-slate-600">
        Loading shared plan...
      </main>
    );
  }

  if (error || !data) {
    const expired = error?.status === 410;
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f2] px-5">
        <div className="w-full max-w-lg border-t-4 border-emerald-700 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-bold tracking-wide text-emerald-700">CONEKT ADS</p>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">
            {expired ? 'This plan link has expired' : 'Shared plan not found'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {expired
              ? 'Please contact the Conekt Ads team for a new link.'
              : 'This link may be invalid or may have been disabled.'}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f2] text-slate-900">
      <header className="border-b border-emerald-900/10 bg-emerald-800 text-white">
        <div className="mx-auto max-w-6xl px-5 py-7 sm:px-8 sm:py-9">
          <p className="text-sm font-bold tracking-wide text-emerald-100">CONEKT ADS</p>
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="max-w-4xl text-2xl font-semibold sm:text-3xl">{data.campaign.title}</h1>
              <p className="mt-2 text-emerald-100">{data.campaign.clientName}</p>
            </div>
            <div className="text-sm text-emerald-100">
              <p>Plan {data.plan.versionLabel}</p>
              <p className="mt-1">{data.plan.status}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-5 py-8 sm:px-8">
        <section>
          <h2 className="text-lg font-semibold">Campaign Brief</h2>
          <p className="mt-2 max-w-4xl whitespace-pre-wrap text-sm leading-6 text-slate-600">
            {data.campaign.brief || 'No campaign brief provided.'}
          </p>
        </section>

        <section>
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase text-emerald-700">Outdoor locations</p>
            <h2 className="mt-1 text-lg font-semibold">Map View</h2>
            <p className="mt-1 text-sm text-slate-500">Click a pin to view site details.</p>
          </div>
          <SharedPlanMap mapItems={data.mapItems || []} shareToken={token} publicMode />
        </section>

        {(data.nonMapItems || []).length ? (
          <section>
            <p className="text-xs font-semibold uppercase text-emerald-700">Flexible media</p>
            <h2 className="mt-1 text-lg font-semibold">Mobile / Transit Inventory</h2>
            <div className="mt-3">
              <NonMapInventoryList items={data.nonMapItems} />
            </div>
          </section>
        ) : null}

        <section>
          <h2 className="text-lg font-semibold">Selected Media</h2>
          <div className="mt-3 overflow-hidden border border-slate-200 bg-white">
            <table className="hidden w-full min-w-[850px] text-left text-sm md:table">
              <thead className="bg-emerald-50 text-emerald-900">
                <tr>
                  <th className="px-4 py-3 font-medium">Inventory</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Size</th>
                  <th className="px-4 py-3 font-medium">Dates</th>
                  <th className="px-4 py-3 text-right font-medium">Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.plan.items.map((item, index) => (
                  <tr key={`${item.title}-${index}`}>
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-3">
                        {item.photoUrl ? (
                          <img
                            src={item.photoUrl}
                            alt={item.title}
                            className="h-14 w-14 shrink-0 rounded-md object-cover"
                          />
                        ) : null}
                        <div>
                          <p className="font-medium">{item.title}</p>
                          {item.notes ? <p className="mt-1 text-xs text-slate-500">{item.notes}</p> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{item.categoryGroup} / {item.subCategory}</td>
                    <td className="px-4 py-4 text-slate-600">{item.city} / {item.area}</td>
                    <td className="px-4 py-4 text-slate-600">{formatSize(item)}</td>
                    <td className="px-4 py-4 text-slate-600">{formatDate(item.startDate)} - {formatDate(item.endDate)}</td>
                    <td className="px-4 py-4 text-right">{item.quantity}</td>
                    <td className="px-4 py-4 text-right font-medium">{currency(item.totalSellingPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="divide-y divide-slate-100 md:hidden">
              {data.plan.items.map((item, index) => (
                <article key={`${item.title}-${index}`} className="p-4">
                  <div className="flex items-start gap-3">
                    {item.photoUrl ? (
                      <img src={item.photoUrl} alt={item.title} className="h-16 w-16 shrink-0 rounded-md object-cover" />
                    ) : null}
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900">{item.title}</h3>
                      <p className="mt-1 text-xs text-slate-500">{item.categoryGroup} / {item.subCategory}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.city} / {item.area}</p>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <PublicItemInfo label="Size" value={formatSize(item)} />
                    <PublicItemInfo label="Quantity" value={String(item.quantity)} />
                    <PublicItemInfo label="Dates" value={`${formatDate(item.startDate)} - ${formatDate(item.endDate)}`} />
                    <PublicItemInfo label="Amount" value={currency(item.totalSellingPrice)} strong />
                  </dl>
                  {item.notes ? <p className="mt-3 text-sm leading-6 text-slate-600">{item.notes}</p> : null}
                </article>
              ))}
            </div>
            {!data.plan.items.length ? <p className="p-6 text-center text-sm text-slate-500">No media items included.</p> : null}
          </div>
        </section>

        <section className="grid gap-8 border-t border-slate-200 pt-8 md:grid-cols-[1fr_340px]">
          <div>
            <h2 className="text-lg font-semibold">Client Notes</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {data.plan.clientNotes || 'No additional notes.'}
            </p>
          </div>
          <div className="bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Pricing Summary</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Price label="Subtotal" value={data.plan.pricing.subtotal} />
              <Price label={`Tax (${data.plan.pricing.taxPercentage}%)`} value={data.plan.pricing.taxAmount} />
              <div className="flex justify-between border-t-2 border-emerald-600 pt-4 text-base font-semibold">
                <dt>Grand Total</dt>
                <dd>{currency(data.plan.pricing.grandTotal)}</dd>
              </div>
            </dl>
          </div>
        </section>

        <footer className="border-t border-slate-200 py-5 text-center text-xs text-slate-500">
          This shared plan is read-only.
        </footer>
      </div>
    </main>
  );
};

const Price = ({ label, value }: { label: string; value: number }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-slate-600">{label}</dt>
    <dd className="font-medium">{currency(value)}</dd>
  </div>
);

const PublicItemInfo = ({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) => (
  <div className={label === 'Dates' ? 'col-span-2' : ''}>
    <dt className="text-xs text-slate-500">{label}</dt>
    <dd className={`mt-0.5 ${strong ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{value}</dd>
  </div>
);

const currency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(value))
    : '-';

const formatSize = (item: PublicSharedPlanData['plan']['items'][number]) => {
  if (item.width && item.height) return `${item.width} x ${item.height} ft`;
  if (item.totalSqFt) return `${item.totalSqFt} sq ft`;
  return '-';
};

export default PublicSharedPlan;
