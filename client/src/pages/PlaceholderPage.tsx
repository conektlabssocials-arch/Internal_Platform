type PlaceholderPageProps = {
  title: string;
  description: string;
};

const PlaceholderPage = ({ title, description }: PlaceholderPageProps) => {
  return (
    <section>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-slate-600">{description}</p>
      </div>
    </section>
  );
};

export default PlaceholderPage;
