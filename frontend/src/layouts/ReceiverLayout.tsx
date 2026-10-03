import { Bell, HandHeart, History, LayoutDashboard, Settings, UserCog } from 'lucide-react';
import { AppShell, type NavItem } from '@/components/layout/AppShell';
import { AssistantLauncher } from '@/components/assistant/AssistantPanel';
import { useAuth } from '@/lib/auth';

const RECEIVER_NAV: NavItem[] = [
  { to: '/receiver', label: 'Offers', icon: LayoutDashboard, end: true, mobile: true },
  { to: '/receiver/history', label: 'History', icon: History, mobile: true },
  { to: '/receiver/profile', label: 'Profile', icon: UserCog, mobile: true },
  { to: '/notifications', label: 'Alerts', icon: Bell, mobile: true },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function ReceiverLayout() {
  const { user } = useAuth();
  const active = user?.account_status === 'active';
  const nav = active
    ? RECEIVER_NAV
    : RECEIVER_NAV.filter((n) => n.to !== '/receiver' && n.to !== '/receiver/history');
  return (
    <AppShell
      nav={nav}
      accent="teal"
      roleLabel="Receiver"
      roleIcon={HandHeart}
      home={active ? '/receiver' : '/pending'}
      // Assistant: Donors and active Receivers only (ARCHITECTURE §11).
      extra={active ? <AssistantLauncher role="receiver" /> : undefined}
    />
  );
}
