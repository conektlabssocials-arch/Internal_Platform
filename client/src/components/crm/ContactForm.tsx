import { FormEvent, useState } from 'react';

import type { Contact, ContactPayload } from '../../types/crm';

type ContactFormProps = {
  contact?: Contact | null;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: ContactPayload) => Promise<void>;
};

const ContactForm = ({ contact, saving, onClose, onSave }: ContactFormProps) => {
  const [name, setName] = useState(contact?.name || '');
  const [role, setRole] = useState(contact?.role || '');
  const [phone, setPhone] = useState(contact?.phone || '');
  const [email, setEmail] = useState(contact?.email || '');
  const [whatsapp, setWhatsapp] = useState(contact?.whatsapp || '');
  const [isPrimary, setIsPrimary] = useState(contact?.isPrimary || false);
  const [notes, setNotes] = useState(contact?.notes || '');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSave({ name, role, phone, email, whatsapp, isPrimary, notes });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
      <form onSubmit={submit} className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{contact ? 'Edit Contact' : 'Add Contact'}</h2>
            <p className="mt-1 text-sm text-slate-500">Manage a person linked to this CRM record.</p>
          </div>
          <button type="button" onClick={onClose} className={secondaryButtonClass}>Close</button>
        </div>

        <div className="mt-5 grid gap-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-2">
          <TextField label="Name" value={name} onChange={setName} required />
          <TextField label="Role" value={role} onChange={setRole} />
          <TextField label="Phone" value={phone} onChange={setPhone} />
          <TextField label="Email" value={email} onChange={setEmail} type="email" />
          <TextField label="WhatsApp" value={whatsapp} onChange={setWhatsapp} />
          <label className="flex items-center gap-2 self-end rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" checked={isPrimary} onChange={(event) => setIsPrimary(event.target.checked)} />
            Primary contact
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Notes</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className={inputClass} />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
          <button type="submit" disabled={saving} className={primaryButtonClass}>
            {saving ? 'Saving...' : 'Save Contact'}
          </button>
        </div>
      </form>
    </div>
  );
};

const inputClass = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900';
const secondaryButtonClass = 'rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100';
const primaryButtonClass = 'rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400';

const TextField = ({
  label,
  value,
  onChange,
  required,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) => (
  <label className="block">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    <input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} className={inputClass} />
  </label>
);

export default ContactForm;
