import {
  Bell,
  History,
  LayoutDashboard,
  PlusCircle,
  Settings,
  Trophy,
  Utensils,
} from 'lucide-react';
import { AppShell, type NavItem } from '@/components/layout/AppShell';
import { AssistantLauncher } from '@/components/assistant/AssistantPanel';

const DONOR_NAV: NavItem[] = [
  { to: '/donor', label: 'Dashboard', icon: LayoutDashboard, end: true, mobile: true },
  { to: '/donor/donations/new', label: 'Post food', icon: PlusCircle, mobile: true },
  { to: '/donor/history', label: 'History', icon: History, mobile: true },
  { to: '/donor/impact', label: 'Impact', icon: Trophy, mobile: true },
  { to: '/notifications', label: 'Alerts', icon: Bell, mobile: true },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function DonorLayout() {
  return (
    <AppShell
      nav={DONOR_NAV}
      accent="primary"
      roleLabel="Donor"
      roleIcon={Utensils}
      home="/donor"
      extra={<AssistantLauncher role="donor" />}
    />
  );
}
