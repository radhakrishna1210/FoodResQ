import { useAuth } from '@/lib/auth';
import { AdminLayout } from './AdminLayout';
import { DonorLayout } from './DonorLayout';
import { ReceiverLayout } from './ReceiverLayout';

/** For routes any authenticated role may open (/notifications, /settings, feedback). */
export function RoleLayout() {
  const { role } = useAuth();
  if (role === 'admin') return <AdminLayout />;
  if (role === 'receiver') return <ReceiverLayout />;
  return <DonorLayout />;
}
