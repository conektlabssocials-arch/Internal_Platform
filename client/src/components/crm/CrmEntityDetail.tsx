import type { Contact, CrmEntity } from '../../types/crm';
import ActivityTimeline from '../activity/ActivityTimeline';

type CrmEntityDetailProps = {
  entity: CrmEntity;
  onClose: () => void;
  onEditEntity: () => void;
  onAddContact: () => void;
  onEditContact: (contact: Contact) => void;
  onToggleContact: (contact: Contact) => void;
  onDeleteContact: (contact: Contact) => void;
  readOnly?: boolean;
};

const CrmEntityDetail = ({
  entity,
  onClose,
  onEditEntity,
  onAddContact,
  onEditContact,
  onToggleContact,
  onDeleteContact,
  readOnly = false,
}: CrmEntityDetailProps) => (
  <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/40 px-4 py-8">
    <div className="mx-auto max-w-5xl rounded-lg bg-white p-6 shadow-xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{entity.displayName || entity.name}</h2>
            <StatusBadge status={entity.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{entity.entityType}</p>
        </div>
        <div className="flex gap-2">
          {!readOnly ? <button type="button" onClick={onEditEntity} className={secondaryButtonClass}>Edit</button> : null}
          <button type="button" onClick={onClose} className={secondaryButtonClass}>Close</button>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <DetailSection title="Basic Details">
          <Detail label="Name" value={entity.name} />
          <Detail label="Email" value={entity.email} />
          <Detail label="Phone" value={entity.phone} />
          <Detail label="WhatsApp" value={entity.whatsapp} />
          <Detail label="Website" value={entity.website} />
          <Detail label="GST / PAN" value={[entity.gstNumber, entity.panNumber].filter(Boolean).join(' / ')} />
        </DetailSection>

        <DetailSection title="Address">
          <Detail label="Address" value={[entity.address?.line1, entity.address?.line2].filter(Boolean).join(', ')} />
          <Detail label="City" value={entity.address?.city} />
          <Detail label="State" value={entity.address?.state} />
          <Detail label="Pincode" value={entity.address?.pincode} />
          <Detail label="Country" value={entity.address?.country} />
        </DetailSection>

        <DetailSection title="Billing Details">
          <Detail label="Legal Name" value={entity.billingDetails?.legalName} />
          <Detail label="GST Number" value={entity.billingDetails?.gstNumber} />
          <Detail label="Billing Email" value={entity.billingDetails?.billingEmail} />
          <Detail label="Billing Phone" value={entity.billingDetails?.billingPhone} />
          <Detail label="Billing Address" value={entity.billingDetails?.billingAddress} />
        </DetailSection>

        <DetailSection title="Internal Details">
          <Detail label="Tags" value={entity.tags.join(', ')} />
          <Detail label="Notes" value={entity.notes} />
          <Detail label="Campaigns" value="Linked campaigns will appear here later." />
        </DetailSection>
      </div>

      {entity.files.length > 0 ? (
        <section className="mt-5 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
          <h3 className="font-semibold text-slate-900">Files</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {entity.files.map((file, index) => (
              <a
                key={file}
                href={file}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Open file {index + 1}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {entity.entityType === 'SupplierOwner' ? (
        <section className="mt-5 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-semibold text-slate-900">Linked Inventory</h3>
            <span className="text-sm font-medium text-slate-600">
              {entity.linkedInventoryCount || 0} items
            </span>
          </div>
          {entity.linkedInventoryPreview?.length ? (
            <div className="mt-3 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
              {entity.linkedInventoryPreview.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">{item.inventoryCode}</p>
                  </div>
                  <span className="text-slate-500">{item.categoryGroup}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No inventory is linked yet.</p>
          )}
        </section>
      ) : null}

      <section className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3">
          <div>
            <h3 className="font-semibold text-slate-900">Contacts</h3>
            <p className="mt-1 text-xs text-slate-500">People associated with this CRM record.</p>
          </div>
          {!readOnly ? <button type="button" onClick={onAddContact} className={primaryButtonClass}>Add Contact</button> : null}
        </div>

        {entity.contacts?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  {!readOnly ? <th className="px-4 py-3 font-medium">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entity.contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        {contact.name}
                        {contact.isPrimary ? (
                          <span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">Primary</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{contact.role || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{contact.phone || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{contact.email || '-'}</td>
                    <td className="px-4 py-3"><StatusBadge status={contact.status} /></td>
                    {!readOnly ? <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => onEditContact(contact)} className={smallButtonClass}>Edit</button>
                        <button type="button" onClick={() => onToggleContact(contact)} className={smallButtonClass}>
                          {contact.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button type="button" onClick={() => onDeleteContact(contact)} className={smallButtonClass}>Delete</button>
                      </div>
                    </td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-5 text-sm text-slate-500">No contacts added yet.</p>
        )}
      </section>

      <div className="mt-5">
        <ActivityTimeline entityType="CRM" entityId={entity.id} />
      </div>
    </div>
  </div>
);

const DetailSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
    <h3 className="mb-3 font-semibold text-slate-900">{title}</h3>
    <dl className="grid gap-3 sm:grid-cols-2">{children}</dl>
  </section>
);

const Detail = ({ label, value }: { label: string; value?: string }) => (
  <div>
    <dt className="text-xs font-medium text-slate-500">{label}</dt>
    <dd className="mt-1 text-sm text-slate-900">{value || '-'}</dd>
  </div>
);

const StatusBadge = ({ status }: { status: 'active' | 'inactive' }) => (
  <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
    {status}
  </span>
);

const secondaryButtonClass = 'rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100';
const primaryButtonClass = 'rounded-md bg-emerald-800 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700';
const smallButtonClass = 'rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100';

export default CrmEntityDetail;
