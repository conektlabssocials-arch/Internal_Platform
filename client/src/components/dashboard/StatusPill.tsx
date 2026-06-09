const StatusPill = ({
  label,
  tone = 'default',
}: {
  label: string;
  tone?: 'default' | 'green' | 'yellow' | 'red' | 'blue';
}) => {
  const classes = {
    default: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-800',
    yellow: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-sky-100 text-sky-800',
  }[tone];

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
};

export default StatusPill;
