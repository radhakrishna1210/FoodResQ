import { Compass } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { LogoMark } from '@/components/layout/Logo';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 text-center">
      <LogoMark size={48} />
      <Compass size={28} className="mt-6 text-slate" aria-hidden />
      <h1 className="mt-3 font-heading text-2xl font-semibold text-ink">Page not found</h1>
      <p className="mt-1 text-sm text-slate">
        The page you are looking for doesn&apos;t exist or has moved.
      </p>
      <ButtonLink to="/" className="mt-6">
        Go to home
      </ButtonLink>
    </div>
  );
}
