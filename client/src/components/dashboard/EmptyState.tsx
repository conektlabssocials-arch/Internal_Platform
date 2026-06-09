const EmptyState = ({ message }: { message: string }) => (
  <div className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
    {message}
  </div>
);

export default EmptyState;
