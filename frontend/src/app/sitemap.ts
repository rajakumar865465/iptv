import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://nivatv.luxomall.in';

  // We are prioritizing the most important public routes for SEO
  const routes = [
    '',
    '/pricing',
    '/download',
    '/browse',
    '/support',
    '/login'
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'daily' : 'weekly',
    priority: route === '' ? 1 : 0.8,
  }));
}
