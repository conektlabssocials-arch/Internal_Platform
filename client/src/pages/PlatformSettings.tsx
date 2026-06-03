const settingsCards = [
  {
    title: 'Workspace',
    description: 'Core platform identity and company-level defaults.',
    items: [
      { label: 'Workspace name', value: 'Conekt Ads Internal Platform' },
      { label: 'Primary domain', value: 'conektads.com' },
      { label: 'Default timezone', value: 'Asia/Kolkata' },
    ],
  },
  {
    title: 'Authentication',
    description: 'Google Workspace access rules for internal users.',
    items: [
      { label: 'Sign-in method', value: 'Google Workspace SSO' },
      { label: 'Allowed domain', value: 'conektads.com' },
      { label: 'Session type', value: 'Secure HTTP-only cookie' },
    ],
  },
  {
    title: 'Infrastructure',
    description: 'Storage and deployment settings planned for production.',
    items: [
      { label: 'File storage', value: 'S3-compatible storage' },
      { label: 'Deployment target', value: 'AWS / Docker' },
      { label: 'Database', value: 'MongoDB' },
    ],
  },
];

const PlatformSettings = () => {
  return (
    <section>
      <div>
        <h1 className="text-2xl font-semibold">Platform Settings</h1>
        <p className="mt-2 text-slate-600">
          Manage platform-level configuration for the internal workspace.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {settingsCards.map((card) => (
          <section
            key={card.title}
            className="rounded-lg border border-slate-200 bg-white p-5"
          >
            <h2 className="text-base font-semibold text-slate-900">{card.title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">{card.description}</p>

            <dl className="mt-5 space-y-3">
              {card.items.map((item) => (
                <div
                  key={item.label}
                  className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <dt className="text-xs font-medium text-slate-500">{item.label}</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-900">{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </section>
  );
};

export default PlatformSettings;
