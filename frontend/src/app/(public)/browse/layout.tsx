import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Browse 500+ Indian Live TV Channels Free — NivaTV',
  description: 'Browse all Indian live TV channels by category — Hindi, Bengali, Tamil, Telugu, Malayalam, Zee News, Sony TV & more. Free to preview on NivaTV.',
};

export default function BrowseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
