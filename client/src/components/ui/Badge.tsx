import type { ReactNode } from 'react';

import { toneClasses, type UiTone } from '../../constants/ui';

const Badge = ({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: UiTone;
}) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneClasses[tone]}`}>
    {children}
  </span>
);

export default Badge;
