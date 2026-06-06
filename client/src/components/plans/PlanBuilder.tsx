import { useEffect, useMemo, useState } from 'react';

import {
  clonePlan,
  getPlanById,
  updatePlan,
  updatePlanStatus,
} from '../../api/planApi';
import type { InventoryItem } from '../../types/inventory';
import type { Plan, PlanItem, PlanItemPayload, PlanStatus } from '../../types/plan';
import InventorySelector from './InventorySelector';

type BuilderItem = PlanItemPayload & {
  inventoryCode: string;
  title: string;
  categoryGroup?: string;
  city?: string;
  area?: string;
  width?: number;
  height?: number;
};

const toBuilderItem = (item: PlanItem): BuilderItem => ({
  inventory: item.inventory,
  inventoryCode: item.inventoryCode,
  title: item.title,
  categoryGroup: item.categoryGroup,
  city: item.city,
  area: item.area,
  width: item.width,
  height: item.height,
  startDate: item.startDate?.slice(0, 10),
  endDate: item.endDate?.slice(0, 10),
  quantity: item.quantity,
  unitSellingPrice: item.unitSellingPrice,
  unitInternalCost: item.unitInternalCost,
  notes: item.notes,
});

const PlanBuilder = ({
  planId,
  onClose,
  onChanged,
}: {
  planId: string;
  onClose: () => void;
  onChanged?: (plan: Plan) => void;
}) => {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [items, setItems] = useState<BuilderItem[]>([]);
  const [title, setTitle] = useState('');
  const [taxPercentage, setTaxPercentage] = useState(18);
  const [clientNotes, setClientNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadPlan = async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const next = await getPlanById(id);
      setPlan(next);
      setItems(next.items.map(toBuilderItem));
      setTitle(next.title);
      setTaxPercentage(next.pricing.taxPercentage);
      setClientNotes(next.clientNotes || '');
      setInternalNotes(next.internalNotes || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPlan(planId); }, [planId]);

  const preview = useMemo(() => {
    const calculated = items.map((item) => {
      const quantity = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
      const selling = Number(item.unitSellingPrice) || 0;
      const cost = Number(item.unitInternalCost) || 0;
      const totalSellingPrice = selling * quantity;
      const totalInternalCost = cost * quantity;
      const marginAmount = totalSellingPrice - totalInternalCost;
      return { ...item, quantity, totalSellingPrice, totalInternalCost, marginAmount };
    });
    const subtotal = calculated.reduce((sum, item) => sum + item.totalSellingPrice, 0);
    const internalCostTotal = calculated.reduce((sum, item) => sum + item.totalInternalCost, 0);
    const taxAmount = subtotal * (Number(taxPercentage) || 0) / 100;
    const marginAmount = subtotal - internalCostTotal;
    return {
      items: calculated,
      subtotal,
      internalCostTotal,
      taxAmount,
      grandTotal: subtotal + taxAmount,
      marginAmount,
      marginPercentage: subtotal ? marginAmount / subtotal * 100 : 0,
    };
  }, [items, taxPercentage]);

  const addInventory = (inventory: InventoryItem) => {
    setItems((current) => [...current, {
      inventory: inventory.id,
      inventoryCode: inventory.inventoryCode,
      title: inventory.title,
      categoryGroup: inventory.categoryGroup,
      city: inventory.city,
      area: inventory.area,
      width: inventory.width,
      height: inventory.height,
      quantity: 1,
      unitSellingPrice: inventory.sellingPrice || 0,
      unitInternalCost: inventory.internalCost || 0,
      notes: '',
    }]);
  };

  const updateItem = (index: number, key: keyof BuilderItem, value: string | number) =>
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));

  const save = async () => {
    if (!plan) return;
    setSaving(true);
    setError('');
    try {
      const updated = await updatePlan(plan.id, {
        title,
        items: items.map(({ inventory, startDate, endDate, quantity, unitSellingPrice, unitInternalCost, notes }) => ({
          inventory, startDate, endDate, quantity: Number(quantity), unitSellingPrice: Number(unitSellingPrice), unitInternalCost: Number(unitInternalCost), notes,
        })),
        taxPercentage: Number(taxPercentage),
        clientNotes,
        internalNotes,
      });
      setPlan(updated);
      setItems(updated.items.map(toBuilderItem));
      onChanged?.(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (status: PlanStatus) => {
    if (!plan) return;
    setSaving(true);
    try {
      const updated = await updatePlanStatus(plan.id, status);
      setPlan(updated);
      onChanged?.(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update plan status');
    } finally {
      setSaving(false);
    }
  };

  const clone = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      const cloned = await clonePlan(plan.id);
      onChanged?.(cloned);
      await loadPlan(cloned.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clone plan');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 text-white">Loading plan...</div>;
  if (!plan) return null;
  const editable = plan.status === 'Draft' && !plan.isLocked;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 px-4 py-6">
      <div className="mx-auto w-full max-w-7xl overflow-hidden rounded-lg bg-slate-50 p-5 shadow-xl">
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="text-sm text-slate-500">{plan.campaign.campaignCode} · {plan.versionLabel}</p><h2 className="mt-1 text-xl font-semibold">{plan.title}</h2><p className="mt-1 text-sm text-slate-500">{plan.campaign.client?.name}</p></div>
          <div className="flex flex-wrap gap-2"><StatusBadge status={plan.status} /><button type="button" disabled className={disabledButton}>Generate PDF — Prompt 7</button><button type="button" disabled className={disabledButton}>Share Link — Prompt 7</button><button type="button" onClick={onClose} className={secondary}>Close</button></div>
        </div>

        {error ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {plan.isLocked ? <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">This version is locked because it was shared or finalized. Create a new version to make changes.</div> : null}

        <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-5">
            {editable ? <InventorySelector selectedIds={items.map((item) => item.inventory)} onAdd={addInventory} /> : null}
            <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-200 p-4"><label className="block"><span className="text-sm font-medium text-slate-700">Plan Title</span><input value={title} disabled={!editable} onChange={(event) => setTitle(event.target.value)} className={input} /></label></div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500"><tr>{['Inventory', 'Location', 'Dates', 'Qty', 'Selling', 'Internal Cost', 'Total', 'Margin', 'Notes', ''].map((heading) => <th key={heading} className="px-3 py-2 font-medium">{heading}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.items.map((item, index) => <tr key={item.inventory}>
                      <td className="px-3 py-3"><p className="font-medium">{item.inventoryCode}</p><p className="text-xs text-slate-500">{item.title}</p></td>
                      <td className="px-3 py-3 text-slate-600">{item.city} / {item.area}<br />{item.width && item.height ? `${item.width} x ${item.height}` : ''}</td>
                      <td className="px-3 py-3"><input type="date" disabled={!editable} value={item.startDate || ''} onChange={(event) => updateItem(index, 'startDate', event.target.value)} className={tableInput} /><input type="date" disabled={!editable} value={item.endDate || ''} onChange={(event) => updateItem(index, 'endDate', event.target.value)} className={`${tableInput} mt-1`} /></td>
                      <td className="px-3 py-3"><input type="number" min="1" disabled={!editable} value={item.quantity || 1} onChange={(event) => updateItem(index, 'quantity', event.target.value)} className={smallInput} /></td>
                      <td className="px-3 py-3"><input type="number" disabled={!editable} value={item.unitSellingPrice || 0} onChange={(event) => updateItem(index, 'unitSellingPrice', event.target.value)} className={priceInput} /></td>
                      <td className="px-3 py-3"><input type="number" disabled={!editable} value={item.unitInternalCost || 0} onChange={(event) => updateItem(index, 'unitInternalCost', event.target.value)} className={priceInput} /></td>
                      <td className="px-3 py-3 font-medium">{currency(item.totalSellingPrice)}</td>
                      <td className="px-3 py-3 text-slate-600">{currency(item.marginAmount)}</td>
                      <td className="px-3 py-3"><input disabled={!editable} value={item.notes || ''} onChange={(event) => updateItem(index, 'notes', event.target.value)} className={tableInput} /></td>
                      <td className="px-3 py-3">{editable ? <button type="button" onClick={() => setItems((current) => current.filter((_, i) => i !== index))} className="text-xs font-medium text-red-600">Remove</button> : null}</td>
                    </tr>)}
                  </tbody>
                </table>
                {!items.length ? <p className="p-6 text-center text-sm text-slate-500">No inventory selected yet.</p> : null}
              </div>
            </section>
            <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-2">
              <label><span className="text-sm font-medium text-slate-700">Client Notes</span><textarea disabled={!editable} value={clientNotes} onChange={(event) => setClientNotes(event.target.value)} rows={4} className={input} /></label>
              <label><span className="text-sm font-medium text-slate-700">Internal Notes</span><textarea disabled={!editable} value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} rows={4} className={input} /></label>
            </section>
          </div>

          <aside className="h-fit min-w-0 rounded-lg border border-slate-200 bg-white p-4 xl:sticky xl:top-4">
            <h3 className="font-semibold">Pricing Summary</h3>
            <label className="mt-4 block"><span className="text-sm text-slate-600">Tax Percentage</span><input type="number" disabled={!editable} value={taxPercentage} onChange={(event) => setTaxPercentage(Number(event.target.value))} className={input} /></label>
            <dl className="mt-4 space-y-3 text-sm"><Price label="Subtotal" value={preview.subtotal} /><Price label="Tax" value={preview.taxAmount} /><Price label="Grand Total" value={preview.grandTotal} strong /><Price label="Internal Cost" value={preview.internalCostTotal} /><Price label="Margin" value={preview.marginAmount} /><div className="flex justify-between border-t border-slate-200 pt-3"><dt>Margin %</dt><dd className="font-semibold">{preview.marginPercentage.toFixed(2)}%</dd></div></dl>
            <div className="mt-5 space-y-2">
              {editable ? <><button type="button" disabled={saving} onClick={save} className={`${primary} w-full`}>Save Draft</button><button type="button" disabled={saving} onClick={() => changeStatus('Shared')} className={`${secondary} w-full`}>Mark Shared</button></> : <button type="button" disabled={saving} onClick={clone} className={`${primary} w-full`}>Clone as New Version</button>}
              {plan.status === 'Shared' ? <><button type="button" onClick={() => changeStatus('Negotiating')} className={`${secondary} w-full`}>Mark Negotiating</button><button type="button" onClick={() => changeStatus('Won')} className={`${secondary} w-full`}>Mark Won</button><button type="button" onClick={() => changeStatus('Lost')} className={`${secondary} w-full`}>Mark Lost</button></> : null}
              {plan.status === 'Negotiating' ? <><button type="button" onClick={() => changeStatus('Won')} className={`${secondary} w-full`}>Mark Won</button><button type="button" onClick={() => changeStatus('Lost')} className={`${secondary} w-full`}>Mark Lost</button></> : null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

const currency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const Price = ({ label, value, strong }: { label: string; value: number; strong?: boolean }) => <div className={`flex justify-between ${strong ? 'border-y border-slate-200 py-3 text-base font-semibold' : ''}`}><dt>{label}</dt><dd>{currency(value)}</dd></div>;
const StatusBadge = ({ status }: { status: PlanStatus }) => <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">{status}</span>;
const input = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 disabled:bg-slate-100';
const tableInput = 'w-36 rounded-md border border-slate-300 px-2 py-1.5 text-xs disabled:bg-slate-100';
const smallInput = 'w-16 rounded-md border border-slate-300 px-2 py-1.5 text-xs disabled:bg-slate-100';
const priceInput = 'w-28 rounded-md border border-slate-300 px-2 py-1.5 text-xs disabled:bg-slate-100';
const primary = 'rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400';
const secondary = 'rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100';
const disabledButton = 'rounded-md bg-slate-100 px-3 py-2 text-xs font-medium text-slate-400';

export default PlanBuilder;
