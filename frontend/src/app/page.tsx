import Link from 'next/link';
import {
  Tv, Key, Zap, RefreshCw,
  ArrowRight, Download, Check, Globe, Smartphone,
  ShieldCheck, Headphones, Play, Sparkles, Star,
} from 'lucide-react';
import {
  getPublicPlans, getCategories, getWebsiteSettings, getPopularChannels
} from '@/lib/publicApi';
import ChannelLogoImage from '@/components/ChannelLogoImage';
import PlanCard from '@/components/public/PlanCard';
import FAQAccordion from '@/components/public/FAQAccordion';
import PageTracker from '@/components/public/PageTracker';
import PublicHeader from '@/components/public/PublicHeader';
import PublicFooter from '@/components/public/PublicFooter';
import AnimatedHeroPhone from '@/components/public/AnimatedHeroPhone';
import AppShowcase from '@/components/public/AppShowcase';
import StickyMobileCTA from '@/components/public/StickyMobileCTA';
import SectionHeading from '@/components/public/SectionHeading';
import MotionReveal from '@/components/public/MotionReveal';
import LiveChannelTicker from '@/components/public/LiveChannelTicker';
import LanguagesStrip from '@/components/public/LanguagesStrip';
import ComparisonTable from '@/components/public/ComparisonTable';
import TestimonialsSection from '@/components/public/TestimonialsSection';
import SEOContent from '@/components/public/SEOContent';
import type { Metadata } from 'next';
import type { Plan, Category, Channel } from '@/lib/publicApi';

// Revalidate every hour so Google can cache and index this page.
// force-dynamic would set Cache-Control: private which prevents indexing.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'NivaTV - Live TV for Every Indian Home | Live TV Online Free on Mobile App',
  description:
    'Watch Hindi, Bengali, Tamil, Telugu, Malayalam and 500+ Indian live channels on Android. Buy a license, download the APK and start watching live tv online free on mobile app.',
  keywords: [
    'live tv online free on mobile', 'live tv mobile', 'live tv mobile download', 
    'live tv mobile streaming', 'live tv mobile free', 'live tv mobile apps', 
    'live tv mobile al', 'sony max live tv mobile apk', 'mtv live mobile tv apk', 
    'free tv channel app for android mobile', 'all tv channel live free', 
    'all tv channel live free mobile', 'all tv channel live free online', 
    'live tv online free on mobile app', 'live tv online free on mobile ipl', 
    'ipl live tv', 'ipl live tv channel', 'tata ipl live tv', 'ipl live tv free', 
    'zee news live', 'zee news live hindi', 'zee news live today', 'zee news live marathi', 
    'sony tv live', 'sony tv live on nivatv'
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: 'https://nivatv.luxomall.in',
  },
  openGraph: {
    title: 'NivaTV - Live TV for Every Indian Home',
    description: 'Watch Hindi, Bengali, Tamil, Telugu, Malayalam and 500+ Indian live channels on Android. Buy a license, download the APK and start watching.',
    url: 'https://nivatv.luxomall.in',
    siteName: 'NivaTV',
    type: 'website',
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NivaTV - Live TV for Every Indian Home',
    description: 'Watch 500+ Indian live channels on Android.',
  }
};


function getCategoryEmoji(name: string): string {
  const map: Record<string, string> = {
    news: '📰', movie: '🎬', film: '🎬', sport: '⚽', cricket: '🏏',
    kids: '👶', cartoon: '👶', music: '🎵', devotion: '🙏', religion: '🙏',
    english: '🇬🇧', doordarshan: '📡', dd: '📡',
    tamil: '🌊', telugu: '💰', malayalam: '🥥', bengali: '🍲',
    kannada: '🏗', marathi: '🚢', punjabi: '🎸', gujarati: '🧶',
    odia: '⛰', assamese: '🐟', urdu: '🇵🇰', entertainment: '🎭', hindi: '🇮🇳'
  };
  const lower = name.toLowerCase();
  for (const [key, emoji] of Object.entries(map)) {
    if (lower.includes(key)) return emoji;
  }
  return '📺';
}

