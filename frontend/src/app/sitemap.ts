import { MetadataRoute } from 'next';

export const revalidate = 3600; // Revalidate sitemap every hour

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://nivatv.luxomall.in';

  const routes = [
    '',
    '/pricing',
    '/download',
    '/browse',
    '/support',
    '/features',
    '/terms',
    '/privacy',
    '/refund-policy',
    '/dmca',
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'daily' : 'weekly',
    priority: route === '' ? 1 : 0.8,
  }));
}
