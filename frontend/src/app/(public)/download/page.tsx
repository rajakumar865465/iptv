import fs from 'node:fs';
import path from 'node:path';
import { Suspense } from 'react';
import Link from 'next/link';
import {
  Download,
  Smartphone,
  CheckCircle,
  AlertCircle,
  Package,
  Cpu,
  Zap,
  ShieldCheck,
  Tv,
  ArrowRight,
  Sparkles,
  Laptop,
  Globe,
} from 'lucide-react';
import { getAppDownload, getWebsiteSettings } from '@/lib/publicApi';
import type { Metadata } from 'next';
import AutoDownloadTrigger from '@/components/public/AutoDownloadTrigger';
import PageTracker from '@/components/public/PageTracker';
import MobileBottomSpacer from '@/components/public/MobileBottomSpacer';
import DownloadFaqAccordion from './DownloadFaqAccordion';
import AndroidAutoDetectBanner from './AndroidAutoDetectBanner';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
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
    text: 'Pick Standard 64-bit, Universal (all devices), Legacy 32-bit, or x86_64 above and start the download.',
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

function getPublicApkSize(filename: string, fallback: string): string {
  try {
    const filePath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', 'downloads', filename);
    const stat = fs.statSync(filePath);
    if (stat.isFile() && stat.size > 0) {
      const mb = stat.size / (1024 * 1024);
      return `${mb.toFixed(1)} MB`;
    }
  } catch {
    // Use fallback if APK is served via backend rewrite instead of local public/downloads
  }
  return fallback;
}

