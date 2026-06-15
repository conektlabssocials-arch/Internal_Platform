import { FormEvent, useState } from 'react';

import type { CrmEntity, CrmEntityPayload, CrmEntityType } from '../../types/crm';

const entityTypes: CrmEntityType[] = ['Brand', 'Agency', 'Individual', 'SupplierOwner'];

type FormState = {
  entityType: CrmEntityType;
  name: string;
  displayName: string;
  email: string;
  phone: string;
  whatsapp: string;
  website: string;
  gstNumber: string;
  panNumber: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  legalName: string;
  billingGstNumber: string;
  billingEmail: string;
  billingPhone: string;
  billingAddress: string;
  tags: string;
  files: string;
  notes: string;
};

const getInitialState = (
  entityType: CrmEntityType,
  entity?: CrmEntity | null,
): FormState => ({
  entityType: entity?.entityType || entityType,
  name: entity?.name || '',
  displayName: entity?.displayName || '',
  email: entity?.email || '',
  phone: entity?.phone || '',
  whatsapp: entity?.whatsapp || '',
  website: entity?.website || '',
  gstNumber: entity?.gstNumber || '',
  panNumber: entity?.panNumber || '',
  line1: entity?.address?.line1 || '',
  line2: entity?.address?.line2 || '',
  city: entity?.address?.city || '',
  state: entity?.address?.state || '',
  pincode: entity?.address?.pincode || '',
  country: entity?.address?.country || 'India',
  legalName: entity?.billingDetails?.legalName || '',
  billingGstNumber: entity?.billingDetails?.gstNumber || '',
  billingEmail: entity?.billingDetails?.billingEmail || '',
  billingPhone: entity?.billingDetails?.billingPhone || '',
  billingAddress: entity?.billingDetails?.billingAddress || '',
  tags: entity?.tags.join(', ') || '',
  files: entity?.files.join(', ') || '',
  notes: entity?.notes || '',
});

type CrmEntityFormProps = {
  entityType: CrmEntityType;
  entity?: CrmEntity | null;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: CrmEntityPayload) => Promise<void>;
};

const CrmEntityForm = ({
  entityType,
  entity,
  saving,
  onClose,
  onSave,
}: CrmEntityFormProps) => {
  const [form, setForm] = useState(() => getInitialState(entityType, entity));

  const update = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSave({
      entityType: form.entityType,
      name: form.name,
      displayName: form.displayName,
      email: form.email,
      phone: form.phone,
      whatsapp: form.whatsapp,
      website: form.website,
      gstNumber: form.gstNumber,
      panNumber: form.panNumber,
      address: {
        line1: form.line1,
        line2: form.line2,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        country: form.country,
      },
      billingDetails: {
        legalName: form.legalName,
        gstNumber: form.billingGstNumber,
        billingEmail: form.billingEmail,
        billingPhone: form.billingPhone,
        billingAddress: form.billingAddress,
      },
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      files: form.files
        .split(',')
        .map((file) => file.trim())
        .filter(Boolean),
      notes: form.notes,
    });
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/40 px-4 py-8">
      <form
        onSubmit={submit}
        className="mx-auto max-w-5xl rounded-lg bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">
              {entity ? 'Edit CRM Record' : 'Add CRM Record'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Store client, agency, advertiser, or supplier details.
            </p>
          </div>
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Close
          </button>
        </div>

        <div className="mt-6 space-y-5">
          <FormSection title="Basic Details">
            <SelectField
              label="Entity Type"
              value={form.entityType}
              options={entityTypes}
              onChange={(value) => update('entityType', value as CrmEntityType)}
              disabled={Boolean(entity) || Boolean(entityType)}
            />
            <TextField label="Name" value={form.name} onChange={(value) => update('name', value)} required />
            <TextField label="Display Name" value={form.displayName} onChange={(value) => update('displayName', value)} />
            <TextField label="Email" type="email" value={form.email} onChange={(value) => update('email', value)} />
            <TextField label="Phone" value={form.phone} onChange={(value) => update('phone', value)} />
            <TextField label="WhatsApp" value={form.whatsapp} onChange={(value) => update('whatsapp', value)} />
            <TextField label="Website" value={form.website} onChange={(value) => update('website', value)} />
            <TextField label="GST Number" value={form.gstNumber} onChange={(value) => update('gstNumber', value)} />
            <TextField label="PAN Number" value={form.panNumber} onChange={(value) => update('panNumber', value)} />
          </FormSection>

          <FormSection title="Address">
            <TextField label="Address Line 1" value={form.line1} onChange={(value) => update('line1', value)} />
            <TextField label="Address Line 2" value={form.line2} onChange={(value) => update('line2', value)} />
            <TextField label="City" value={form.city} onChange={(value) => update('city', value)} />
            <TextField label="State" value={form.state} onChange={(value) => update('state', value)} />
            <TextField label="Pincode" value={form.pincode} onChange={(value) => update('pincode', value)} />
            <TextField label="Country" value={form.country} onChange={(value) => update('country', value)} />
          </FormSection>

          <FormSection title="Billing Details">
            <TextField label="Legal Name" value={form.legalName} onChange={(value) => update('legalName', value)} />
            <TextField label="Billing GST Number" value={form.billingGstNumber} onChange={(value) => update('billingGstNumber', value)} />
            <TextField label="Billing Email" type="email" value={form.billingEmail} onChange={(value) => update('billingEmail', value)} />
            <TextField label="Billing Phone" value={form.billingPhone} onChange={(value) => update('billingPhone', value)} />
            <TextField label="Billing Address" value={form.billingAddress} onChange={(value) => update('billingAddress', value)} />
          </FormSection>

          <FormSection title="Internal Details">
            <TextField label="Tags" value={form.tags} onChange={(value) => update('tags', value)} helper="Separate tags with commas." />
            <TextField label="File URLs" value={form.files} onChange={(value) => update('files', value)} helper="Separate file links with commas." />
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Notes</span>
              <textarea
                value={form.notes}
                onChange={(event) => update('notes', event.target.value)}
                rows={3}
                className={inputClass}
              />
            </label>
          </FormSection>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={primaryButtonClass}>
            {saving ? 'Saving...' : 'Save Record'}
          </button>
        </div>
      </form>
    </div>
  );
};

const inputClass =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900';
const secondaryButtonClass =
  'rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100';
const primaryButtonClass =
  'rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-400';

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  helper?: string;
};

const TextField = ({ label, value, onChange, required, type = 'text', helper }: FieldProps) => (
  <label className="block">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      className={inputClass}
    />
    {helper ? <span className="mt-1 block text-xs text-slate-500">{helper}</span> : null}
  </label>
);

const SelectField = ({
  label,
  value,
  options,
  onChange,
  disabled,
}: FieldProps & { options: readonly string[]; disabled?: boolean }) => (
  <label className="block">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className={`${inputClass} disabled:bg-slate-100`}
    >
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  </label>
);

const FormSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
    <h3 className="mb-3 font-semibold text-slate-900">{title}</h3>
    <div className="grid gap-4 md:grid-cols-3">{children}</div>
  </section>
);

export default CrmEntityForm;
