import Link from 'next/link';
import {
  Tv, Key, Zap, RefreshCw,
  ArrowRight, Download, Check, Radio, Globe, Smartphone,
  ShieldCheck, CircleHelp, Play, Search
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
import type { Metadata } from 'next';
import type { Plan, Category, Channel } from '@/lib/publicApi';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'NivaTV - Live TV for Every Indian Home',
  description:
    'Watch Hindi, Bengali, Tamil, Telugu, Malayalam and 500+ Indian live channels on Android. Buy a license, download the APK and start watching.',
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

/* Channel Card */
function ChannelCard({ channel }: { channel: Channel }) {
  return (
    <div className="bg-[#121214] border border-white/[0.06] rounded-2xl p-4 flex items-center gap-3.5 hover:border-indigo-500/20 hover:bg-[#18181a] transition-all duration-300 min-w-[220px] sm:min-w-0 group">
      <div className="w-11 h-11 rounded-xl bg-[#1c1c20] flex items-center justify-center shrink-0 overflow-hidden">
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
          <span className="shrink-0 text-[9px] font-bold text-indigo-400 bg-indigo-600/10 border border-indigo-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider">LIVE</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {channel.category && <span className="text-[10px] text-slate-500 bg-white/[0.04] px-1.5 py-0.5 rounded">{channel.category}</span>}
          {channel.language && <span className="text-[10px] text-slate-600">{channel.language}</span>}
        </div>
      </div>
      <Radio className="w-3.5 h-3.5 text-indigo-500/60 shrink-0 group-hover:text-indigo-500 group-hover:scale-110 transition-all" />
    </div>
  );
}

/* Data */
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
];

