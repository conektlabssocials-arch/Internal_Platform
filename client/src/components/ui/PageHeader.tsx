import type { ReactNode } from 'react';

const PageHeader = ({
  title,
  eyebrow,
  description,
  actions,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
}) => (
  <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      {eyebrow ? <p className="text-sm font-medium text-emerald-700">{eyebrow}</p> : null}
      <h1 className="mt-1 text-2xl font-semibold text-slate-950">{title}</h1>
      {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{description}</p> : null}
    </div>
    {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
  </header>
);

export default PageHeader;
