import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin-users/', '/dashboard/', '/app-settings/', '/my-account/', '/payments/', '/licenses/', '/devices/'],
    },
    sitemap: 'https://nivatv.luxomall.in/sitemap.xml',
  };
}
