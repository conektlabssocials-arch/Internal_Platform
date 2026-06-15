const MapEmptyState = ({
  message = 'This plan does not include fixed Outdoor or A3 screen sites with map locations.',
}: {
  message?: string;
}) => (
  <div className="flex h-[360px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 text-center md:h-[500px]">
    <div className="max-w-md">
      <p className="font-medium text-slate-700">No outdoor map locations</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{message}</p>
    </div>
  </div>
);

export default MapEmptyState;