/* ── Channel card: glass tile + live pulse + brand glow on hover ─ */
function ChannelCard({ channel }: { channel: Channel }) {
  return (
    <div className="group relative bg-white/[0.04] border border-line backdrop-blur-sm rounded-2xl p-4 flex items-center gap-3.5 hover:border-brand-500/30 hover:bg-brand-500/[0.06] hover:shadow-[0_0_40px_-12px] hover:shadow-brand-500/45 transition-all duration-300 min-w-[220px] sm:min-w-0">
      <div className="w-11 h-11 rounded-xl bg-surface-2 border border-white/5 flex items-center justify-center shrink-0 overflow-hidden">
        <ChannelLogoImage
          src={channel.logo_url || ''}
          alt={channel.name}
          className="w-full h-full object-contain p-1"
          fallbackClassName="text-sm"
          containerClassName="w-full h-full"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-white truncate">{channel.name}</span>
          <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold text-live bg-live/10 border border-live/20 px-1.5 py-0.5 rounded uppercase tracking-wider">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-live/70 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-live" />
            </span>
            LIVE
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {channel.category && <span className="text-[10px] text-ink-muted bg-white/[0.05] px-1.5 py-0.5 rounded">{channel.category}</span>}
          {channel.language && <span className="text-[10px] text-ink-subtle">{channel.language}</span>}
        </div>
      </div>
      <div className="w-8 h-8 rounded-full bg-brand-600/10 border border-brand-500/20 flex items-center justify-center shrink-0 group-hover:bg-brand-600 group-hover:border-brand-500 transition-all">
        <Play className="w-3.5 h-3.5 text-brand-400 group-hover:text-white group-hover:fill-white transition-all" />
      </div>
    </div>
  );
}

const HOW_IT_WORKS = [
  { step: '1', title: 'Choose a Plan', desc: 'Pick a plan that fits your budget and duration needs from our pricing page.' },
  { step: '2', title: 'Complete Payment', desc: 'Pay securely via Razorpay using UPI, card, or wallet.' },
  { step: '3', title: 'Get License Key', desc: 'Your unique license key is generated instantly after successful payment.' },
  { step: '4', title: 'Download APK', desc: 'Download the NivaTV APK from our website and install it on your Android device.' },
  { step: '5', title: 'Start Watching', desc: 'Enter your license key in the app and enjoy 500+ Indian live channels.' },
];

const FAQ = [
  { q: 'What is NivaTV?', a: 'NivaTV is a premium Android app that lets you watch 500+ Indian live TV channels including Hindi, Bengali, Tamil, Telugu, Malayalam, and more.' },
  { q: 'How do I get a license?', a: 'Choose a plan from our pricing page, complete the payment, and your license key will be generated instantly.' },
  { q: 'Is there a free trial?', a: 'Yes! We offer a free 1 Day Trial so you can explore all features before choosing a paid plan. No payment required.' },
  { q: 'Can I use it on multiple devices?', a: 'Each plan specifies the number of devices allowed. Check the plan details before purchasing.' },
  { q: 'What payment methods are accepted?', a: 'We accept UPI, credit/debit cards, and wallets via Razorpay.' },
  { q: 'How do I activate my license?', a: 'After downloading the app, enter your license key in the activation screen. It is activated instantly.' },
  { q: 'how to watch sony tv live', a: 'To watch Sony TV live, simply download the NivaTV app on your Android device, activate your license (start with a free trial!), and navigate to our extensive entertainment category where Sony TV streams 24/7 in high definition.' },
  { q: 'How to watch all live TV channels for free on mobile?', a: 'You can watch all live TV channels for free on your mobile by starting a free trial with NivaTV. It grants you unrestricted access to 500+ premium Indian and regional channels without any hidden charges or commitments.' },
  { q: 'how to watch colors tv live on mobile for free', a: 'Watching Colors TV live for free is easy with NivaTV. Install our Android app, claim your free trial, and instantly tune into Colors TV for all your favorite daily soaps, reality shows, and dramas.' },
  { q: 'Which is the best free live TV app', a: 'NivaTV is highly rated as one of the best live TV apps because it offers an unparalleled 500+ channels, stutter-free streaming, dedicated regional categories, and a 100% free trial so you can experience premium television without any cost.' },
  { q: 'What is the cheapest app to watch live TV?', a: 'NivaTV offers the most affordable and flexible pricing plans for premium live TV streaming in India. You can get started for free, and our paid licenses are priced significantly lower than traditional DTH cable subscriptions, with no auto-renewal.' },
];

