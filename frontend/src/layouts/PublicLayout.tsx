import { Link, Outlet } from 'react-router-dom';
import { Logo } from '@/components/layout/Logo';
import { ApiStatus } from '@/components/layout/StatusPills';
import { buttonClass } from '@/components/ui/Button';
import { homeFor, useAuth } from '@/lib/auth';

export const TEAM = ['Suhani', 'Aaditi', 'Shreeya', 'Radhakrishna'];

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3 md:px-8">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-slate">
            Surplus food → the right Receiver → rescued in time. FoodResQ helps coordinate rescues;
            it does not inspect or certify food.
          </p>
        </div>
        <div>
          <p className="font-heading text-sm font-semibold text-ink">Team Bitebridge</p>
          <ul className="mt-2 space-y-1 text-sm text-slate">
            {TEAM.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <p className="font-heading text-sm font-semibold text-ink">CURIOUSPARC 2026</p>
          <p className="text-sm text-slate">
            State Innovation Challenge · Food Waste Reduction · Social Impact
          </p>
          {/* TODO(team): add partner names/logos for the footer (WALKTHROUGH §5.2 "footer with team and partners"). */}
          <p className="text-sm text-slate">Aligned with SDG 2 (Zero Hunger) and SDG 12.3.</p>
          <ApiStatus />
        </div>
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-slate">
        © 2026 FoodResQ · Team Bitebridge
      </div>
    </footer>
  );
}

export function PublicLayout() {
  const { status, user, onboarded } = useAuth();
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
          <Logo />
          <nav className="flex items-center gap-2" aria-label="Account">
            {status === 'authenticated' ? (
              <Link to={homeFor(user, onboarded)} className={buttonClass('primary', 'sm')}>
                Open dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className={buttonClass('ghost', 'sm')}>
                  Log in
                </Link>
                <Link to="/signup" className={buttonClass('primary', 'sm')}>
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <div className="flex-1">
        <Outlet />
      </div>
      <PublicFooter />
    </div>
  );
}
