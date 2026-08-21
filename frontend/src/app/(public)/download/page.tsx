import Link from 'next/link';
import {
  Download,
  Smartphone,
  CheckCircle,
  AlertCircle,
  Package,
  Calendar,
  HardDrive,
  Cpu,
  Zap,
  ShieldCheck,
  Tv,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { getAppDownload } from '@/lib/publicApi';
import type { Metadata } from 'next';
import PageTracker from '@/components/public/PageTracker';
import DownloadFaqAccordion from './DownloadFaqAccordion';
import AndroidAutoDetectBanner from './AndroidAutoDetectBanner';

// Revalidate every hour — replaces force-dynamic so Cache-Control is public.
export const revalidate = 3600;
export const metadata: Metadata = {
  title: 'Download NivaTV APK — Free-to-Air (FTA) Live TV Player',
  description:
    'Download the NivaTV Android APK to watch Free-to-Air (FTA), Zee News, public broadcasts and 500+ Indian live channels on your mobile & TV. Ultra-fast, lightweight player app.',
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  alternates: { canonical: 'https://nivatv.luxomall.in/download' },
  openGraph: {
    title: 'Download NivaTV APK — Free-to-Air Live TV Player',
    description:
      'Free APK download for NivaTV. Watch 500+ Indian Free-to-Air (FTA) and public live TV channels on any Android device. Ultra-lightweight & stutter-free.',
    url: 'https://nivatv.luxomall.in/download',
    siteName: 'NivaTV',
    type: 'website',
  },
};

const INSTALL_STEPS = [
  {
    step: 1,
    title: 'Download the APK',
    text: 'Choose the Standard 64-bit APK (recommended) or Legacy 32-bit APK above and start the download.',
  },
  {
    step: 2,
    title: 'Allow Installation',
    text: 'Open the downloaded file. When prompted by Android, enable "Install unknown apps" or "Allow from this source" in your settings.',
  },
  {
    step: 3,
    title: 'Security Verification',
    text: 'If Google Play Protect prompts with an initial scan dialog, tap "Scan app" or "Install" to proceed safely.',
  },
  {
    step: 4,
    title: 'Sign In or Register',
    text: 'Launch NivaTV on your device and log in with your registered account credentials.',
  },
  {
    step: 5,
    title: 'Activate & Watch Live',
    text: 'Enter your license key to unlock 500+ live HD channels with ultra-low latency streaming.',
  },
];

function toDirectDownloadUrl(url: string | null | undefined): string {
  if (!url) return '/downloads/app-release.apk';
  const trimmed = url.trim();
  if (trimmed.startsWith('/downloads/')) return trimmed;
  // Always serve local direct APK download to avoid Google Drive virus scan warning pages
  if (trimmed.includes('drive.google.com') || trimmed.includes('drive.usercontent.google.com')) {
    return '/downloads/app-release.apk';
  }
  return trimmed;
}

export default async function DownloadPage() {
  const release = await getAppDownload().catch(() => null);
  const standardDownloadUrl = release ? toDirectDownloadUrl(release.apk_url) : '/downloads/app-release.apk';
  const legacyDownloadUrl = '/downloads/app-release-32bit.apk';
  const appVersion = release?.version || '1.2.1';

  const howToJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to Install NivaTV APK on Android',
    description: 'Install the NivaTV live TV app on your Android device in 5 simple steps.',
    totalTime: 'PT5M',
    step: INSTALL_STEPS.map((s) => ({
      '@type': 'HowToStep',
      position: s.step,
      name: s.title,
      text: s.text,
    })),
  };

  const appJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'NivaTV',
    operatingSystem: 'Android 5.0 and higher',
    applicationCategory: 'EntertainmentApplication',
    description:
      'Watch 500+ Indian live TV channels on Android. Includes Hindi, Tamil, Telugu, Bengali, Malayalam, sports and news with zero-stutter hardware playback.',
    downloadUrl: 'https://nivatv.luxomall.in/download',
    fileSize: '32.5MB',
    softwareVersion: appVersion,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'INR',
      description: 'Free APK download. License key required to stream live channels.',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '480',
      bestRating: '5',
      worstRating: '1',
    },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nivatv.luxomall.in' },
      { '@type': 'ListItem', position: 2, name: 'Download', item: 'https://nivatv.luxomall.in/download' },
    ],
  };

  return (
    <div className="pt-24 pb-20 px-4 max-w-5xl mx-auto">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <PageTracker page="download" />

      {/* Header Section */}
      <div className="text-center mb-10 sm:mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs sm:text-sm font-semibold mb-4">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>Official Android Release v{appVersion}</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4 font-display">
          Download NivaTV for Android
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto text-base sm:text-lg">
          Enjoy 500+ Live Indian HD Channels, Sports, Movies, and News. Select the package tailored for your hardware.
        </p>
      </div>

      {/* Smart Device Auto-Detector Banner */}
      <AndroidAutoDetectBanner />

      {/* Dual Download Cards Grid */}
      <div className="grid md:grid-cols-2 gap-6 lg:gap-8 mb-12">
        {/* Card 1: Standard (64-bit) - Recommended */}
        <div className="relative rounded-3xl bg-gradient-to-b from-indigo-950/40 via-slate-900/60 to-slate-950/90 border-2 border-indigo-500/50 p-6 sm:p-8 flex flex-col justify-between shadow-2xl shadow-indigo-500/10 overflow-hidden">
          {/* Recommended Badge */}
          <div className="absolute top-0 right-0">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-bl-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-xs font-bold uppercase tracking-wider shadow-md">
              <CheckCircle className="w-3.5 h-3.5" /> Recommended
            </span>
          </div>

          <div>
            {/* Icon & Title */}
            <div className="flex items-center gap-4 mb-4 mt-1">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center shrink-0">
                <Smartphone className="w-7 h-7 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Standard (64-bit)</h2>
                <p className="text-indigo-300/80 text-xs sm:text-sm font-medium">
                  Optimized for modern Android devices
                </p>
              </div>
            </div>

            {/* Spec Badges Row */}
            <div className="grid grid-cols-3 gap-2.5 my-5">
              <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                <span className="text-slate-400 text-[11px] block font-medium">OS Support</span>
                <span className="text-white font-bold text-xs sm:text-sm">Android 5.0+</span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                <span className="text-slate-400 text-[11px] block font-medium">File Size</span>
                <span className="text-emerald-400 font-bold text-xs sm:text-sm">32.5 MB</span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                <span className="text-slate-400 text-[11px] block font-medium">Arch</span>
                <span className="text-indigo-300 font-bold text-xs sm:text-sm">ARM64-v8a</span>
              </div>
            </div>

            {/* Device Coverage Indicator */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 mb-5 flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="text-xs text-slate-300">
                <strong className="text-emerald-300">Compatible with ~95% of devices</strong>: Samsung, Xiaomi, OnePlus,
                Realme, Vivo, OPPO, Android TV, and Fire TV Stick.
              </div>
            </div>

            {/* Feature Highlights */}
            <ul className="space-y-2 mb-6 text-xs sm:text-sm text-slate-300">
              <li className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Native 64-bit hardware acceleration &amp; 0-stutter playback</span>
              </li>
              <li className="flex items-center gap-2">
                <Tv className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Full support for Smart TVs, TV boxes &amp; Tablets</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Clean build with stripped debug symbols for quick loading</span>
              </li>
            </ul>
          </div>

          <div>
            <a
              href={standardDownloadUrl}
              download="app-release.apk"
              className="group flex items-center justify-center gap-2.5 w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-base sm:text-lg transition-all shadow-xl shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.99]"
            >
              <Download className="w-5 h-5 transition-transform group-hover:-translate-y-0.5" />
              <span>Download APK (64-bit)</span>
              <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
            </a>
            <p className="text-center text-[11px] text-slate-400 mt-2.5">
              Direct official download • Virus-free &amp; verified
            </p>
          </div>
        </div>

        {/* Card 2: Legacy (32-bit) */}
        <div className="relative rounded-3xl bg-slate-900/40 border border-white/10 p-6 sm:p-8 flex flex-col justify-between shadow-xl overflow-hidden hover:border-white/20 transition-colors">
          <div>
            {/* Icon & Title */}
            <div className="flex items-center gap-4 mb-4 mt-1">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <Cpu className="w-7 h-7 text-slate-400" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Legacy (32-bit)</h2>
                <p className="text-slate-400 text-xs sm:text-sm font-medium">
                  For older Android phones &amp; budget hardware
                </p>
              </div>
            </div>

            {/* Spec Badges Row */}
            <div className="grid grid-cols-3 gap-2.5 my-5">
              <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                <span className="text-slate-400 text-[11px] block font-medium">OS Support</span>
                <span className="text-white font-bold text-xs sm:text-sm">Android 5.0+</span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                <span className="text-slate-400 text-[11px] block font-medium">File Size</span>
                <span className="text-amber-400 font-bold text-xs sm:text-sm">29.3 MB</span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                <span className="text-slate-400 text-[11px] block font-medium">Arch</span>
                <span className="text-slate-300 font-bold text-xs sm:text-sm">ARMeabi-v7a</span>
              </div>
            </div>

            {/* Device Coverage Indicator */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-5 flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="text-xs text-slate-300">
                <strong className="text-amber-300">Targeted for legacy architecture</strong>: Older 32-bit phones
                (pre-2017) or entry-level chipsets that do not support 64-bit instruction sets.
              </div>
            </div>

            {/* Feature Highlights */}
            <ul className="space-y-2 mb-6 text-xs sm:text-sm text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Broad compatibility fallback for older devices</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Ultra-lightweight RAM &amp; storage footprint</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Use if the Standard APK shows &quot;App not installed&quot;</span>
              </li>
            </ul>
          </div>

          <div>
            <a
              href={legacyDownloadUrl}
              download="app-release-32bit.apk"
              className="group flex items-center justify-center gap-2.5 w-full py-4 px-6 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-base sm:text-lg border border-white/10 transition-all hover:scale-[1.02] active:scale-[0.99]"
            >
              <Download className="w-5 h-5 text-slate-300" />
              <span>Download APK (32-bit)</span>
              <ArrowRight className="w-4 h-4 opacity-50 group-hover:translate-x-1 transition-transform" />
            </a>
            <p className="text-center text-[11px] text-slate-400 mt-2.5">
              Alternative build • Recommended only for 32-bit hardware
            </p>
          </div>
        </div>
      </div>

      {/* Release Details & Changelog (if available from API) */}
      {release && (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 mb-10">
          <div className="flex items-center justify-between flex-wrap gap-4 pb-6 border-b border-white/10">
            <div>
              <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Release Information</span>
              <h3 className="text-2xl font-bold text-white mt-0.5">NivaTV Version {release.version}</h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <CheckCircle className="w-3.5 h-3.5" /> Latest Stable Build
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-b border-white/10">
            <div>
              <span className="text-slate-400 text-xs block mb-1">Minimum OS</span>
              <span className="text-white font-semibold text-sm">Android {release.minimum_android_version || '5.0'}+</span>
            </div>
            <div>
              <span className="text-slate-400 text-xs block mb-1">Architecture</span>
              <span className="text-white font-semibold text-sm">ARM64 / ARM32</span>
            </div>
            <div>
              <span className="text-slate-400 text-xs block mb-1">Optimized Size</span>
              <span className="text-emerald-400 font-semibold text-sm">{release.file_size || '32.5 MB'}</span>
            </div>
            <div>
              <span className="text-slate-400 text-xs block mb-1">Release Date</span>
              <span className="text-white font-semibold text-sm">
                {release.created_at
                  ? new Date(release.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'Latest'}
              </span>
            </div>
          </div>

          {release.release_notes && release.release_notes.length > 0 && (
            <div className="pt-6">
              <h4 className="text-white font-semibold text-sm mb-3">What&apos;s New in this Version</h4>
              <ul className="grid sm:grid-cols-2 gap-2.5">
                {release.release_notes.map((note, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-slate-300 text-xs sm:text-sm">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {release.force_update && (
            <div className="mt-6 flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs sm:text-sm p-4 rounded-2xl">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              <span>Mandatory update: Older versions may experience stream disconnections due to upgraded API endpoints.</span>
            </div>
          )}
        </div>
      )}

      {/* Interactive FAQ Accordion */}
      <div className="mb-12">
        <DownloadFaqAccordion />
      </div>

      {/* 5-Step Installation Guide */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-10 mb-12">
        <div className="text-center max-w-xl mx-auto mb-10">
          <span className="text-indigo-400 text-xs font-bold uppercase tracking-wider">Quick Setup</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">5-Step Installation Guide</h2>
          <p className="text-slate-400 text-sm mt-2">
            Follow these easy steps to install NivaTV on your Android phone, tablet, or Smart TV.
          </p>
        </div>

        <div className="grid md:grid-cols-5 gap-4 relative">
          {INSTALL_STEPS.map((s, index) => (
            <div
              key={s.step}
              className="bg-slate-900/60 border border-white/5 rounded-2xl p-5 flex flex-col justify-between hover:border-indigo-500/30 transition-colors"
            >
              <div>
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-bold text-sm flex items-center justify-center mb-4 shadow-lg shadow-indigo-600/30">
                  {s.step}
                </div>
                <h3 className="text-white font-bold text-sm mb-1.5">{s.title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Buy License CTA Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-slate-950 border border-indigo-500/30 p-8 sm:p-10 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
            Ready to Unlock 500+ Live HD Channels?
          </h2>
          <p className="text-slate-300 text-sm sm:text-base mb-6">
            Get your instant license activation key with 24/7 high-speed streaming, zero ads, and multi-device support.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/pricing"
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base transition-all shadow-lg shadow-indigo-600/30 hover:scale-[1.02]"
            >
              View Pricing &amp; Buy License
            </Link>
            <Link
              href="/browse"
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-slate-200 font-semibold text-base transition-all border border-white/10"
            >
              Explore Channels
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