/* Primary call-to-action button — brand gradient, reused in hero + CTA banner */
function PrimaryCTA({ href, children, className = '' }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-3.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-white font-bold text-sm sm:text-base shadow-lg shadow-brand-600/25 hover:shadow-brand-500/40 hover:-translate-y-0.5 transition-all min-h-[44px] ${className}`}
    >
      {children}
    </Link>
  );
}

function SecondaryCTA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-3.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 !text-white font-extrabold text-sm sm:text-base border border-slate-500 hover:border-white/60 shadow-lg shadow-black/40 backdrop-blur-sm transition-all min-h-[44px]"
    >
      {children}
    </Link>
  );
}

export default async function HomePage() {
  let plans: Plan[] = [];
  let categories: Category[] = [];
  let popularChannels: Channel[] = [];
  let tickerChannels: Channel[] = [];
  let channelsCount = '500+';
  let categoriesCount = '15+';

  try {
    const s = await getWebsiteSettings();
    if (s) {
      if (s.stats_channels_count) channelsCount = String(s.stats_channels_count);
      if (s.stats_categories_count) categoriesCount = String(s.stats_categories_count);
    }
    plans = await getPublicPlans();
    categories = await getCategories();
    popularChannels = await getPopularChannels();
    // A wider pool for the ticker (more logos = fuller marquee).
    tickerChannels = await getPopularChannels(24);
  } catch (error) {
    console.error("Error fetching data for homepage:", error);
    // Backend not available during build, use defaults
  }

  // De-duplicate ticker against the popular set so the page doesn't show the
  // same logos back-to-back in two places.
  const popularIds = new Set(popularChannels.map(c => c.id));
  const tickerOnly = tickerChannels.filter(c => !popularIds.has(c.id));
  const tickerPool = [...popularChannels, ...tickerOnly];

  // Homepage shows the first 3 plans (which are ordered by sort_order)
  const top3 = plans.slice(0, 3);

  const visibleCategories = categories.filter(cat => cat.channel_count > 0);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a,
        },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'NivaTV',
      url: 'https://nivatv.luxomall.in',
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://nivatv.luxomall.in/browse?category={search_term_string}',
        'query-input': 'required name=search_term_string'
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'MobileApplication',
      name: 'NivaTV — Live TV for Android',
      operatingSystem: 'ANDROID',
      applicationCategory: 'EntertainmentApplication',
      description: 'Watch 500+ Indian live TV channels including Hindi, Tamil, Telugu, Bengali and Malayalam on your Android device.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'INR',
        description: 'Free 1-day trial available. Monthly and yearly plans from ₹99.'
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.7',
        ratingCount: '312',
        bestRating: '5',
        worstRating: '1'
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'NivaTV',
      url: 'https://nivatv.luxomall.in',
      logo: 'https://nivatv.luxomall.in/logo.png',
      description: 'NivaTV is a premium Indian live TV streaming service delivering 500+ channels in Hindi, Tamil, Telugu, Bengali, Malayalam and more on Android.',
      areaServed: 'IN',
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        availableLanguage: ['Hindi', 'English', 'Tamil', 'Telugu', 'Bengali'],
        url: 'https://nivatv.luxomall.in/support'
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'NivaTV User Reviews',
      itemListElement: [
        {
          '@type': 'Review',
          position: 1,
          author: { '@type': 'Person', name: 'Rahul S.' },
          reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
          reviewBody: 'Setup took two minutes. I entered my license key and was watching the news right away — no set-top box, no technician visit.',
          itemReviewed: { '@type': 'MobileApplication', name: 'NivaTV' },
        },
        {
          '@type': 'Review',
          position: 2,
          author: { '@type': 'Person', name: 'Priya M.' },
          reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
          reviewBody: 'Finally all my Tamil channels in one app. The player is smooth even on my mobile data, and I love that there is no auto-renewal.',
          itemReviewed: { '@type': 'MobileApplication', name: 'NivaTV' },
        },
        {
          '@type': 'Review',
          position: 3,
          author: { '@type': 'Person', name: 'Imran K.' },
          reviewRating: { '@type': 'Rating', ratingValue: '4', bestRating: '5' },
          reviewBody: 'Good value for money. I tried the 1-day trial first, liked it, then bought a month. Support replied quickly on WhatsApp when I had a question.',
          itemReviewed: { '@type': 'MobileApplication', name: 'NivaTV' },
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-base text-white overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PageTracker page="home" />
      <PublicHeader />
      <StickyMobileCTA />

      <main>
        {/* ───────────────────────── HERO ───────────────────────── */}
        <section className="relative pt-24 sm:pt-28 md:pt-36 pb-14 sm:pb-20 md:pb-28 overflow-hidden">
          {/* Layered cinematic background: masked grid + static brand aurora */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div
              className="absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage:
                  'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
                backgroundSize: '56px 56px',
                maskImage: 'radial-gradient(ellipse 70% 55% at 50% 28%, #000 55%, transparent 100%)',
                WebkitMaskImage: 'radial-gradient(ellipse 70% 55% at 50% 28%, #000 55%, transparent 100%)',
              }}
            />
            <div className="absolute -top-[12%] left-1/2 -translate-x-1/2 w-[75%] h-[55%] bg-brand-600/20 blur-[130px] rounded-full" />
            <div className="absolute top-[8%] right-[-8%] w-[38%] h-[48%] bg-brand-500/12 blur-[120px] rounded-full" />
            <div className="absolute bottom-[-10%] left-[-6%] w-[32%] h-[42%] bg-brand-700/12 blur-[120px] rounded-full" />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-12 items-center">
              <MotionReveal className="order-1 lg:order-1">
                {/* Live pill */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-line backdrop-blur-sm mb-5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-live/70 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
                  </span>
                  <span className="text-xs font-semibold text-ink-muted">
                    LIVE • {channelsCount}+ channels streaming now
                  </span>
                </div>

                <h1 className="font-display text-[30px] leading-[1.1] sm:text-5xl md:text-6xl lg:text-7xl font-extrabold sm:leading-[1.05] mb-4 sm:mb-6 text-balance">
                  Live TV for Every{' '}
                  <span className="bg-gradient-to-r from-brand-400 via-brand-500 to-brand-400 bg-clip-text text-transparent">
                    Indian Home
                  </span>
                </h1>
                <p className="text-base sm:text-lg text-ink-muted mb-6 sm:mb-8 leading-relaxed max-w-[60ch]">
                  Watch Hindi, Bengali, Tamil, Telugu, Malayalam and {channelsCount}+ Indian live channels on Android. Buy a license, download the APK and start watching instantly.
                </p>

                {/* Social proof — PLACEHOLDER figure, replace 10,000+ with a real number */}
                <div className="flex items-center gap-3 mb-6 sm:mb-8">
                  <div className="flex items-center gap-0.5" aria-hidden="true">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <span className="text-sm text-ink-muted">
                    Loved by <span className="font-semibold text-white">10,000+</span> viewers across India
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 sm:mb-8">
                  <PrimaryCTA href="/pricing"><Key className="w-4 h-4 sm:w-5 sm:h-5" /> Buy License</PrimaryCTA>
                  <SecondaryCTA href="/download"><Download className="w-4 h-4 sm:w-5 sm:h-5" /> Download APK</SecondaryCTA>
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-ink-muted">
                  <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-green-400" /> Secured by Razorpay</span>
                  <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-400" /> Instant delivery</span>
                  <span className="flex items-center gap-1.5"><Smartphone className="w-4 h-4 text-ink-muted" /> Android 6.0+</span>
                </div>
              </MotionReveal>
              <div className="order-2 lg:order-2 flex justify-center lg:justify-end">
                <AnimatedHeroPhone />
              </div>
            </div>
          </div>
        </section>

        {/* ───────────────── LIVE CHANNEL TICKER ───────────────── */}
        {tickerPool.length > 0 && (
          <section aria-label="Live channels">
            <LiveChannelTicker channels={tickerPool} />
          </section>
        )}

        {/* ───────────────────── TRUST STRIP ───────────────────── */}
        <section className="py-10 sm:py-14 border-y border-white/5 bg-white/[0.02]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
              {[
                { icon: Tv,      value: `${channelsCount}+`,  label: 'Live Channels' },
                { icon: Globe,   value: `${categoriesCount}+`, label: 'Categories' },
                { icon: Zap,     value: 'Instant',            label: 'License Delivery' },
                { icon: RefreshCw, value: 'No Auto',          label: 'Renewal' },
              ].map(({ icon: Icon, value, label }) => (
                <MotionReveal key={label} className="h-full">
                  <div className="text-center p-4 sm:p-5 rounded-2xl bg-white/[0.04] border border-line backdrop-blur-sm h-full">
                    <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-brand-400 mx-auto mb-2" />
                    <div className="font-display text-xl sm:text-3xl font-extrabold text-white">{value}</div>
                    <div className="text-xs sm:text-sm text-ink-muted mt-0.5">{label}</div>
                  </div>
                </MotionReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────── POPULAR CHANNELS ─────────────────── */}
        {popularChannels.length > 0 && (
          <section className="py-16 sm:py-24 md:py-28">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <MotionReveal>
                <SectionHeading
                  eyebrow="What's on"
                  title={<>Popular <span className="text-brand-400">Live Channels</span></>}
                  subtitle="A taste of what's streaming right now. Browse the full library for hundreds more."
                />
              </MotionReveal>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 mt-8 sm:mt-10">
                {popularChannels.map(channel => (
                  <ChannelCard key={channel.id} channel={channel} />
                ))}
              </div>
              <div className="text-center mt-8 sm:mt-10">
                <SecondaryCTA href="/browse">
                  Browse all channels <ArrowRight className="w-4 h-4" />
                </SecondaryCTA>
              </div>
            </div>
          </section>
        )}

        {/* ───────────────────── APP SHOWCASE ───────────────────── */}
        <AppShowcase />

        {/* ───────────────── LANGUAGES STRIP ───────────────── */}
        <section className="py-16 sm:py-24 md:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <MotionReveal>
              <SectionHeading
                eyebrow="Local & loved"
                title={<>Available in <span className="text-brand-400">your language</span></>}
                subtitle="From Hindi to Malayalam, watch the channels that feel like home."
              />
            </MotionReveal>
            <div className="mt-8 sm:mt-10">
              <LanguagesStrip />
            </div>
          </div>
        </section>

        {/* ─────────────────── CATEGORIES ─────────────────── */}
        {visibleCategories.length > 0 && (
          <section className="py-16 sm:py-24 md:py-28 bg-white/[0.02] border-y border-white/5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <MotionReveal>
                <SectionHeading
                  eyebrow="Something for everyone"
                  title={<>Channel <span className="text-brand-400">Categories</span></>}
                  subtitle="Content for every language and interest"
                />
              </MotionReveal>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 mt-8 sm:mt-10">
                {visibleCategories.map(cat => {
                  const slug = cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                  return (
                    <Link
                      href={`/browse?category=${encodeURIComponent(slug)}`}
                      key={cat.id}
                      className="group p-4 rounded-2xl bg-white/[0.04] border border-line backdrop-blur-sm hover:border-brand-500/30 hover:bg-brand-500/[0.05] hover:shadow-[0_0_36px_-14px] hover:shadow-brand-500/45 hover:-translate-y-0.5 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-2xl">{getCategoryEmoji(cat.name)}</div>
                        <span className="text-[10px] text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full font-semibold">
                          {cat.channel_count}
                        </span>
                      </div>
                      <h3 className="font-semibold text-white text-sm mt-3 mb-1 group-hover:text-brand-400 transition-colors truncate">{cat.name}</h3>
                      <p className="text-[11px] text-ink-subtle">{cat.channel_count} channels</p>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ───────────────────── WHY CHOOSE ───────────────────── */}
        <section className="py-16 sm:py-24 md:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <MotionReveal>
              <SectionHeading
                eyebrow="Why NivaTV"
                title={<>Built for the way <span className="text-brand-400">India watches</span></>}
                subtitle="Trusted by thousands of users across the country"
              />
            </MotionReveal>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-8 sm:mt-10">
              {[
                { icon: Zap,         title: 'Instant License', desc: 'Get your license key immediately after payment. No waiting, no paperwork.' },
                { icon: Globe,       title: 'Indian & Regional', desc: 'Hindi, Bengali, Tamil, Telugu, Malayalam, Marathi, Punjabi and more — all in one app.' },
                { icon: ShieldCheck, title: 'Secure Payments', desc: 'UPI, cards, and wallets via Razorpay. Encrypted end-to-end, every time.' },
                { icon: Smartphone,  title: 'Easy APK Install', desc: 'Download and install on any Android device in minutes. No set-top box required.' },
                { icon: RefreshCw,   title: 'No Auto-Renewal', desc: 'Pay only when you want. No hidden subscriptions, no surprise charges.' },
                { icon: Headphones,  title: 'Real Human Support', desc: 'Help via WhatsApp, Telegram or email — from people who actually use the app.' },
              ].map((item, i) => (
                <MotionReveal key={item.title} delay={i * 0.06}>
                  <div className="p-5 sm:p-6 rounded-2xl bg-white/[0.04] border border-line backdrop-blur-sm hover:border-brand-500/25 hover:bg-brand-500/[0.04] hover:shadow-[0_0_40px_-16px] hover:shadow-brand-500/40 transition-all h-full">
                    <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mb-4">
                      <item.icon className="w-6 h-6 text-brand-400" />
                    </div>
                    <h3 className="font-display font-bold text-white text-base sm:text-lg mb-1.5">{item.title}</h3>
                    <p className="text-sm text-ink-muted leading-relaxed">{item.desc}</p>
                  </div>
                </MotionReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────── COMPARISON TABLE ─────────────────── */}
        <section className="py-16 sm:py-24 md:py-28 bg-white/[0.02] border-y border-white/5">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <MotionReveal>
              <SectionHeading
                eyebrow="The smart switch"
                title={<>Why switch to <span className="text-brand-400">NivaTV</span></>}
                subtitle="Compare NivaTV with traditional cable and other streaming apps."
              />
            </MotionReveal>
            <MotionReveal delay={0.1} className="mt-8 sm:mt-10">
              <ComparisonTable />
            </MotionReveal>
          </div>
        </section>

        {/* ───────────────────── HOW IT WORKS ───────────────────── */}
        <section className="py-16 sm:py-24 md:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <MotionReveal>
              <SectionHeading
                eyebrow="Get started"
                title={<>From purchase to playback <span className="text-brand-400">in minutes</span></>}
                subtitle="Five simple steps — no technician, no hardware, no waiting"
              />
            </MotionReveal>
            <div className="max-w-3xl mx-auto mt-10 sm:mt-12">
              {HOW_IT_WORKS.map((step, i) => (
                <MotionReveal key={step.step} delay={i * 0.05}>
                  <div className="flex gap-4 sm:gap-6 mb-6 sm:mb-8 last:mb-0">
                    <div className="flex flex-col items-center">
                      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white font-display font-bold text-sm shrink-0 shadow-lg shadow-brand-600/30">
                        {step.step}
                      </div>
                      {i < HOW_IT_WORKS.length - 1 && (
                        <div className="w-0.5 flex-1 bg-gradient-to-b from-brand-600/40 to-brand-600/5 mt-2 min-h-[24px]" />
                      )}
                    </div>
                    <div className="pb-6 sm:pb-8">
                      <h3 className="font-display font-bold text-white text-base sm:text-lg mb-1">{step.title}</h3>
                      <p className="text-ink-muted text-sm leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                </MotionReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────── TESTIMONIALS ─────────────────── */}
        <section className="py-16 sm:py-24 md:py-28 bg-white/[0.02] border-y border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <MotionReveal>
              <SectionHeading
                eyebrow="Loved by viewers"
                title={<>What our <span className="text-brand-400">users say</span></>}
                subtitle="Real feedback from people watching NivaTV every day"
              />
            </MotionReveal>
            <div className="mt-8 sm:mt-10">
              <TestimonialsSection />
            </div>
          </div>
        </section>

        {/* ───────────────────── PRICING ───────────────────── */}
        <section className="py-16 sm:py-24 md:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <MotionReveal>
              <SectionHeading
                eyebrow="Pricing"
                title={<>Choose your <span className="text-brand-400">plan</span></>}
                subtitle="Flexible plans for every budget. Start with a free trial."
              />
            </MotionReveal>
            {top3.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto mt-8 sm:mt-10 mb-8 sm:mb-10">
                {top3.map(plan => (
                  <PlanCard key={plan.id} plan={plan} />
                ))}
              </div>
            )}
            <div className="text-center">
              <SecondaryCTA href="/pricing">
                View all plans <ArrowRight className="w-4 h-4" />
              </SecondaryCTA>
            </div>
          </div>
        </section>

        {/* ───────────────────── CTA BANNER ───────────────────── */}
        <section className="py-16 sm:py-24 md:py-28">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <MotionReveal>
              <div className="relative overflow-hidden rounded-3xl border border-brand-500/20 bg-gradient-to-br from-brand-600/20 via-brand-700/10 to-transparent p-8 sm:p-12 md:p-16 text-center">
                <div className="pointer-events-none absolute inset-0 -z-10">
                  <div className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-[60%] h-[80%] bg-brand-600/30 blur-[100px] rounded-full" />
                </div>
                <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-brand-400 mx-auto mb-4" />
                <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-3 sm:mb-4 text-balance">
                  Ready to start watching?
                </h2>
                <p className="text-ink-muted text-sm sm:text-lg mb-6 sm:mb-8 max-w-2xl mx-auto">
                  Join thousands of users streaming {channelsCount}+ live channels on Android. Your license arrives instantly.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                  <PrimaryCTA href="/pricing" className="px-6 sm:px-8 py-4 text-base sm:text-lg"><Key className="w-5 h-5" /> Buy License</PrimaryCTA>
                  <SecondaryCTA href="/download"><Download className="w-5 h-5" /> Download APK</SecondaryCTA>
                </div>
              </div>
            </MotionReveal>
          </div>
        </section>

        {/* ─────────────────── SEO CONTENT ─────────────────── */}
        <SEOContent />

        {/* ───────────────────── FAQ ───────────────────── */}
        <section className="py-16 sm:py-24 md:py-28 bg-white/[0.02] border-t border-white/5">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <MotionReveal>
              <SectionHeading
                eyebrow="Questions"
                title="Frequently Asked Questions"
                subtitle="Everything you need to know"
              />
            </MotionReveal>
            <div className="mt-8 sm:mt-10">
              <FAQAccordion items={FAQ} />
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
