import { getWebsiteSettings } from '@/lib/publicApi';
import { MessageCircle, Mail, Phone, Clock, Key, MapPin, Building } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

// Revalidate every hour — replaces force-dynamic so Cache-Control is public.
export const revalidate = 3600;
export const metadata: Metadata = {
  title: 'NivaTV Support — Help & Contact Us | WhatsApp & Email',
  description: 'Get help with your NivaTV license, app installation, or streaming issues. Reach us via WhatsApp, Telegram, or email. Fast response guaranteed.',
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  alternates: { canonical: 'https://nivatv.luxomall.in/support' },
  openGraph: {
    title: 'NivaTV Support — We Are Here to Help',
    description: 'Contact NivaTV support via WhatsApp, Telegram or email for license, installation or streaming help.',
    url: 'https://nivatv.luxomall.in/support',
    siteName: 'NivaTV',
    type: 'website',
  },
};

const COMMON_ISSUES = [
  { issue: 'License key not working', fix: 'Make sure you are copying the full key including dashes. Keys look like NVT-XXXX-XXXX-XXXX.' },
  { issue: 'Channels buffering or not loading', fix: 'Check your internet speed. Try switching from WiFi to mobile data or vice versa. If the issue persists, report the channel inside the app.' },
  { issue: 'Payment done but no license key', fix: 'Check your payment success page or visit the License Check page. If it\'s still missing, contact us with your transaction ID.' },
  { issue: 'App crashes on startup', fix: 'Make sure you have the latest APK installed. Download the latest version from our Download page.' },
  { issue: 'Device limit reached', fix: 'Your plan allows a limited number of devices. Log out from an old device inside the app or contact support.' },
];

