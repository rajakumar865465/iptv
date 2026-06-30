import type { Metadata } from 'next';
import PublicHeader from '@/components/public/PublicHeader';
import PublicFooter from '@/components/public/PublicFooter';

export const metadata: Metadata = {
  title: 'NivaTV — Premium Indian Live TV App',
  description: 'Watch Hindi, Bengali, Tamil, Telugu, Malayalam and 500+ Indian channels on your Android device. Buy a license and start watching live TV today.',
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <PublicHeader />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}
