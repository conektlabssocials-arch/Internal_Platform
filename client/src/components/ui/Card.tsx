import type { HTMLAttributes, ReactNode } from 'react';

const Card = ({
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLElement> & { children: ReactNode }) => (
  <section
    {...props}
    className={`rounded-md border border-slate-200 bg-white ${className}`}
  >
    {children}
  </section>
);

export default Card;
