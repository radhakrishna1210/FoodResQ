import {
  BarChart3,
  Bell,
  ClipboardCheck,
  Flag,
  LayoutDashboard,
  Map,
  Scale,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { AppShell, type NavItem } from '@/components/layout/AppShell';

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/verifications', label: 'Verifications', icon: ClipboardCheck },
  { to: '/admin/flags', label: 'Flagged donations', icon: Flag },
  { to: '/admin/safety', label: 'Safety reports', icon: ShieldAlert },
  { to: '/admin/disputes', label: 'Disputes', icon: Scale },
  { to: '/admin/live', label: 'Live map', icon: Map },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/settings', label: 'Bridge settings', icon: Settings },
  // TODO(team): /admin/audit-log is not in the §9.3 route table; added for the "audit log viewer" (Phase 5).
  { to: '/admin/audit-log', label: 'Audit log', icon: ScrollText },
  { to: '/notifications', label: 'Notifications', icon: Bell },
];

export function AdminLayout() {
  return (
    <AppShell
      nav={ADMIN_NAV}
      accent="purple"
      roleLabel="Admin"
      roleIcon={ShieldCheck}
      home="/admin"
    />
  );
}
