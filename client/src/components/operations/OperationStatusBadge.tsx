import type { OperationItemStatus, OperationStatus } from '../../types/operation';

const styles: Record<string, string> = {
  Pending: 'bg-slate-100 text-slate-700',
  'In Progress': 'bg-blue-100 text-blue-800',
  'Partially Mounted': 'bg-orange-100 text-orange-800',
  Mounted: 'bg-purple-100 text-purple-800',
  'Proof Pending': 'bg-yellow-100 text-yellow-800',
  Completed: 'bg-emerald-100 text-emerald-800',
  'On Hold': 'bg-amber-100 text-amber-800',
  Cancelled: 'bg-red-100 text-red-800',
  'Creative Pending': 'bg-yellow-100 text-yellow-800',
  'PO Pending': 'bg-orange-100 text-orange-800',
  'Mounting Scheduled': 'bg-blue-100 text-blue-800',
  'Proof Uploaded': 'bg-emerald-100 text-emerald-800',
};

const OperationStatusBadge = ({
  status,
}: {
  status: OperationStatus | OperationItemStatus;
}) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status] || styles.Pending}`}>
    {status}
  </span>
);

export default OperationStatusBadge;
