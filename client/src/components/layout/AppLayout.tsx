import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { focusRing } from '../../constants/ui';
import type { UserRole } from '../../types/auth';

type NavItem = {
  label: string;
  to: string;
  roles?: UserRole[];
};

type NavSection = {
  label?: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', to: '/' },
      { label: 'Inventory', to: '/inventory' },
      { label: 'CRM', to: '/crm' },
      { label: 'Campaigns', to: '/campaigns' },
      { label: 'Plans', to: '/plans' },
      { label: 'Operations', to: '/operations' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { label: 'Platform Settings', to: '/settings/platform', roles: ['admin'] },
      { label: 'Users', to: '/settings/users', roles: ['admin'] },
      { label: 'Audit Logs', to: '/settings/audit-logs', roles: ['admin'] },
    ],
  },
];

const routeTitles: Array<[string, string]> = [
  ['/settings/audit-logs', 'Audit Logs'],
  ['/settings/platform', 'Platform Settings'],
  ['/settings/users', 'Users'],
  ['/operations', 'Operations'],
  ['/campaigns', 'Campaigns'],
  ['/inventory', 'Inventory'],
  ['/plans', 'Plans'],
  ['/crm', 'CRM'],
  ['/', 'Dashboard'],
];

const AppLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const visibleNavSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.roles || item.roles.includes(user?.role || 'member')),
    }))
    .filter((section) => section.items.length > 0);
  const pageTitle =
    routeTitles.find(([path]) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path))?.[1]
    || 'Conekt Ads';

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', close);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', close);
    };
  }, [mobileOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f6f7f4] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <SidebarContent
          sections={visibleNavSections}
          userName={user?.name}
          userEmail={user?.email}
          onLogout={handleLogout}
        />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/55"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            className="relative h-full w-[min(84vw,320px)] border-r border-slate-200 bg-white shadow-2xl"
          >
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
              className={`absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-md text-2xl text-slate-500 hover:bg-slate-100 ${focusRing}`}
            >
              ×
            </button>
            <SidebarContent
              sections={visibleNavSections}
              userName={user?.name}
              userEmail={user?.email}
              onLogout={handleLogout}
            />
          </aside>
        </div>
      ) : null}

      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                aria-label="Open navigation"
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen(true)}
                className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 lg:hidden ${focusRing}`}
              >
                <span className="h-0.5 w-5 bg-slate-700" />
                <span className="h-0.5 w-5 bg-slate-700" />
                <span className="h-0.5 w-5 bg-slate-700" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-emerald-700">Conekt Ads</p>
                <h2 className="truncate text-base font-semibold text-slate-950 sm:text-lg">{pageTitle}</h2>
              </div>
            </div>
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-medium text-slate-900">{user?.name}</p>
              <p className="hidden truncate text-xs text-slate-500 sm:block">{user?.email}</p>
            </div>
          </div>
        </header>

        <main className="min-w-0 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const SidebarContent = ({
  sections,
  userName,
  userEmail,
  onLogout,
}: {
  sections: NavSection[];
  userName?: string;
  userEmail?: string;
  onLogout: () => void;
}) => (
  <div className="flex h-full flex-col px-4 py-5">
    <div className="mb-7 px-2">
      <p className="text-xs font-semibold uppercase text-emerald-700">Conekt Ads</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">Internal Platform</p>
    </div>

    <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto" aria-label="Main navigation">
      {sections.map((section, sectionIndex) => (
        <div key={section.label || sectionIndex}>
          {section.label ? (
            <p className="mb-2 px-3 text-xs font-semibold uppercase text-slate-400">
              {section.label}
            </p>
          ) : null}
          <div className="space-y-1">
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  [
                    'block rounded-md border-l-4 px-3 py-2.5 text-sm font-medium transition',
                    focusRing,
                    isActive
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                      : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>

    <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="truncate text-sm font-medium text-slate-900">{userName}</p>
      <p className="mt-1 truncate text-xs text-slate-500">{userEmail}</p>
      <button
        type="button"
        onClick={onLogout}
        className={`mt-3 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 ${focusRing}`}
      >
        Logout
      </button>
    </div>
  </div>
);

export default AppLayout;
