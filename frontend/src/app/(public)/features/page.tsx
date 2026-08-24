import Link from 'next/link';
import {
  Tv, Globe, MonitorPlay, Zap, Search, Heart, Key, Shield,
  Wifi, List, RefreshCw, Headphones, ArrowRight,
} from 'lucide-react';
import type { Metadata } from 'next';
import PageTracker from '@/components/public/PageTracker';

export const metadata: Metadata = {
  title: 'Features — NivaTV',
  description: 'Explore all features of the NivaTV Android app.',
};

const FEATURES = [
  {
    icon: Tv, title: 'Free-to-Air Live TV',
    desc: 'Stream 500+ Free-to-Air (FTA) and publicly available Indian and regional live TV channels in real time. The app functions as a media player for publicly available broadcasts.',
  },
  {
    icon: Globe, title: 'Indian & Regional Categories',
    desc: 'Dedicated sections for Hindi, Bengali, Tamil, Telugu, Malayalam, Kannada, Marathi, Punjabi, Gujarati, Odia, Assamese, Urdu and more regional languages.',
  },
  {
    icon: MonitorPlay, title: 'Premium Dark UI',
    desc: 'A beautiful dark-themed interface designed for comfortable long-duration viewing. Clean channel cards, smooth transitions and a minimal layout that stays out of your way.',
  },
  {
    icon: Zap, title: 'Smooth Video Player',
    desc: 'HLS-powered player with hardware acceleration. Supports multiple stream qualities and automatically switches to the best available stream if the primary stream fails.',
  },
  {
    icon: Search, title: 'Search Channels',
    desc: 'Instantly search by channel name across all categories. Filter by language or browse category-wise with a clean grid layout.',
  },
  {
    icon: Heart, title: 'Favourites',
    desc: 'Mark unknown channel as a favourite and access it instantly from your Favourites section. Your list is saved and synced to your account.',
  },
  {
    icon: Key, title: 'License Activation',
    desc: 'Simple one-time activation using your license key. Purchase a plan, copy your key, paste it inside the app and your subscription activates immediately.',
  },
  {
    icon: Shield, title: 'Device Limit Protection',
    desc: 'Your license is tied to a specific number of devices. This prevents unauthorised sharing and ensures only you and your family use your subscription.',
  },
  {
    icon: Wifi, title: 'Auto Quality / Data Saver',
    desc: 'The player automatically adjusts stream quality based on your current internet speed. On slower connections it drops to a lower bitrate to keep playback smooth.',
  },
  {
    icon: List, title: 'Related Channels',
    desc: 'While watching a channel, see a list of related channels from the same category or language. Discover new content without going back to the home screen.',
  },
  {
    icon: RefreshCw, title: 'Regular Channel Updates',
    desc: 'Our team monitors channel health 24/7. Dead or broken streams are fixed or replaced quickly. No action needed from you — updates happen in the background.',
  },
  {
    icon: Headphones, title: 'Support System',
    desc: 'Dedicated WhatsApp and email support. Report a broken channel directly from the app or reach our support team for account and billing help.',
  },
];

export default function FeaturesPage() {
  return (
    <div className="pt-24 pb-20 px-4">
      <PageTracker page="features" />
      <div className="max-w-6xl mx-auto">

        {/* ── Page heading ── */}
        <div className="text-center mb-14">
          <h1 className="text-5xl font-extrabold text-[var(--color-ink)] mb-4">App Features</h1>
          <p className="text-[var(--color-ink-subtle)] text-lg max-w-xl mx-auto">
            Built specifically for Indian viewers who want a reliable, fast and beautiful live TV experience.
          </p>
        </div>

        {/* ── Feature grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {FEATURES.map(f => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="flex gap-5 bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl p-6 hover:border-brand-500/30 hover:shadow-card-hover transition-all duration-300 shadow-card"
              >
                <div className="w-12 h-12 shrink-0 rounded-xl bg-brand-500/10 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-brand-500" />
                </div>
                <div>
                  <h3 className="text-[var(--color-ink)] font-bold mb-2">{f.title}</h3>
                  <p className="text-[var(--color-ink-muted)] text-sm leading-relaxed">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── CTA banner ── */}
        <div className="text-center bg-gradient-to-r from-brand-600/15 to-transparent border border-brand-500/20 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-[var(--color-ink)] mb-3">Ready to get started?</h2>
          <p className="text-[var(--color-ink-muted)] mb-6">Choose a plan and start watching live TV today.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/pricing"
              className="px-8 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold transition-colors shadow-lg shadow-brand-600/20"
            >
              View Pricing
            </Link>
            <Link
              href="/download"
              className="flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)] text-[var(--color-ink)] font-semibold transition-colors border border-[var(--color-line)]"
            >
              Download APK <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
