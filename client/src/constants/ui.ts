export type UiTone = 'default' | 'green' | 'blue' | 'yellow' | 'red' | 'purple';

export const toneClasses: Record<UiTone, string> = {
  default: 'bg-slate-100 text-slate-700',
  green: 'bg-emerald-50 text-emerald-700',
  blue: 'bg-sky-50 text-sky-700',
  yellow: 'bg-amber-50 text-amber-800',
  red: 'bg-red-50 text-red-700',
  purple: 'bg-violet-50 text-violet-700',
};

export const pageSpacing = 'min-w-0 space-y-6';
export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2';

export const emptyStateMessages = {
  inventory: 'No inventory matches the current filters.',
  crm: 'No CRM records match the current filters.',
  campaigns: 'No campaigns match the current filters.',
  plans: 'No plans found. Create a plan from Campaign detail.',
  operations: 'No Work Orders match the current filters.',
  documents: 'No documents have been generated yet.',
  shares: 'No share links have been created yet.',
  activity: 'No activity has been recorded yet.',
  imports: 'No import jobs have been created yet.',
};