/* Main Page */
export default async function HomePage() {
  let plans: Plan[] = [];
  let categories: Category[] = [];
  let popularChannels: Channel[] = [];
  let websiteSettings = {};
  let channelsCount = '500+';
  let categoriesCount = '15+';

  try {
    const s = await getWebsiteSettings();
    if (s) {
      websiteSettings = s;
      if (s.stats_channels_count) channelsCount = String(s.stats_channels_count);
      if (s.stats_categories_count) categoriesCount = String(s.stats_categories_count);
    }
    plans = await getPublicPlans();
    categories = await getCategories();
    popularChannels = await getPopularChannels();
  } catch (error) {
    console.error("Error fetching data for homepage:", error);
    // Backend not available during build, use defaults
  }
  
  console.log("popularChannels length:", popularChannels.length);

  // Homepage shows only: 1 Day Trial, 1 Month (Most Popular), 1 Year (Best Value)
  const planTrial = plans.find(p => p.duration_days <= 1 || /trial|1.*day/i.test(p.name));
  const plan1m = plans.find(p => p.duration_days === 30 || /^1\s*month/i.test(p.name));
  const plan1y = plans.find(p => p.duration_days >= 365 || /1.*year/i.test(p.name));
  const top3 = [planTrial, plan1m, plan1y].filter(Boolean) as Plan[];

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white overflow-x-hidden">
      <PageTracker page="home" />
      <PublicHeader />
      <StickyMobileCTA />

      <main>
        {/* HERO */}
        <section className="relative pt-20 sm:pt-24 md:pt-32 pb-12 sm:pb-16 md:pb-24 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-12 items-center">
              <div className="order-2 lg:order-1">
                <h1 className="text-[28px] leading-[1.15] sm:text-4xl md:text-5xl lg:text-6xl font-extrabold sm:leading-tight mb-4 sm:mb-6">
                  Live TV for Every <span className="text-indigo-500">Indian Home</span>
                </h1>
                <p className="text-base sm:text-lg text-slate-400 mb-6 sm:mb-8 leading-relaxed max-w-xl">
                  Watch Hindi, Bengali, Tamil, Telugu, Malayalam and 500+ Indian live channels on Android. Buy a license, download the APK and start watching instantly.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 sm:mb-8">
                  <Link
                    href="/pricing"
                    className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm sm:text-base transition-colors min-h-[44px]"
                  >
                    <Key className="w-4 h-4 sm:w-5 sm:h-5" /> Buy License
                  </Link>
                  <Link
                    href="/download"
                    className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm sm:text-base border border-white/10 transition-colors min-h-[44px]"
                  >
                    <Download className="w-4 h-4 sm:w-5 sm:h-5" /> Download APK
                  </Link>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-6 text-xs sm:text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-green-400" /> Instant delivery
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-green-400" /> No auto-renewal
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-green-400" /> 24/7 support
                  </span>
                </div>
              </div>
              <div className="order-1 lg:order-2 flex justify-center lg:justify-end">
                <AnimatedHeroPhone />
              </div>
            </div>
          </div>
        </section>

        {/* TRUST STRIP */}
        <section className="py-6 sm:py-10 border-y border-white/5 bg-white/[0.02]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
              <div className="text-center p-3 sm:p-4 rounded-lg sm:rounded-xl bg-white/[0.03] border border-white/5">
                <Tv className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400 mx-auto mb-1.5 sm:mb-2" />
                <div className="text-lg sm:text-2xl font-extrabold text-white">{channelsCount}+</div>
                <div className="text-xs sm:text-sm text-slate-400">Live Channels</div>
              </div>
              <div className="text-center p-3 sm:p-4 rounded-lg sm:rounded-xl bg-white/[0.03] border border-white/5">
                <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400 mx-auto mb-1.5 sm:mb-2" />
                <div className="text-lg sm:text-2xl font-extrabold text-white">{categoriesCount}+</div>
                <div className="text-xs sm:text-sm text-slate-400">Categories</div>
              </div>
              <div className="text-center p-3 sm:p-4 rounded-lg sm:rounded-xl bg-white/[0.03] border border-white/5">
                <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400 mx-auto mb-1.5 sm:mb-2" />
                <div className="text-lg sm:text-2xl font-extrabold text-white">Instant</div>
                <div className="text-xs sm:text-sm text-slate-400">License Delivery</div>
              </div>
              <div className="text-center p-3 sm:p-4 rounded-lg sm:rounded-xl bg-white/[0.03] border border-white/5">
                <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400 mx-auto mb-1.5 sm:mb-2" />
                <div className="text-lg sm:text-2xl font-extrabold text-white">No Auto</div>
                <div className="text-xs sm:text-sm text-slate-400">Renewal</div>
              </div>
            </div>
          </div>
        </section>

        {/* POPULAR CHANNELS */}
        <section className="py-10 sm:py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-2 sm:mb-3">Popular Live Channels</h2>
              <p className="text-slate-400 text-sm sm:text-lg max-w-2xl mx-auto">
                Watch your favorite channels instantly.
              </p>
              <p className="text-slate-500 text-xs sm:text-sm mt-2">
                Channel availability updates regularly based on source status.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {popularChannels.map(channel => (
                <ChannelCard key={channel.id} channel={channel} />
              ))}
            </div>
            {popularChannels.length === 0 && (
              <div className="text-center text-slate-500 py-12">
                <Tv className="w-8 h-8 mx-auto mb-3 text-slate-600" />
                <p>FOOBAR LOADING...</p>
                <pre>{JSON.stringify(popularChannels, null, 2)}</pre>
                <p>Length: {popularChannels.length}</p>
              </div>
            )}
          </div>
        </section>

        {/* APP SHOWCASE */}
        <AppShowcase />

        {/* CHANNEL CATEGORIES */}
        <section className="py-10 sm:py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-2 sm:mb-4">Channel Categories</h2>
              <p className="text-slate-400 text-sm sm:text-lg max-w-2xl mx-auto">
                Content for every language and interest
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {categories
                .filter(cat => cat.channel_count > 0)
                .map(cat => {
                  const slug = cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                  return (
                    <Link
                      href={`/browse?category=${encodeURIComponent(slug)}`}
                      key={cat.id}
                      className="group p-3 sm:p-4 rounded-xl bg-white/5 border border-white/10 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-xl sm:text-2xl mb-2">{getCategoryEmoji(cat.name)}</div>
                        <span className="text-[10px] text-slate-600 bg-white/5 px-1.5 py-0.5 rounded-full font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          {cat.channel_count}
                        </span>
                      </div>
                      <h3 className="font-semibold text-white text-xs sm:text-sm mb-1 group-hover:text-indigo-400 transition-colors truncate">{cat.name}</h3>
                      <p className="text-[10px] sm:text-xs text-slate-500">{cat.channel_count} channels</p>
                    </Link>
                  );
                })}
            </div>
          </div>
        </section>

        {/* WHY CHOOSE */}
        <section className="py-10 sm:py-16 md:py-24 bg-white/[0.02]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-2 sm:mb-4">Why Choose NivaTV?</h2>
              <p className="text-slate-400 text-sm sm:text-lg max-w-2xl mx-auto">
                Trusted by thousands of users across India
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {[
                { icon: Zap, title: 'Instant License', desc: 'Get your license key immediately after payment.' },
                { icon: RefreshCw, title: 'No Auto-Renewal', desc: 'Pay only when you want. No hidden subscriptions.' },
                { icon: Globe, title: 'Indian & Regional', desc: 'Hindi, Bengali, Tamil, Telugu and more.' },
                { icon: Smartphone, title: 'Easy APK', desc: 'Simple download and installation on unknown Android device.' },
                { icon: ShieldCheck, title: 'Secure Payments', desc: 'UPI, cards, wallets - all encrypted and safe.' },
                { icon: CircleHelp, title: 'Support', desc: 'Help via WhatsApp, Telegram or email.' },
              ].map((item, i) => (
                <div key={i} className="p-4 sm:p-6 rounded-xl bg-white/5 border border-white/10 hover:border-indigo-500/20 transition-colors">
                  <item.icon className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-400 mb-3 sm:mb-4" />
                  <h3 className="font-bold text-white text-sm sm:text-base mb-1 sm:mb-2">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="py-10 sm:py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-2 sm:mb-4">How It Works</h2>
              <p className="text-slate-400 text-sm sm:text-lg max-w-2xl mx-auto">
                From purchase to playback in 5 simple steps
              </p>
            </div>
            <div className="max-w-3xl mx-auto">
              {HOW_IT_WORKS.map((step, i) => (
                <div key={i} className="flex gap-4 sm:gap-6 mb-6 sm:mb-8 last:mb-0">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm shrink-0">
                      {step.step}
                    </div>
                    {i < HOW_IT_WORKS.length - 1 && (
                      <div className="w-0.5 h-full bg-indigo-600/20 mt-2" />
                    )}
                  </div>
                  <div className="pb-6 sm:pb-8">
                    <h3 className="font-bold text-white text-base sm:text-lg mb-1">{step.title}</h3>
                    <p className="text-slate-400 text-xs sm:text-sm">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="py-10 sm:py-16 md:py-24 bg-white/[0.02]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-2 sm:mb-4">Choose Your Plan</h2>
              <p className="text-slate-400 text-sm sm:text-lg max-w-2xl mx-auto">
                Flexible plans for every budget
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto mb-8 sm:mb-10">
              {top3.map(plan => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
            </div>
            <div className="text-center">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 px-5 sm:px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm sm:text-base border border-white/10 transition-colors"
              >
                View all plans <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-10 sm:py-16 md:py-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-4 sm:mb-6">Ready to start watching?</h2>
            <p className="text-slate-400 text-sm sm:text-lg mb-6 sm:mb-8 max-w-2xl mx-auto">
              Join thousands of users streaming 500+ live channels on Android.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base sm:text-lg transition-colors min-h-[44px]"
              >
                <Key className="w-4 h-4 sm:w-5 sm:h-5" /> Buy License
              </Link>
              <Link
                href="/download"
                className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-base sm:text-lg border border-white/10 transition-colors min-h-[44px]"
              >
                <Download className="w-4 h-4 sm:w-5 sm:h-5" /> Download APK
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-10 sm:py-16 md:py-24 bg-white/[0.02]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-2 sm:mb-4">Frequently Asked Questions</h2>
              <p className="text-slate-400 text-sm sm:text-lg">Everything you need to know</p>
            </div>
            <FAQAccordion items={FAQ} />
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
