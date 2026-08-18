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
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nivatv.luxomall.in' },
      { '@type': 'ListItem', position: 2, name: 'Browse Channels', item: 'https://nivatv.luxomall.in/browse' },
    ],
  };

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'NivaTV Indian Live TV Channels',
    description: 'Browse 500+ Indian live TV channels by category including Hindi, Tamil, Telugu, Bengali, Malayalam, Sports, News and more.',
    url: 'https://nivatv.luxomall.in/browse',
    provider: { '@type': 'Organization', name: 'NivaTV', url: 'https://nivatv.luxomall.in' },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      {children}
    </>
  );
}
