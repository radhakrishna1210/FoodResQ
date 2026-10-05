import { FlaskConical } from 'lucide-react';
import { Link } from 'react-router-dom';

/** Points dev-mode testers at the login page's demo panel instead of duplicating it here. */
export function DemoAccountsHint() {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-gold-50 px-3 py-2 text-xs text-gold-700 ring-1 ring-inset ring-gold/25">
      <FlaskConical size={16} className="mt-0.5 shrink-0" aria-hidden />
      <span>
        Testing locally? Use the{' '}
        <Link to="/login" className="link">
          demo accounts
        </Link>{' '}
        on the login page instead.
      </span>
    </div>
  );
}
