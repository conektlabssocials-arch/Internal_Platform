import { useEffect, useState } from 'react';

import {
  updateCreative,
  updateMounting,
  updateOperationItem,
  updatePO,
  updateProof,
  updateTakedown,
} from '../../api/operationApi';
import type {
  Operation,
  OperationItem,
  OperationItemStatus,
} from '../../types/operation';
import OperationStatusBadge from './OperationStatusBadge';

const itemStatuses: OperationItemStatus[] = [
  'Pending',
  'Creative Pending',
  'PO Pending',
  'Mounting Scheduled',
  'Mounted',
  'Proof Uploaded',
  'Completed',
  'On Hold',
  'Cancelled',
];

const OperationItemTracker = ({
  operationId,
  item,
  onUpdated,
}: {
  operationId: string;
  item: OperationItem;
  onUpdated: (operation: Operation) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(item);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');

  useEffect(() => setDraft(item), [item]);

  const save = async (
    section: string,
    action: () => Promise<Operation>,
  ) => {
    setSaving(section);
    setError('');
    try {
      onUpdated(await action());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item');
    } finally {
      setSaving('');
    }
  };

  const overdue =
    draft.mounting.scheduledDate &&
    new Date(draft.mounting.scheduledDate) < startOfToday() &&
    !draft.mounting.completed;
  const proofPending = draft.mounting.completed && !draft.proof.uploaded;

  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="grid w-full gap-3 p-4 text-left hover:bg-slate-50 md:grid-cols-[1.2fr_1fr_auto]"
      >
        <div>
          <p className="text-xs font-semibold text-slate-500">{draft.inventoryCode}</p>
          <h3 className="mt-1 font-semibold text-slate-900">{draft.title}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {draft.categoryGroup} / {draft.subCategory} · {draft.city} / {draft.area}
          </p>
        </div>
        <div className="text-xs leading-5 text-slate-600">
          <p>{draft.location?.address || draft.route || draft.itinerary || '-'}</p>
          {draft.depot ? <p>Depot: {draft.depot}</p> : null}
          <p>{formatDate(draft.campaignStartDate)} - {formatDate(draft.campaignEndDate)}</p>
        </div>
        <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
          {overdue ? <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">Overdue</span> : null}
          {proofPending ? <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800">Proof Pending</span> : null}
          <OperationStatusBadge status={draft.itemStatus} />
          <span className="text-xs font-medium text-slate-500">{expanded ? 'Collapse' : 'Track'}</span>
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-slate-200 p-4">
          {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
          <div className="grid gap-x-6 gap-y-5 xl:grid-cols-2">
            <TrackerSection title="General">
              <Field label="Supplier name" value={draft.supplierName} onChange={(value) => setDraft({ ...draft, supplierName: value })} />
              <Field label="Owner name" value={draft.ownerName} onChange={(value) => setDraft({ ...draft, ownerName: value })} />
              <label>
                <span className={label}>Item status</span>
                <select value={draft.itemStatus} onChange={(event) => setDraft({ ...draft, itemStatus: event.target.value as OperationItemStatus })} className={input}>
                  {itemStatuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              <TextArea label="Notes" value={draft.notes} onChange={(value) => setDraft({ ...draft, notes: value })} />
              <SaveButton loading={saving === 'general'} onClick={() => void save('general', () => updateOperationItem(operationId, draft.id, {
                supplierName: draft.supplierName,
                ownerName: draft.ownerName,
                itemStatus: draft.itemStatus,
                notes: draft.notes,
              }))} />
            </TrackerSection>

            <TrackerSection title="Creative">
              <Checks
                firstLabel="Creative required"
                first={draft.creative.required}
                secondLabel="Creative received"
                second={draft.creative.received}
                onFirst={(required) => setDraft({ ...draft, creative: { ...draft.creative, required } })}
                onSecond={(received) => setDraft({ ...draft, creative: { ...draft.creative, received } })}
              />
              <Field label="File URLs, comma-separated" value={draft.creative.fileUrls.join(', ')} onChange={(value) => setDraft({ ...draft, creative: { ...draft.creative, fileUrls: splitUrls(value) } })} />
              <TextArea label="Notes" value={draft.creative.notes} onChange={(notes) => setDraft({ ...draft, creative: { ...draft.creative, notes } })} />
              <SaveButton loading={saving === 'creative'} onClick={() => void save('creative', () => updateCreative(operationId, draft.id, draft.creative))} />
            </TrackerSection>

            <TrackerSection title="Purchase Order">
              <Checks
                firstLabel="PO required"
                first={draft.purchaseOrder.required}
                secondLabel="PO sent"
                second={draft.purchaseOrder.sent}
                onFirst={(required) => setDraft({ ...draft, purchaseOrder: { ...draft.purchaseOrder, required } })}
                onSecond={(sent) => setDraft({ ...draft, purchaseOrder: { ...draft.purchaseOrder, sent } })}
              />
              <Field label="PO number" value={draft.purchaseOrder.poNumber} onChange={(poNumber) => setDraft({ ...draft, purchaseOrder: { ...draft.purchaseOrder, poNumber } })} />
              <Field label="PO file URL" value={draft.purchaseOrder.poFileUrl} onChange={(poFileUrl) => setDraft({ ...draft, purchaseOrder: { ...draft.purchaseOrder, poFileUrl } })} />
              <TextArea label="Notes" value={draft.purchaseOrder.notes} onChange={(notes) => setDraft({ ...draft, purchaseOrder: { ...draft.purchaseOrder, notes } })} />
              <SaveButton loading={saving === 'po'} onClick={() => void save('po', () => updatePO(operationId, draft.id, draft.purchaseOrder))} />
            </TrackerSection>

            <TrackerSection title="Mounting / Deployment">
              <Field type="date" label="Scheduled date" value={dateInput(draft.mounting.scheduledDate)} onChange={(scheduledDate) => setDraft({ ...draft, mounting: { ...draft.mounting, scheduledDate } })} />
              <Check label="Mounting completed" checked={draft.mounting.completed} onChange={(completed) => setDraft({ ...draft, mounting: { ...draft.mounting, completed } })} />
              <TextArea label="Vendor notes" value={draft.mounting.vendorNotes} onChange={(vendorNotes) => setDraft({ ...draft, mounting: { ...draft.mounting, vendorNotes } })} />
              <TextArea label="Internal notes" value={draft.mounting.internalNotes} onChange={(internalNotes) => setDraft({ ...draft, mounting: { ...draft.mounting, internalNotes } })} />
              <SaveButton loading={saving === 'mounting'} onClick={() => void save('mounting', () => updateMounting(operationId, draft.id, draft.mounting))} />
            </TrackerSection>

            <TrackerSection title="Proof of Execution">
              <Check label="Proof uploaded" checked={draft.proof.uploaded} onChange={(uploaded) => setDraft({ ...draft, proof: { ...draft.proof, uploaded } })} />
              <Field label="Photo URLs, comma-separated" value={draft.proof.photoUrls.join(', ')} onChange={(value) => setDraft({ ...draft, proof: { ...draft.proof, photoUrls: splitUrls(value) } })} />
              <TextArea label="Notes" value={draft.proof.notes} onChange={(notes) => setDraft({ ...draft, proof: { ...draft.proof, notes } })} />
              <SaveButton loading={saving === 'proof'} onClick={() => void save('proof', () => updateProof(operationId, draft.id, draft.proof))} />
            </TrackerSection>

            <TrackerSection title="Takedown">
              <Check label="Takedown required" checked={draft.takedown.required} onChange={(required) => setDraft({ ...draft, takedown: { ...draft.takedown, required } })} />
              <Field type="date" label="Scheduled date" value={dateInput(draft.takedown.scheduledDate)} onChange={(scheduledDate) => setDraft({ ...draft, takedown: { ...draft.takedown, scheduledDate } })} />
              <Check label="Takedown completed" checked={draft.takedown.completed} onChange={(completed) => setDraft({ ...draft, takedown: { ...draft.takedown, completed } })} />
              <TextArea label="Notes" value={draft.takedown.notes} onChange={(notes) => setDraft({ ...draft, takedown: { ...draft.takedown, notes } })} />
              <SaveButton loading={saving === 'takedown'} onClick={() => void save('takedown', () => updateTakedown(operationId, draft.id, draft.takedown))} />
            </TrackerSection>
          </div>
        </div>
      ) : null}
    </section>
  );
};

const TrackerSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="border-t border-slate-200 pt-4">
    <h4 className="mb-3 text-sm font-semibold text-slate-900">{title}</h4>
    <div className="space-y-3">{children}</div>
  </section>
);
const Field = ({ label: text, value, type = 'text', onChange }: { label: string; value?: string; type?: string; onChange: (value: string) => void }) => (
  <label className="block"><span className={label}>{text}</span><input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} className={input} /></label>
);
const TextArea = ({ label: text, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) => (
  <label className="block"><span className={label}>{text}</span><textarea rows={2} value={value || ''} onChange={(event) => onChange(event.target.value)} className={input} /></label>
);
const Check = ({ label: text, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) => (
  <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{text}</label>
);
const Checks = ({ firstLabel, first, secondLabel, second, onFirst, onSecond }: { firstLabel: string; first: boolean; secondLabel: string; second: boolean; onFirst: (value: boolean) => void; onSecond: (value: boolean) => void }) => (
  <div className="flex flex-wrap gap-4"><Check label={firstLabel} checked={first} onChange={onFirst} /><Check label={secondLabel} checked={second} onChange={onSecond} /></div>
);
const SaveButton = ({ loading, onClick }: { loading: boolean; onClick: () => void }) => (
  <button type="button" disabled={loading} onClick={onClick} className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700 disabled:bg-slate-400">{loading ? 'Saving...' : 'Save'}</button>
);

const label = 'text-xs font-medium text-slate-600';
const input = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900';
const splitUrls = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const dateInput = (value?: string) => value?.slice(0, 10) || '';
const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '-';
const startOfToday = () => { const date = new Date(); date.setHours(0, 0, 0, 0); return date; };

export default OperationItemTracker;
