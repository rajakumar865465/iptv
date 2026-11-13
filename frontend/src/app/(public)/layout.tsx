import type { Metadata } from 'next';
import PublicHeader from '@/components/public/PublicHeader';
import PublicFooter from '@/components/public/PublicFooter';

export const metadata: Metadata = {
  title: 'NivaTV — Premium Indian Live TV App',
  description: 'Watch Hindi, Bengali, Tamil, Telugu, Malayalam and 500+ Indian channels on your Android device. Buy a license and start watching live TV today.',
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-[var(--color-base)] text-[var(--color-ink)] flex flex-col">
      <PublicHeader />
      <main className="w-full max-w-full overflow-x-clip flex-1 min-w-0">{children}</main>
      <PublicFooter />
    </div>
  );
}
