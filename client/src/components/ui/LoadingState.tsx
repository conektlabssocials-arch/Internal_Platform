const LoadingState = ({ label = 'Loading...' }: { label?: string }) => (
  <div className="flex items-center justify-center gap-3 px-5 py-10 text-sm text-slate-500" role="status">
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-700" />
    <span>{label}</span>
  </div>
);

export default LoadingState;
