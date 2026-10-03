// Routes — ARCHITECTURE §9.3 (exact paths) with guards: auth → onboarded → role → receiver active.
import { lazy, Suspense, type ReactNode } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  useLocation,
  type RouteObject,
} from 'react-router-dom';
import { homeFor, useAuth } from '@/lib/auth';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';
import { PublicLayout } from '@/layouts/PublicLayout';
import { DonorLayout } from '@/layouts/DonorLayout';
import { ReceiverLayout } from '@/layouts/ReceiverLayout';
import { AdminLayout } from '@/layouts/AdminLayout';
import { RoleLayout } from '@/layouts/RoleLayout';
import type { UserRole } from '@/types';
import { ToastProvider } from '@/components/ui/Toast';

/** Root element: providers that need router context (toasts render <Link>). */
function RootLayout() {
  return (
    <ToastProvider>
      <Outlet />
    </ToastProvider>
  );
}

const LandingPage = lazy(() => import('@/pages/landing/LandingPage'));
const LoginPage = lazy(() => import('@/pages/login/LoginPage'));
const SignupPage = lazy(() => import('@/pages/signup/SignupPage'));
const OnboardingPage = lazy(() => import('@/pages/onboarding/OnboardingPage'));
const PendingPage = lazy(() => import('@/pages/pending/PendingPage'));
const DonorDashboard = lazy(() => import('@/pages/donor/dashboard/DonorDashboard'));
const PostDonationPage = lazy(() => import('@/pages/donor/donation-new/PostDonationPage'));
const DonationDetailPage = lazy(() => import('@/pages/donor/donation-detail/DonationDetailPage'));
const DonorHistoryPage = lazy(() => import('@/pages/donor/history/DonorHistoryPage'));
const DonorImpactPage = lazy(() => import('@/pages/donor/impact/DonorImpactPage'));
const ReceiverDashboard = lazy(() => import('@/pages/receiver/dashboard/ReceiverDashboard'));
const OfferDetailPage = lazy(() => import('@/pages/receiver/offer-detail/OfferDetailPage'));
const PickupPage = lazy(() => import('@/pages/receiver/pickup/PickupPage'));
const ReceiverHistoryPage = lazy(() => import('@/pages/receiver/history/ReceiverHistoryPage'));
const ReceiverProfilePage = lazy(() => import('@/pages/receiver/profile/ReceiverProfilePage'));
const FeedbackPage = lazy(() => import('@/pages/feedback/FeedbackPage'));
const AdminOverviewPage = lazy(() => import('@/pages/admin/overview/AdminOverviewPage'));
const AdminVerificationsPage = lazy(
  () => import('@/pages/admin/verifications/AdminVerificationsPage'),
);
const AdminFlagsPage = lazy(() => import('@/pages/admin/flags/AdminFlagsPage'));
const AdminSafetyPage = lazy(() => import('@/pages/admin/safety/AdminSafetyPage'));
const AdminDisputesPage = lazy(() => import('@/pages/admin/disputes/AdminDisputesPage'));
const AdminLivePage = lazy(() => import('@/pages/admin/live/AdminLivePage'));
const AdminAnalyticsPage = lazy(() => import('@/pages/admin/analytics/AdminAnalyticsPage'));
const AdminSettingsPage = lazy(() => import('@/pages/admin/settings/AdminSettingsPage'));
const AdminDonationPage = lazy(() => import('@/pages/admin/donation-detail/AdminDonationPage'));
const AdminAuditLogPage = lazy(() => import('@/pages/admin/audit-log/AdminAuditLogPage'));
const NotificationsPage = lazy(() => import('@/pages/notifications/NotificationsPage'));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));
const NotFoundPage = lazy(() => import('@/pages/not-found/NotFoundPage'));

const page = (node: ReactNode) => <Suspense fallback={<PageSpinner />}>{node}</Suspense>;

function MeError() {
  const { meError, refreshMe, signOut } = useAuth();
  return (
    <div className="mx-auto max-w-md p-6 pt-24">
      <ErrorState
        error={meError}
        title="We couldn't load your account"
        onRetry={() => void refreshMe()}
      />
      <div className="mt-4 text-center">
        <Button variant="ghost" onClick={() => void signOut()}>
          Log out
        </Button>
      </div>
    </div>
  );
}

/** Signed in (session). */
function RequireAuth() {
  const { status, me, meError } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <PageSpinner />;
  if (status === 'anonymous')
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!me && meError) return <MeError />;
  return <Outlet />;
}

