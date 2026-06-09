import type { ReactNode } from 'react';

const DashboardCardGrid = ({
  children,
  columns = 4,
}: {
  children: ReactNode;
  columns?: 3 | 4 | 6;
}) => {
  const layout = {
    3: 'sm:grid-cols-2 xl:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
    6: 'sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6',
  }[columns];

  return <div className={`grid gap-3 ${layout}`}>{children}</div>;
};

export default DashboardCardGrid;
