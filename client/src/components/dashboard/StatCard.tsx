import type { ReactNode } from 'react';

export type StatTone = 'default' | 'green' | 'yellow' | 'red' | 'blue' | 'purple';

const tones: Record<StatTone, string> = {
  default: 'border-slate-200 bg-white',
  green: 'border-emerald-200 bg-emerald-50/60',
  yellow: 'border-amber-200 bg-amber-50/70',
  red: 'border-red-200 bg-red-50/60',
  blue: 'border-sky-200 bg-sky-50/60',
  purple: 'border-violet-200 bg-violet-50/60',
};

const values: Record<StatTone, string> = {
  default: 'text-slate-900',
  green: 'text-emerald-800',
  yellow: 'text-amber-800',
  red: 'text-red-700',
  blue: 'text-sky-800',
  purple: 'text-violet-800',
};

const StatCard = ({
  title,
  value,
  subtitle,
  tone = 'default',
  onClick,
}: {
  title: string;
  value: ReactNode;
  subtitle?: string;
  tone?: StatTone;
  onClick?: () => void;
}) => {
  const content = (
    <>
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className={`mt-2 text-2xl font-semibold ${values[tone]}`}>{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`min-h-[108px] w-full rounded-md border p-4 text-left transition hover:border-slate-400 hover:shadow-sm ${tones[tone]}`}
      >
        {content}
      </button>
    );
  }

  return (
    <article className={`min-h-[108px] rounded-md border p-4 ${tones[tone]}`}>
      {content}
    </article>
  );
};

export default StatCard;