/** Signed in AND onboarded. */
function RequireOnboarded() {
  const { onboarded } = useAuth();
  if (!onboarded) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

/** Role check; optional `activeReceiver` sends non-active receivers to /pending. */
function RequireRole({ roles, activeReceiver }: { roles: UserRole[]; activeReceiver?: boolean }) {
  const { user, role, onboarded } = useAuth();
  if (!role || !roles.includes(role)) return <Navigate to={homeFor(user, onboarded)} replace />;
  if (activeReceiver && role === 'receiver' && user?.account_status !== 'active') {
    return <Navigate to="/pending" replace />;
  }
  return <Outlet />;
}

/** /onboarding: authenticated, not onboarded. */
function OnlyNotOnboarded() {
  const { onboarded, user } = useAuth();
  if (onboarded) return <Navigate to={homeFor(user, onboarded)} replace />;
  return <Outlet />;
}

/** /pending: receiver not active. */
function OnlyInactiveReceiver() {
  const { user, onboarded } = useAuth();
  if (user?.role !== 'receiver' || user.account_status === 'active') {
    return <Navigate to={homeFor(user, onboarded)} replace />;
  }
  return <Outlet />;
}

/** /login, /signup: bounce signed-in, onboarded users to their home. */
function GuestOnly() {
  const { status, me, user, onboarded } = useAuth();
  const location = useLocation();
  if (status === 'authenticated' && me) {
    const from = (location.state as { from?: string } | null)?.from;
    const home = homeFor(user, onboarded);
    return <Navigate to={onboarded && from ? from : home} replace />;
  }
  return <Outlet />;
}

export const routes: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: page(<LandingPage />) },
      {
        element: <GuestOnly />,
        children: [
          { path: '/login', element: page(<LoginPage />) },
          { path: '/signup', element: page(<SignupPage />) },
        ],
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <OnlyNotOnboarded />,
        children: [{ path: '/onboarding', element: page(<OnboardingPage />) }],
      },
      {
        element: <RequireOnboarded />,
        children: [
          {
            element: <OnlyInactiveReceiver />,
            children: [
              {
                element: <ReceiverLayout />,
                children: [{ path: '/pending', element: page(<PendingPage />) }],
              },
            ],
          },
          {
            element: <RequireRole roles={['donor']} />,
            children: [
              {
                element: <DonorLayout />,
                children: [
                  { path: '/donor', element: page(<DonorDashboard />) },
                  { path: '/donor/donations/new', element: page(<PostDonationPage />) },
                  { path: '/donor/donations/:id', element: page(<DonationDetailPage />) },
                  { path: '/donor/history', element: page(<DonorHistoryPage />) },
                  { path: '/donor/impact', element: page(<DonorImpactPage />) },
                ],
              },
            ],
          },
          {
            element: <RequireRole roles={['receiver']} />,
            children: [
              {
                element: <ReceiverLayout />,
                children: [
                  // Profile is editable while pending/rejected (ARCHITECTURE §3.3).
                  { path: '/receiver/profile', element: page(<ReceiverProfilePage />) },
                  {
                    element: <RequireRole roles={['receiver']} activeReceiver />,
                    children: [
                      { path: '/receiver', element: page(<ReceiverDashboard />) },
                      { path: '/receiver/offers/:id', element: page(<OfferDetailPage />) },
                      { path: '/receiver/pickups/:allocationId', element: page(<PickupPage />) },
                      { path: '/receiver/history', element: page(<ReceiverHistoryPage />) },
                    ],
                  },
                ],
              },
            ],
          },
          {
            element: <RequireRole roles={['donor', 'receiver']} activeReceiver />,
            children: [
              {
                element: <RoleLayout />,
                children: [{ path: '/allocations/:id/feedback', element: page(<FeedbackPage />) }],
              },
            ],
          },
          {
            element: <RequireRole roles={['admin']} />,
            children: [
              {
                element: <AdminLayout />,
                children: [
                  { path: '/admin', element: page(<AdminOverviewPage />) },
                  { path: '/admin/verifications', element: page(<AdminVerificationsPage />) },
                  { path: '/admin/flags', element: page(<AdminFlagsPage />) },
                  { path: '/admin/safety', element: page(<AdminSafetyPage />) },
                  { path: '/admin/disputes', element: page(<AdminDisputesPage />) },
                  { path: '/admin/live', element: page(<AdminLivePage />) },
                  { path: '/admin/analytics', element: page(<AdminAnalyticsPage />) },
                  { path: '/admin/settings', element: page(<AdminSettingsPage />) },
                  { path: '/admin/donations/:id', element: page(<AdminDonationPage />) },
                  { path: '/admin/audit-log', element: page(<AdminAuditLogPage />) },
                ],
              },
            ],
          },
          {
            element: <RoleLayout />,
            children: [
              { path: '/notifications', element: page(<NotificationsPage />) },
              { path: '/settings', element: page(<SettingsPage />) },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: page(<NotFoundPage />) },
];

export const router = createBrowserRouter([{ element: <RootLayout />, children: routes }], {
  future: {
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  },
});