export default async function DownloadPage() {
  const [release, settings] = await Promise.all([
    getAppDownload().catch(() => null),
    getWebsiteSettings().catch(() => null),
  ]);
  const standardDownloadUrl = '/downloads/app-release.apk';
  const universalDownloadUrl = '/downloads/app-universal-release.apk';
  const legacyDownloadUrl = '/downloads/app-release-32bit.apk';
  const x86_64DownloadUrl = '/downloads/app-x86_64-release.apk';
  const appVersion = release?.version || settings?.latest_app_version || '2.8.7';
  const standardFileSize = getPublicApkSize('app-release.apk', release?.file_size || '33.2 MB');
  const universalFileSize = getPublicApkSize('app-universal-release.apk', '95.2 MB');
  const legacyFileSize = getPublicApkSize('app-release-32bit.apk', '30.0 MB');
  const x86_64FileSize = getPublicApkSize('app-x86_64-release.apk', '38.0 MB');
  const isForceUpdate = Boolean(release?.force_update || settings?.force_update === 'true');
  const updateNoticeMessage =
    settings?.banner_message ||
    settings?.announcement_message ||
    `Older versions below v${appVersion} must update to continue streaming seamlessly.`;

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
    fileSize: standardFileSize.replace(/\s+/g, ''),
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
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 text-xs sm:text-sm font-semibold mb-4">
          <Sparkles className="w-4 h-4 text-brand-500" />
          <span>Official Android Release v{appVersion}</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-[var(--color-ink)] tracking-tight mb-4 font-display">
          Download NivaTV for Android
        </h1>
        <p className="text-[var(--color-ink-muted)] max-w-2xl mx-auto text-base sm:text-lg">
          Enjoy 500+ Live Indian HD Channels, Sports, Movies, and News. Select the package tailored for your hardware.
        </p>
      </div>

      {/* Latest Release Notice Banner */}
      {(isForceUpdate || settings?.banner_message || settings?.announcement_message) && (
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-amber-500/15 via-brand-500/10 to-emerald-500/10 border border-amber-500/35 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-600 text-white text-[11px] font-bold uppercase tracking-wider">
                  v{appVersion} Latest Notice
                </span>
                {isForceUpdate && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-bold uppercase tracking-wider">
                    Mandatory Update
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-[var(--color-ink)] font-medium leading-relaxed">
                {updateNoticeMessage}
              </p>
            </div>
          </div>
          <Suspense fallback={null}>
            <AutoDownloadTrigger
              version={appVersion}
              downloadUrl={standardDownloadUrl}
              universalDownloadUrl={universalDownloadUrl}
              x86_64DownloadUrl={x86_64DownloadUrl}
              legacyDownloadUrl={legacyDownloadUrl}
              isForceUpdate={isForceUpdate}
            />
          </Suspense>
          <div className="shrink-0 flex flex-wrap items-center gap-2">
            <a
              href={standardDownloadUrl}
              download={`NivaTV_arm64_v${appVersion}.apk`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-brand-600/20 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Update to v{appVersion}</span>
            </a>
            <a
              href={universalDownloadUrl}
              download={`NivaTV_universal_v${appVersion}.apk`}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-line)] hover:border-brand-500/40 text-[var(--color-ink)] text-xs sm:text-sm font-semibold transition-all"
            >
              <Globe className="w-4 h-4 text-emerald-500" />
              <span>Universal APK</span>
            </a>
          </div>
        </div>
      )}

      {/* Smart Device Auto-Detector Banner */}
      <AndroidAutoDetectBanner />

      {/* Primary Download Cards Grid: Standard 64-bit & Universal */}
      <div className="grid md:grid-cols-2 gap-6 lg:gap-8 mb-6">
        {/* Card 1: Standard (64-bit) - Recommended */}
        <div className="relative rounded-3xl bg-[var(--color-surface)] border-2 border-brand-500 p-6 sm:p-8 flex flex-col justify-between shadow-2xl shadow-brand-500/10 overflow-hidden">
          {/* Recommended Badge */}
          <div className="absolute top-0 right-0">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-bl-2xl bg-gradient-to-r from-brand-600 to-brand-500 text-white text-xs font-bold uppercase tracking-wider shadow-md">
              <CheckCircle className="w-3.5 h-3.5" /> Recommended
            </span>
          </div>

          <div>
            {/* Icon & Title */}
            <div className="flex items-center gap-4 mb-4 mt-1">
              <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shrink-0">
                <Smartphone className="w-7 h-7 text-brand-500" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[var(--color-ink)]">Standard (64-bit)</h2>
                <p className="text-[var(--color-ink-muted)] text-xs sm:text-sm font-medium">
                  Optimized for modern Android devices
                </p>
              </div>
            </div>

            {/* Spec Badges Row */}
            <div className="grid grid-cols-3 gap-2.5 my-5">
              <div className="bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-xl p-2.5 text-center">
                <span className="text-[var(--color-ink-muted)] text-[11px] block font-medium">OS Support</span>
                <span className="text-[var(--color-ink)] font-bold text-xs sm:text-sm">Android 5.0+</span>
              </div>
              <div className="bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-xl p-2.5 text-center">
                <span className="text-[var(--color-ink-muted)] text-[11px] block font-medium">File Size</span>
                <span className="text-emerald-500 dark:text-emerald-400 font-bold text-xs sm:text-sm">{standardFileSize}</span>
              </div>
              <div className="bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-xl p-2.5 text-center">
                <span className="text-[var(--color-ink-muted)] text-[11px] block font-medium">Arch</span>
                <span className="text-[var(--color-ink)] font-bold text-xs sm:text-sm">ARM64-v8a</span>
              </div>
            </div>

            {/* Device Coverage Indicator */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 mb-5 flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0" />
              <div className="text-xs text-[var(--color-ink-muted)]">
                <strong className="text-emerald-600 dark:text-emerald-400">Compatible with ~95% of phones</strong>: Samsung, Xiaomi, OnePlus,
                Realme, Vivo, OPPO, Android TV, and Fire TV Stick.
              </div>
            </div>

            {/* Feature Highlights */}
            <ul className="space-y-2 mb-6 text-xs sm:text-sm text-[var(--color-ink-muted)]">
              <li className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
                <span>Native 64-bit hardware acceleration &amp; 0-stutter playback</span>
              </li>
              <li className="flex items-center gap-2">
                <Tv className="w-4 h-4 text-brand-500 shrink-0" />
                <span>Full support for Smart TVs, TV boxes &amp; Tablets</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                <span>Compact split build for the fastest download</span>
              </li>
            </ul>
          </div>

          <div>
            <a
              href={standardDownloadUrl}
              download={`NivaTV_arm64_v${appVersion}.apk`}
              className="group flex items-center justify-center gap-2.5 w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-brand-600 via-brand-500 to-brand-600 hover:from-brand-500 hover:to-brand-600 text-white font-bold text-base sm:text-lg transition-all shadow-xl shadow-brand-600/20 hover:scale-[1.02] active:scale-[0.99]"
            >
              <Download className="w-5 h-5 transition-transform group-hover:-translate-y-0.5" />
              <span>Download APK (64-bit)</span>
              <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
            </a>
            <p className="text-center text-[11px] text-[var(--color-ink-muted)] mt-2.5">
              Direct official download • Virus-free &amp; verified
            </p>
          </div>
        </div>

        {/* Card 2: Universal APK (All Devices) */}
        <div className="relative rounded-3xl bg-[var(--color-surface)] border border-emerald-500/40 p-6 sm:p-8 flex flex-col justify-between shadow-xl overflow-hidden hover:border-emerald-500/70 transition-colors">
          <div className="absolute top-0 right-0">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-bl-2xl bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider shadow-md">
              <Globe className="w-3.5 h-3.5" /> All Devices
            </span>
          </div>

          <div>
            {/* Icon & Title */}
            <div className="flex items-center gap-4 mb-4 mt-1">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Package className="w-7 h-7 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[var(--color-ink)]">Universal APK</h2>
                <p className="text-[var(--color-ink-muted)] text-xs sm:text-sm font-medium">
                  Works on any Android phone, TV, or emulator
                </p>
              </div>
            </div>

            {/* Spec Badges Row */}
            <div className="grid grid-cols-3 gap-2.5 my-5">
              <div className="bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-xl p-2.5 text-center">
                <span className="text-[var(--color-ink-muted)] text-[11px] block font-medium">OS Support</span>
                <span className="text-[var(--color-ink)] font-bold text-xs sm:text-sm">Android 5.0+</span>
              </div>
              <div className="bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-xl p-2.5 text-center">
                <span className="text-[var(--color-ink-muted)] text-[11px] block font-medium">File Size</span>
                <span className="text-emerald-500 dark:text-emerald-400 font-bold text-xs sm:text-sm">{universalFileSize}</span>
              </div>
              <div className="bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-xl p-2.5 text-center">
                <span className="text-[var(--color-ink-muted)] text-[11px] block font-medium">Arch</span>
                <span className="text-[var(--color-ink)] font-bold text-xs sm:text-sm">Universal</span>
              </div>
            </div>

            {/* Device Coverage Indicator */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 mb-5 flex items-center gap-2.5">
              <CheckCircle className="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0" />
              <div className="text-xs text-[var(--color-ink-muted)]">
                <strong className="text-emerald-600 dark:text-emerald-400">100% Architecture Coverage</strong>: Bundles ARM64, ARM32,
                and x86_64 in one package — no &quot;App not installed&quot; ABI mismatch.
              </div>
            </div>

            {/* Feature Highlights */}
            <ul className="space-y-2 mb-6 text-xs sm:text-sm text-[var(--color-ink-muted)]">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                <span>Best choice if you aren&apos;t sure which CPU your device runs</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                <span>Works seamlessly on phones, TV boxes, FireStick &amp; emulators</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                <span>Safe single-file installer to share across different devices</span>
              </li>
            </ul>
          </div>

          <div>
            <a
              href={universalDownloadUrl}
              download={`NivaTV_universal_v${appVersion}.apk`}
              className="group flex items-center justify-center gap-2.5 w-full py-4 px-6 rounded-2xl bg-[var(--color-surface-2)] border border-emerald-500/40 hover:bg-emerald-600 hover:border-emerald-600 hover:text-white text-[var(--color-ink)] font-bold text-base sm:text-lg transition-all hover:scale-[1.02] active:scale-[0.99]"
            >
              <Download className="w-5 h-5 text-emerald-500 group-hover:text-white transition-colors" />
              <span>Download Universal APK</span>
              <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
            </a>
            <p className="text-center text-[11px] text-[var(--color-ink-muted)] mt-2.5">
              ARM64 + ARM32 + x86_64 • Guaranteed compatibility
            </p>
          </div>
        </div>
      </div>

      {/* Architecture-Specific Builds Grid: Legacy (32-bit) & x86_64 */}
      <div className="grid md:grid-cols-2 gap-6 mb-12">
        {/* Card 3: Legacy (32-bit) */}
        <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-line)] p-5 sm:p-6 flex flex-col justify-between hover:border-brand-500/30 transition-colors">
          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-line)] flex items-center justify-center shrink-0">
                  <Cpu className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--color-ink)]">Legacy (32-bit)</h3>
                  <p className="text-xs text-[var(--color-ink-muted)]">ARMeabi-v7a • {legacyFileSize}</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[11px] font-semibold">
                Pre-2017 Phones
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[var(--color-ink-muted)] leading-relaxed mb-4">
              Lightweight 32-bit build for older Android phones (2013–2016) or 32-bit TV sticks without 64-bit CPU support.
            </p>
          </div>
          <a
            href={legacyDownloadUrl}
            download={`NivaTV_arm32_v${appVersion}.apk`}
            className="group flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-line)] hover:border-brand-500/40 text-[var(--color-ink)] font-bold text-sm transition-all"
          >
            <Download className="w-4 h-4 text-[var(--color-ink-muted)]" />
            <span>Download APK (32-bit)</span>
            <ArrowRight className="w-4 h-4 opacity-50 group-hover:translate-x-1 transition-transform" />
          </a>
        </div>

        {/* Card 4: x86_64 (Emulator / Intel Tablet / Chromebook) */}
        <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-line)] p-5 sm:p-6 flex flex-col justify-between hover:border-brand-500/30 transition-colors">
          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-line)] flex items-center justify-center shrink-0">
                  <Laptop className="w-5 h-5 text-brand-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--color-ink)]">x86_64 Build</h3>
                  <p className="text-xs text-[var(--color-ink-muted)]">x86_64 • {x86_64FileSize}</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 text-[11px] font-semibold">
                Emulators &amp; Intel
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[var(--color-ink-muted)] leading-relaxed mb-4">
              Dedicated 64-bit x86 APK for Android emulators, Chromebooks, Windows Subsystem for Android, and Intel tablets.
            </p>
          </div>
          <a
            href={x86_64DownloadUrl}
            download={`NivaTV_x86_64_v${appVersion}.apk`}
            className="group flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-line)] hover:border-brand-500/40 text-[var(--color-ink)] font-bold text-sm transition-all"
          >
            <Download className="w-4 h-4 text-[var(--color-ink-muted)]" />
            <span>Download APK (x86_64)</span>
            <ArrowRight className="w-4 h-4 opacity-50 group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
      </div>

      {/* Release Details & Changelog (if available from API) */}
      {release && (
        <div className="bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-3xl p-6 sm:p-8 mb-10">
          <div className="flex items-center justify-between flex-wrap gap-4 pb-6 border-b border-[var(--color-line)]">
            <div>
              <span className="text-[var(--color-ink-muted)] text-xs uppercase tracking-wider font-semibold">Release Information</span>
              <h3 className="text-2xl font-bold text-[var(--color-ink)] mt-0.5">NivaTV Version {release.version}</h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                <CheckCircle className="w-3.5 h-3.5" /> Latest Stable Build
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-b border-[var(--color-line)]">
            <div>
              <span className="text-[var(--color-ink-muted)] text-xs block mb-1">Minimum OS</span>
              <span className="text-[var(--color-ink)] font-semibold text-sm">Android {release.minimum_android_version || '5.0'}+</span>
            </div>
            <div>
              <span className="text-[var(--color-ink-muted)] text-xs block mb-1">Architecture</span>
              <span className="text-[var(--color-ink)] font-semibold text-sm">Universal, ARM64, ARM32 &amp; x86_64</span>
            </div>
            <div>
              <span className="text-[var(--color-ink-muted)] text-xs block mb-1">Optimized Size</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm">{standardFileSize}</span>
            </div>
            <div>
              <span className="text-[var(--color-ink-muted)] text-xs block mb-1">Release Date</span>
              <span className="text-[var(--color-ink)] font-semibold text-sm">
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
              <h4 className="text-[var(--color-ink)] font-semibold text-sm mb-3">What&apos;s New in this Version</h4>
              <ul className="grid sm:grid-cols-2 gap-2.5">
                {release.release_notes.map((note, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[var(--color-ink-muted)] text-xs sm:text-sm">
                    <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {release.force_update && (
            <div className="mt-6 flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs sm:text-sm p-4 rounded-2xl">
              <AlertCircle className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0" />
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
      <div className="bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-3xl p-6 sm:p-10 mb-12">
        <div className="text-center max-w-xl mx-auto mb-10">
          <span className="text-brand-500 text-xs font-bold uppercase tracking-wider">Quick Setup</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-ink)] mt-1">5-Step Installation Guide</h2>
          <p className="text-[var(--color-ink-muted)] text-sm mt-2">
            Follow these easy steps to install NivaTV on your Android phone, tablet, or Smart TV.
          </p>
        </div>

        <div className="grid md:grid-cols-5 gap-4 relative">
          {INSTALL_STEPS.map((s) => (
            <div
              key={s.step}
              className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl p-5 flex flex-col justify-between hover:border-brand-500/30 transition-colors"
            >
              <div>
                <div className="w-9 h-9 rounded-xl bg-brand-600 text-white font-bold text-sm flex items-center justify-center mb-4 shadow-lg shadow-brand-600/30">
                  {s.step}
                </div>
                <h3 className="text-[var(--color-ink)] font-bold text-sm mb-1.5">{s.title}</h3>
                <p className="text-[var(--color-ink-muted)] text-xs leading-relaxed">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Buy License CTA Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-600/15 to-transparent border border-brand-500/20 bg-[var(--color-surface)] p-8 sm:p-10 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-ink)] mb-3">
            Ready to Unlock 500+ Live HD Channels?
          </h2>
          <p className="text-[var(--color-ink-muted)] text-sm sm:text-base mb-6">
            Get your instant license activation key with 24/7 high-speed streaming, zero ads, and multi-device support.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/pricing"
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-base transition-all shadow-lg shadow-brand-600/30 hover:scale-[1.02]"
            >
              View Pricing &amp; Buy License
            </Link>
            <Link
              href="/browse"
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-line)] hover:bg-[var(--color-surface)] text-[var(--color-ink)] font-semibold text-base transition-all"
            >
              Explore Channels
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom safe-area spacer for the mobile floating CTA bar */}
      <MobileBottomSpacer />
    </div>
  );
}

