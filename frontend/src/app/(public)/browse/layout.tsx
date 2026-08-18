import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Browse 500+ Indian Live TV Channels — NivaTV',
  description: 'Browse all Indian live TV channels by category — Hindi, Bengali, Tamil, Telugu, Malayalam, Zee News, Sony TV & more. Preview the full channel library on NivaTV.',
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  alternates: { canonical: 'https://nivatv.luxomall.in/browse' },
  openGraph: {
    title: 'Browse 500+ Indian Live TV Channels — NivaTV',
    description: 'Find your favourite Indian live TV channels by language and category on NivaTV.',
    url: 'https://nivatv.luxomall.in/browse',
    siteName: 'NivaTV',
    type: 'website',
  },
};

export default function BrowseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