export default async function SupportPage() {
  const settings = await getWebsiteSettings().catch(() =>({})) as Record<string, string>;

  const rawWhatsapp = settings.support_whatsapp;
  const whatsapp = (rawWhatsapp && rawWhatsapp !== '+919999999999') ? rawWhatsapp : '+919774401306';
  const email = settings.support_email;
  const telegram = settings.telegram_url;
  const phone = settings.support_phone;

  const contactJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: 'NivaTV Support',
    description: 'Contact NivaTV support for help with license keys, app installation, or streaming issues.',
    url: 'https://nivatv.luxomall.in/support',
    mainEntity: {
      '@type': 'Organization',
      name: 'NivaTV',
      url: 'https://nivatv.luxomall.in',
      contactPoint: [
        { '@type': 'ContactPoint', contactType: 'customer support', availableLanguage: ['Hindi', 'English'], contactOption: 'TollFree' },
      ],
    },
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: COMMON_ISSUES.map((item) => ({
      '@type': 'Question',
      name: item.issue,
      acceptedAnswer: { '@type': 'Answer', text: item.fix },
    })),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nivatv.luxomall.in' },
      { '@type': 'ListItem', position: 2, name: 'Support', item: 'https://nivatv.luxomall.in/support' },
    ],
  };

  return (
    <div className="pt-24 pb-20 px-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-[var(--color-ink)] mb-3">Support</h1>
          <p className="text-[var(--color-ink-muted)]">We typically respond within a few hours. Choose the fastest way to reach us.</p>
        </div>

        {/* Contact options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-4 bg-green-500/10 border border-green-500/20 rounded-2xl p-5 hover:bg-green-500/15 transition-colors"
            >
              <MessageCircle className="w-8 h-8 text-green-600 dark:text-green-400 shrink-0" />
              <div>
                <p className="text-[var(--color-ink)] font-semibold">WhatsApp</p>
                <p className="text-[var(--color-ink-muted)] text-sm">{whatsapp}</p>
              </div>
            </a>
          )}

          {email && (
            <a
              href={`mailto:${email}`}
              className="flex items-center gap-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 hover:bg-blue-500/15 transition-colors"
            >
              <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400 shrink-0" />
              <div>
                <p className="text-[var(--color-ink)] font-semibold">Email</p>
                <p className="text-[var(--color-ink-muted)] text-sm break-all">{email}</p>
              </div>
            </a>
          )}

          {telegram && (
            <a
              href={telegram}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-4 bg-sky-500/10 border border-sky-500/20 rounded-2xl p-5 hover:bg-sky-500/15 transition-colors"
            >
              <MessageCircle className="w-8 h-8 text-sky-600 dark:text-sky-400 shrink-0" />
              <div>
                <p className="text-[var(--color-ink)] font-semibold">Telegram</p>
                <p className="text-[var(--color-ink-muted)] text-sm">Join our Telegram group</p>
              </div>
            </a>
          )}

          {phone && (
            <a
              href={`tel:${phone}`}
              className="flex items-center gap-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl p-5 hover:bg-purple-500/15 transition-colors"
            >
              <Phone className="w-8 h-8 text-purple-600 dark:text-purple-400 shrink-0" />
              <div>
                <p className="text-[var(--color-ink)] font-semibold">Phone / Call</p>
                <p className="text-[var(--color-ink-muted)] text-sm">{phone}</p>
              </div>
            </a>
          )}

          <div className="flex items-center gap-4 bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl p-5">
            <Clock className="w-8 h-8 text-[var(--color-ink-muted)] shrink-0" />
            <div>
              <p className="text-[var(--color-ink)] font-semibold">Response Time</p>
              <p className="text-[var(--color-ink-muted)] text-sm">Usually within 2–4 hours</p>
            </div>
          </div>
        </div>

        {/* Merchant & Office Address (Razorpay Compliance) */}
        <div className="bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-2xl p-6 sm:p-8 mb-12">
          <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4 flex items-center gap-2">
            <Building className="w-5 h-5 text-brand-500" /> Merchant Contact Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-[var(--color-ink-muted)] font-medium">Business / Merchant Name</p>
              <p className="text-[var(--color-ink)] font-semibold mt-0.5">Luxomall Digital Services</p>
            </div>
            <div>
              <p className="text-[var(--color-ink-muted)] font-medium">Support Contact</p>
              <p className="text-[var(--color-ink)] font-semibold mt-0.5">Phone: {phone || '+919774401306'}</p>
              <p className="text-[var(--color-ink)] font-semibold mt-0.5">Email: {email || 'support@nivatv.luxomall.in'}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-[var(--color-ink-muted)] font-medium flex items-center gap-1.5"><MapPin className="w-4 h-4 text-brand-500" /> Physical Address</p>
              <p className="text-[var(--color-ink)] font-medium mt-1 leading-relaxed">
                Luxomall Digital Services,<br />
                Near GMC Hospital, Bhangagarh,<br />
                Guwahati, Assam, India - 781005
              </p>
            </div>
          </div>
        </div>

        {/* Common issues */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-[var(--color-ink)] mb-6">Common Issues & Quick Fixes</h2>
          <div className="space-y-4">
            {COMMON_ISSUES.map(item => (
              <div key={item.issue} className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-xl p-5">
                <p className="text-[var(--color-ink)] font-semibold text-sm mb-1">❓ {item.issue}</p>
                <p className="text-[var(--color-ink-muted)] text-sm leading-relaxed">✅ {item.fix}</p>
              </div>
            ))}
          </div>
        </div>

        {/* License check CTA */}
        <div className="bg-gradient-to-r from-brand-600/15 to-transparent border border-brand-500/20 bg-[var(--color-surface)] rounded-2xl p-6 flex items-center gap-4">
          <Key className="w-8 h-8 text-brand-500 shrink-0" />
          <div>
            <p className="text-[var(--color-ink)] font-semibold mb-1">Check Your License Status</p>
            <p className="text-[var(--color-ink-muted)] text-sm mb-3">Verify your license key, activation status and expiry date.</p>
            <Link href="/license" className="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-500 font-medium underline underline-offset-2">
              Go to License Check →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

