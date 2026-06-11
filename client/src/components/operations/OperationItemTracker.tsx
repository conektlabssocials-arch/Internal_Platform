import { useEffect, useMemo, useState } from 'react';

import {
  getOperationById,
  updateCreative,
  updateMounting,
  updateOperationItem,
  updatePO,
  updateProof,
  updateTakedown,
} from '../../api/operationApi';
import {
  deleteUpload,
  getUploads,
  uploadOperationCreative,
  uploadOperationPO,
  uploadOperationProof,
} from '../../api/uploadApi';
import { useAuth } from '../../context/AuthContext';
import type {
  Operation,
  OperationItem,
  OperationItemStatus,
} from '../../types/operation';
import type { UploadCategory, UploadedFile } from '../../types/upload';
import FileUploadDropzone from '../uploads/FileUploadDropzone';
import ImagePreviewGrid from '../uploads/ImagePreviewGrid';
import UploadedFileList from '../uploads/UploadedFileList';
import OperationStatusBadge from './OperationStatusBadge';

type ItemStage = 'details' | 'creative' | 'po' | 'mounting' | 'proof' | 'takedown';

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
  readOnly = false,
}: {
  operationId: string;
  item: OperationItem;
  onUpdated: (operation: Operation) => void;
  readOnly?: boolean;
}) => {
  const { isAdmin, can } = useAuth();
  const canUpload = can('uploads.manage');
  const [expanded, setExpanded] = useState(false);
  const [activeStage, setActiveStage] = useState<ItemStage>('details');
  const [draft, setDraft] = useState(item);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState<UploadCategory | ''>('');
  const [deletingId, setDeletingId] = useState('');

  useEffect(() => setDraft(item), [item]);

  const loadUploads = async () => {
    setUploads(await getUploads({
      entityType: 'OperationItem',
      entityId: operationId,
      itemId: item.id,
    }));
  };

  useEffect(() => {
    if (expanded) {
      void loadUploads().catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load files'),
      );
    }
  }, [expanded, item.id, operationId]);

  const save = async (section: string, action: () => Promise<Operation>) => {
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
  const filesByCategory = (category: UploadCategory) =>
    uploads.filter((upload) => upload.category === category);

  const stages = useMemo(
    () => [
      {
        id: 'creative' as const,
        label: 'Creative',
        done: !draft.creative.required || draft.creative.received,
        required: draft.creative.required,
      },
      {
        id: 'po' as const,
        label: 'PO',
        done: !draft.purchaseOrder.required || draft.purchaseOrder.sent,
        required: draft.purchaseOrder.required,
      },
      {
        id: 'mounting' as const,
        label: 'Mounting',
        done: draft.mounting.completed,
        required: true,
      },
      {
        id: 'proof' as const,
        label: 'Proof',
        done: draft.proof.uploaded,
        required: true,
      },
      {
        id: 'takedown' as const,
        label: 'Takedown',
        done: !draft.takedown.required || draft.takedown.completed,
        required: draft.takedown.required,
      },
    ],
    [draft],
  );

  const nextAction = useMemo(() => {
    if (draft.creative.required && !draft.creative.received) return { stage: 'creative' as const, text: 'Receive creative' };
    if (draft.purchaseOrder.required && !draft.purchaseOrder.sent) return { stage: 'po' as const, text: 'Send purchase order' };
    if (!draft.mounting.scheduledDate) return { stage: 'mounting' as const, text: 'Schedule mounting' };
    if (!draft.mounting.completed) return { stage: 'mounting' as const, text: overdue ? 'Complete overdue mounting' : 'Complete mounting' };
    if (!draft.proof.uploaded) return { stage: 'proof' as const, text: 'Upload proof photos' };
    if (draft.takedown.required && !draft.takedown.completed) return { stage: 'takedown' as const, text: 'Complete takedown' };
    return { stage: 'details' as const, text: 'Execution complete' };
  }, [draft, overdue]);

  const uploadFiles = async (
    category: 'creative' | 'purchase_order' | 'proof',
    files: File[],
  ) => {
    setUploading(category);
    setError('');
    try {
      const response =
        category === 'creative'
          ? await uploadOperationCreative(operationId, item.id, files)
          : category === 'purchase_order'
            ? await uploadOperationPO(operationId, item.id, files)
            : await uploadOperationProof(operationId, item.id, files);
      onUpdated(response.operation);
      await loadUploads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      throw err;
    } finally {
      setUploading('');
    }
  };

  const removeUpload = async (upload: UploadedFile) => {
    if (!window.confirm(`Delete ${upload.originalName}?`)) return;
    setDeletingId(upload.id);
    setError('');
    try {
      await deleteUpload(upload.id);
      onUpdated(await getOperationById(operationId));
      await loadUploads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingId('');
    }
  };

  const openStage = (stage: ItemStage) => {
    setExpanded(true);
    setActiveStage(stage);
  };

  return (
    <section className={`overflow-hidden rounded-md border bg-white ${overdue ? 'border-red-200' : 'border-slate-200'}`}>
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(220px,1.2fr)_minmax(420px,2fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-emerald-700">{draft.inventoryCode}</p>
            <OperationStatusBadge status={draft.itemStatus} />
          </div>
          <h3 className="mt-1 truncate font-semibold text-slate-900">{draft.title}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {draft.categoryGroup} / {draft.subCategory} · {draft.city} / {draft.area}
          </p>
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="grid min-w-[420px] grid-cols-5 gap-2">
            {stages.map((stage) => (
              <button
                key={stage.id}
                type="button"
                disabled={readOnly}
                onClick={() => openStage(stage.id)}
                className="group min-w-0 rounded-md px-1 py-1 text-left hover:bg-slate-50"
                title={`${stage.label}: ${stage.done ? 'Complete' : stage.required ? 'Pending' : 'Not required'}`}
              >
                <span className={`block h-1.5 rounded-full ${
                  stage.done
                    ? 'bg-emerald-500'
                    : stage.required
                      ? 'bg-amber-300'
                      : 'bg-slate-200'
                }`} />
                <span className={`mt-1 block truncate text-[11px] font-medium ${
                  stage.done ? 'text-emerald-700' : stage.required ? 'text-slate-600' : 'text-slate-400'
                }`}>
                  {stage.label}
                </span>
              </button>
            ))}
          </div>
          {!readOnly ? <button
            type="button"
            onClick={() => openStage(nextAction.stage)}
            className={`mt-2 rounded-md px-2 py-1 text-xs font-semibold ${
              nextAction.text === 'Execution complete'
                ? 'text-emerald-700'
                : overdue
                  ? 'text-red-700'
                  : 'text-slate-700 hover:text-emerald-700'
            }`}
          >
            {nextAction.text === 'Execution complete' ? 'Complete' : `Next: ${nextAction.text}`}
          </button> : <p className="mt-2 text-xs text-slate-500">Read-only execution access</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {overdue ? <AlertBadge tone="red">Mounting overdue</AlertBadge> : null}
          {proofPending ? <AlertBadge tone="amber">Proof pending</AlertBadge> : null}
          {!readOnly ? <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {expanded ? 'Close Tracker' : 'Open Tracker'}
          </button> : null}
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-slate-200 bg-slate-50">
          <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3">
            <StageTab id="details" label="Details" active={activeStage} onSelect={setActiveStage} />
            {stages.map((stage) => (
              <StageTab
                key={stage.id}
                id={stage.id}
                label={stage.label}
                active={activeStage}
                onSelect={setActiveStage}
                done={stage.done}
              />
            ))}
          </div>

          <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="rounded-md border border-slate-200 bg-white p-4">
              {error ? <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

              {activeStage === 'details' ? (
                <StagePanel title="Item Details" description="Supplier assignment, item status, and general execution notes.">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Supplier name" value={draft.supplierName} onChange={(value) => setDraft({ ...draft, supplierName: value })} />
                    <Field label="Owner name" value={draft.ownerName} onChange={(value) => setDraft({ ...draft, ownerName: value })} />
                  </div>
                  <label>
                    <span className={label}>Item status</span>
                    <select value={draft.itemStatus} onChange={(event) => setDraft({ ...draft, itemStatus: event.target.value as OperationItemStatus })} className={input}>
                      {itemStatuses.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </label>
                  <TextArea label="General notes" value={draft.notes} onChange={(value) => setDraft({ ...draft, notes: value })} />
                  <SaveButton label="Save Item Details" loading={saving === 'general'} onClick={() => void save('general', () => updateOperationItem(operationId, draft.id, {
                    supplierName: draft.supplierName,
                    ownerName: draft.ownerName,
                    itemStatus: draft.itemStatus,
                    notes: draft.notes,
                  }))} />
                </StagePanel>
              ) : null}

              {activeStage === 'creative' ? (
                <StagePanel title="Creative" description="Track whether artwork is required, received, and ready for execution.">
                  <Checks
                    firstLabel="Creative required"
                    first={draft.creative.required}
                    secondLabel="Creative received"
                    second={draft.creative.received}
                    onFirst={(required) => setDraft({ ...draft, creative: { ...draft.creative, required } })}
                    onSecond={(received) => setDraft({ ...draft, creative: { ...draft.creative, received } })}
                  />
                  {canUpload ? <FileUploadDropzone
                    accept={['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4', 'application/zip', 'application/x-zip-compressed']}
                    maxFiles={10}
                    maxFileSizeMb={50}
                    uploading={uploading === 'creative'}
                    label="Upload Creative Files"
                    onUpload={(files) => uploadFiles('creative', files)}
                  /> : <PermissionNote />}
                  <UploadedFileList files={filesByCategory('creative')} deletingId={deletingId} onDelete={isAdmin ? removeUpload : undefined} />
                  <Field label="Manual file URLs (optional)" value={draft.creative.fileUrls.join(', ')} onChange={(value) => setDraft({ ...draft, creative: { ...draft.creative, fileUrls: splitUrls(value) } })} />
                  <TextArea label="Creative notes" value={draft.creative.notes} onChange={(notes) => setDraft({ ...draft, creative: { ...draft.creative, notes } })} />
                  <SaveButton label="Save Creative Status" loading={saving === 'creative'} onClick={() => void save('creative', () => updateCreative(operationId, draft.id, draft.creative))} />
                </StagePanel>
              ) : null}

              {activeStage === 'po' ? (
                <StagePanel title="Purchase Order" description="Record the supplier PO and confirm when it has been sent.">
                  <Checks
                    firstLabel="PO required"
                    first={draft.purchaseOrder.required}
                    secondLabel="PO sent"
                    second={draft.purchaseOrder.sent}
                    onFirst={(required) => setDraft({ ...draft, purchaseOrder: { ...draft.purchaseOrder, required } })}
                    onSecond={(sent) => setDraft({ ...draft, purchaseOrder: { ...draft.purchaseOrder, sent } })}
                  />
                  <Field label="PO number" value={draft.purchaseOrder.poNumber} onChange={(poNumber) => setDraft({ ...draft, purchaseOrder: { ...draft.purchaseOrder, poNumber } })} />
                  {canUpload ? <FileUploadDropzone
                    accept={['application/pdf', 'image/jpeg', 'image/png', 'image/webp']}
                    maxFiles={5}
                    maxFileSizeMb={20}
                    uploading={uploading === 'purchase_order'}
                    label="Upload PO Files"
                    onUpload={(files) => uploadFiles('purchase_order', files)}
                  /> : <PermissionNote />}
                  <UploadedFileList files={filesByCategory('purchase_order')} deletingId={deletingId} onDelete={isAdmin ? removeUpload : undefined} />
                  <Field label="Manual PO file URL (optional)" value={draft.purchaseOrder.poFileUrl} onChange={(poFileUrl) => setDraft({ ...draft, purchaseOrder: { ...draft.purchaseOrder, poFileUrl } })} />
                  <TextArea label="PO notes" value={draft.purchaseOrder.notes} onChange={(notes) => setDraft({ ...draft, purchaseOrder: { ...draft.purchaseOrder, notes } })} />
                  <SaveButton label="Save PO Status" loading={saving === 'po'} onClick={() => void save('po', () => updatePO(operationId, draft.id, draft.purchaseOrder))} />
                </StagePanel>
              ) : null}

              {activeStage === 'mounting' ? (
                <StagePanel title="Mounting / Deployment" description="Schedule the work and confirm when the site has been mounted or deployed.">
                  {overdue ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">This mounting date is overdue.</p> : null}
                  <Field type="date" label="Scheduled mounting date" value={dateInput(draft.mounting.scheduledDate)} onChange={(scheduledDate) => setDraft({ ...draft, mounting: { ...draft.mounting, scheduledDate } })} />
                  <Check label="Mounting completed" checked={draft.mounting.completed} onChange={(completed) => setDraft({ ...draft, mounting: { ...draft.mounting, completed } })} />
                  <TextArea label="Vendor notes" value={draft.mounting.vendorNotes} onChange={(vendorNotes) => setDraft({ ...draft, mounting: { ...draft.mounting, vendorNotes } })} />
                  <TextArea label="Internal notes" value={draft.mounting.internalNotes} onChange={(internalNotes) => setDraft({ ...draft, mounting: { ...draft.mounting, internalNotes } })} />
                  <SaveButton label="Save Mounting Status" loading={saving === 'mounting'} onClick={() => void save('mounting', () => updateMounting(operationId, draft.id, draft.mounting))} />
                </StagePanel>
              ) : null}

              {activeStage === 'proof' ? (
                <StagePanel title="Proof of Execution" description="Upload final client-safe photos after mounting or deployment is complete.">
                  {!draft.mounting.completed ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Mounting is not marked complete yet. You can prepare proof here, but verify the deployment first.</p> : null}
                  <Check label="Proof uploaded" checked={draft.proof.uploaded} onChange={(uploaded) => setDraft({ ...draft, proof: { ...draft.proof, uploaded } })} />
                  {canUpload ? <FileUploadDropzone
                    accept={['image/jpeg', 'image/png', 'image/webp']}
                    maxFiles={20}
                    maxFileSizeMb={15}
                    uploading={uploading === 'proof'}
                    label="Upload Proof Photos"
                    onUpload={(files) => uploadFiles('proof', files)}
                  /> : <PermissionNote />}
                  <ImagePreviewGrid uploads={filesByCategory('proof')} legacyUrls={draft.proof.photoUrls} />
                  <UploadedFileList files={filesByCategory('proof')} deletingId={deletingId} onDelete={isAdmin ? removeUpload : undefined} />
                  <Field label="Manual photo URLs (optional)" value={draft.proof.photoUrls.join(', ')} onChange={(value) => setDraft({ ...draft, proof: { ...draft.proof, photoUrls: splitUrls(value) } })} />
                  <TextArea label="Proof notes" value={draft.proof.notes} onChange={(notes) => setDraft({ ...draft, proof: { ...draft.proof, notes } })} />
                  <SaveButton label="Save Proof Status" loading={saving === 'proof'} onClick={() => void save('proof', () => updateProof(operationId, draft.id, draft.proof))} />
                </StagePanel>
              ) : null}

              {activeStage === 'takedown' ? (
                <StagePanel title="Takedown" description="Schedule and confirm removal after the campaign period, when required.">
                  <Check label="Takedown required" checked={draft.takedown.required} onChange={(required) => setDraft({ ...draft, takedown: { ...draft.takedown, required } })} />
                  <Field type="date" label="Scheduled takedown date" value={dateInput(draft.takedown.scheduledDate)} onChange={(scheduledDate) => setDraft({ ...draft, takedown: { ...draft.takedown, scheduledDate } })} />
                  <Check label="Takedown completed" checked={draft.takedown.completed} onChange={(completed) => setDraft({ ...draft, takedown: { ...draft.takedown, completed } })} />
                  <TextArea label="Takedown notes" value={draft.takedown.notes} onChange={(notes) => setDraft({ ...draft, takedown: { ...draft.takedown, notes } })} />
                  <SaveButton label="Save Takedown Status" loading={saving === 'takedown'} onClick={() => void save('takedown', () => updateTakedown(operationId, draft.id, draft.takedown))} />
                </StagePanel>
              ) : null}
            </div>

            <aside className="h-fit rounded-md border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Site snapshot</p>
              <dl className="mt-3 space-y-3 text-sm">
                <Info label="Location" value={draft.location?.address || [draft.city, draft.area].filter(Boolean).join(' / ') || '-'} />
                <Info label="Route / Depot" value={[draft.route, draft.depot].filter(Boolean).join(' / ') || '-'} />
                <Info label="Campaign dates" value={`${formatDate(draft.campaignStartDate)} - ${formatDate(draft.campaignEndDate)}`} />
                <Info label="Size" value={formatSize(draft)} />
                <Info label="Supplier" value={draft.supplierName || 'Not assigned'} />
              </dl>
              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Current action</p>
                <button
                  type="button"
                  onClick={() => setActiveStage(nextAction.stage)}
                  className="mt-2 w-full rounded-md bg-emerald-50 px-3 py-2 text-left text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  {nextAction.text}
                </button>
              </div>
            </aside>
          </div>
        </div>
      ) : null}
    </section>
  );
};

const StageTab = ({
  id,
  label: text,
  active,
  done,
  onSelect,
}: {
  id: ItemStage;
  label: string;
  active: ItemStage;
  done?: boolean;
  onSelect: (stage: ItemStage) => void;
}) => (
  <button
    type="button"
    onClick={() => onSelect(id)}
    className={`whitespace-nowrap border-b-2 px-3 py-3 text-xs font-semibold ${
      active === id
        ? 'border-emerald-600 text-emerald-700'
        : 'border-transparent text-slate-500 hover:text-slate-800'
    }`}
  >
    {done ? <span className="mr-1 text-emerald-600">✓</span> : null}
    {text}
  </button>
);

const StagePanel = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <section>
    <h4 className="font-semibold text-slate-900">{title}</h4>
    <p className="mt-1 text-sm text-slate-500">{description}</p>
    <div className="mt-4 space-y-4">{children}</div>
  </section>
);

const AlertBadge = ({ tone, children }: { tone: 'red' | 'amber'; children: React.ReactNode }) => (
  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
    tone === 'red' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
  }`}>
    {children}
  </span>
);

const Info = ({ label: text, value }: { label: string; value: string }) => (
  <div>
    <dt className="text-xs text-slate-500">{text}</dt>
    <dd className="mt-0.5 break-words font-medium text-slate-800">{value}</dd>
  </div>
);

const Field = ({ label: text, value, type = 'text', onChange }: { label: string; value?: string; type?: string; onChange: (value: string) => void }) => (
  <label className="block"><span className={label}>{text}</span><input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} className={input} /></label>
);
const TextArea = ({ label: text, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) => (
  <label className="block"><span className={label}>{text}</span><textarea rows={3} value={value || ''} onChange={(event) => onChange(event.target.value)} className={input} /></label>
);
const Check = ({ label: text, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) => (
  <label className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2.5 text-sm ${
    checked ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-300 text-slate-700'
  }`}>
    <span>{text}</span>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4" />
  </label>
);
const Checks = ({ firstLabel, first, secondLabel, second, onFirst, onSecond }: { firstLabel: string; first: boolean; secondLabel: string; second: boolean; onFirst: (value: boolean) => void; onSecond: (value: boolean) => void }) => (
  <div className="grid gap-3 sm:grid-cols-2"><Check label={firstLabel} checked={first} onChange={onFirst} /><Check label={secondLabel} checked={second} onChange={onSecond} /></div>
);
const SaveButton = ({ label: text, loading, onClick }: { label: string; loading: boolean; onClick: () => void }) => (
  <button type="button" disabled={loading} onClick={onClick} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400">{loading ? 'Saving...' : text}</button>
);
const PermissionNote = () => (
  <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">
    File uploads are disabled for Members by Platform Settings.
  </p>
);

const label = 'text-xs font-medium text-slate-600';
const input = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600';
const splitUrls = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const dateInput = (value?: string) => value?.slice(0, 10) || '';
const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '-';
const formatSize = (item: OperationItem) =>
  item.width && item.height
    ? `${item.width} x ${item.height} ft${item.totalSqFt ? ` (${item.totalSqFt} sq ft)` : ''}`
    : item.totalSqFt
      ? `${item.totalSqFt} sq ft`
      : '-';
const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

export default OperationItemTracker;
