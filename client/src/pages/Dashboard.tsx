const Dashboard = () => {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 max-w-3xl text-slate-600">
        A simple starting point for the Conekt Ads internal workflow.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">Workflow</p>
          <p className="mt-2 text-lg font-semibold">Lead to report</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">Current phase</p>
          <p className="mt-2 text-lg font-semibold">Foundation</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">Next module</p>
          <p className="mt-2 text-lg font-semibold">To be decided</p>
        </div>
      </div>
    </section>
  );
};

export default Dashboard;
