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
    icon: Tv, title: 'Live TV Channels',
    desc: 'Stream 500+ Indian and regional live TV channels in real time. No delays, no buffering on a good connection. Channels include entertainment, news, sports, movies, kids, devotional and more.',
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
    desc: 'Mark any channel as a favourite and access it instantly from your Favourites section. Your list is saved and synced to your account.',
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
        <div className="text-center mb-14">
          <h1 className="text-5xl font-extrabold text-white mb-4">App Features</h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Built specifically for Indian viewers who want a reliable, fast and beautiful live TV experience.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {FEATURES.map(f => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="flex gap-5 bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-red-500/30 transition-colors">
                <div className="w-12 h-12 shrink-0 rounded-xl bg-red-600/15 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold mb-2">{f.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center bg-gradient-to-r from-red-600/15 to-transparent border border-red-500/20 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-white mb-3">Ready to get started?</h2>
          <p className="text-slate-400 mb-6">Choose a plan and start watching live TV today.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/pricing" className="px-8 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors">
              View Pricing
            </Link>
            <Link href="/download" className="flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors border border-white/10">
              Download APK <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
