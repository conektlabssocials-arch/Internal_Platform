import type { ReactNode } from 'react';

const EmptyState = ({
  title,
  description,
  action,
  compact = false,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) => (
  <div className={`text-center ${compact ? 'px-4 py-6' : 'px-5 py-10'}`}>
    <p className="font-medium text-slate-900">{title}</p>
    {description ? <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-slate-500">{description}</p> : null}
    {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
  </div>
);

export default EmptyState;
