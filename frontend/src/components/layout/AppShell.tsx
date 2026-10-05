import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, Settings, X, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { IMG } from '@/lib/media';
import { Logo } from './Logo';
import { NotificationBell } from './NotificationBell';
import { ReconnectingPill } from './StatusPills';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Show in the mobile bottom bar (max 5). */
  mobile?: boolean;
}

export type Accent = 'primary' | 'teal' | 'purple';
const ACCENT: Record<Accent, { active: string; dot: string; chip: string }> = {
  primary: {
    active: 'bg-primary-50 text-primary-700',
    dot: 'bg-primary',
    chip: 'bg-primary-50 text-primary-700',
  },
  teal: { active: 'bg-teal-50 text-teal-700', dot: 'bg-teal', chip: 'bg-teal-50 text-teal-700' },
  purple: {
    active: 'bg-purple-50 text-purple-700',
    dot: 'bg-purple',
    chip: 'bg-purple-50 text-purple-700',
  },
};

function UserMenu() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const orgName = profile && 'org_name' in profile ? profile.org_name : null;
  const initials = (user?.full_name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
          {initials}
        </span>
        <span className="hidden text-left lg:block">
          <span className="block max-w-[160px] truncate text-sm font-medium text-ink">
            {user?.full_name}
          </span>
          {orgName && (
            <span className="block max-w-[160px] truncate text-xs text-slate">{orgName}</span>
          )}
        </span>
        <ChevronDown size={16} className="hidden text-slate lg:block" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-[950] mt-2 w-56 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-lift"
        >
          <div className="border-b border-line px-3 py-2">
            <p className="truncate text-sm font-medium text-ink">{user?.full_name}</p>
            <p className="truncate text-xs text-slate">{user?.email}</p>
          </div>
          <Link
            role="menuitem"
            to="/settings"
            className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            <Settings size={16} aria-hidden /> Account settings
          </Link>
          <button
            role="menuitem"
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
            onClick={async () => {
              setOpen(false);
              await signOut();
              navigate('/login');
            }}
          >
            <LogOut size={16} aria-hidden /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

export function AppShell({
  nav,
  accent,
  roleLabel,
  roleIcon: RoleIcon,
  home,
  extra,
  children,
}: {
  nav: NavItem[];
  accent: Accent;
  roleLabel: string;
  roleIcon: LucideIcon;
  home: string;
  extra?: ReactNode;
  children?: ReactNode;
}) {
  const a = ACCENT[accent];
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();
  useEffect(() => setDrawer(false), [location.pathname]);
  const mobileItems = nav.filter((n) => n.mobile).slice(0, 5);
  const hasBottomNav = mobileItems.length > 0;

  const navLinks = (
    <nav className="space-y-1" aria-label="Main">
      {nav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
              isActive
                ? cn(a.active, 'shadow-sm')
                : 'text-slate-700 hover:translate-x-0.5 hover:bg-slate-50 hover:text-ink',
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  'absolute inset-y-1.5 -left-3 w-1 rounded-r-full transition-all duration-300',
                  isActive ? cn(a.dot, 'opacity-100') : 'opacity-0',
                )}
                aria-hidden="true"
              />
              <item.icon
                size={18}
                aria-hidden
                className="transition-transform duration-200 group-hover:scale-110"
              />
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-bg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[2000] focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-gradient-to-b from-white to-bg md:flex">
        <div className="flex h-16 items-center px-5">
          <Logo to={home} />
        </div>
        <div className="px-5 pb-4">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
              a.chip,
            )}
          >
            <RoleIcon size={14} aria-hidden /> {roleLabel}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-3">{navLinks}</div>
        <div className="p-3">
          <div className="relative overflow-hidden rounded-xl">
            <img
              src={IMG.handingPlate}
              alt=""
              loading="lazy"
              className="h-28 w-full object-cover transition-transform duration-700 hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-ink/10" />
            <p className="absolute inset-x-3 bottom-2.5 font-heading text-xs font-semibold leading-snug text-white">
              Every meal rescued is a meal someone eats today.
            </p>
          </div>
          <p className="mt-3 text-center text-[11px] text-slate">
            Team Bitebridge · CURIOUSPARC 2026
          </p>
        </div>
      </aside>

      {/* Mobile drawer (admin / overflow) */}
      {drawer && (
        <div className="fixed inset-0 z-[960] md:hidden">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setDrawer(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-lift">
            <div className="flex h-16 items-center justify-between px-4">
              <Logo to={home} />
              <button
                type="button"
                className="rounded p-2 hover:bg-slate-50"
                onClick={() => setDrawer(false)}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3">{navLinks}</div>
          </div>
        </div>
      )}

      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-white/80 px-4 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-2 md:hidden">
            {!hasBottomNav && (
              <button
                type="button"
                className="rounded p-2 hover:bg-slate-50"
                onClick={() => setDrawer(true)}
                aria-label="Open menu"
              >
                <Menu size={20} />
              </button>
            )}
            <Logo to={home} />
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-1">
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        <main
          id="main"
          key={location.pathname}
          className="pb-safe mx-auto w-full max-w-6xl animate-fade-in px-4 py-6 md:px-8 md:py-8"
        >
          {children ?? <Outlet />}
        </main>
      </div>

      {/* Mobile bottom nav (Donor / Receiver) */}
      {hasBottomNav && (
        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur md:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          aria-label="Bottom navigation"
        >
          <div className="mx-auto flex max-w-md">
            {mobileItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
                    isActive
                      ? accent === 'teal'
                        ? 'text-teal-700'
                        : 'text-primary'
                      : 'text-slate',
                  )
                }
              >
                <item.icon size={20} aria-hidden />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
      <ReconnectingPill />
      {extra}
    </div>
  );
}
