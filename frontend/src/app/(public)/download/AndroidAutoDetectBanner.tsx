'use client';

import { useState, useSyncExternalStore } from 'react';
import { Smartphone, Monitor, Apple, X, Download, Globe, ArrowRight } from 'lucide-react';

type DeviceType = 'android-x86' | 'android' | 'ios' | 'desktop' | null;

interface AndroidAutoDetectBannerProps {
  appVersion?: string;
  standardDownloadUrl?: string;
  universalDownloadUrl?: string;
  x86_64DownloadUrl?: string;
  legacyDownloadUrl?: string;
}

const emptySubscribe = () => () => {};

function getClientDeviceType(): DeviceType {
  if (typeof window === 'undefined') return null;
  const ua = window.navigator.userAgent || '';
  const platform = window.navigator.platform || '';
  if (/Android/i.test(ua)) {
    return /(?:^|[^a-z0-9])(x86_64|x86|i686|gphone_x86|gphone64_x86|emulator)(?:$|[^a-z0-9])/i.test(
      `${ua} ${platform}`
    )
      ? 'android-x86'
      : 'android';
  }
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return 'ios';
  }
  return 'desktop';
}

export default function AndroidAutoDetectBanner({
  appVersion = '2.8.8',
  standardDownloadUrl = '/downloads/app-release.apk',
  universalDownloadUrl = '/downloads/app-universal-release.apk',
  x86_64DownloadUrl = '/downloads/app-x86_64-release.apk',
  legacyDownloadUrl = '/downloads/app-release-32bit.apk',
}: AndroidAutoDetectBannerProps) {
  const deviceType = useSyncExternalStore(
    emptySubscribe,
    getClientDeviceType,
    () => null
  );
  const [dismissed, setDismissed] = useState(false);

  if (!deviceType || dismissed) return null;

  if (deviceType === 'android' || deviceType === 'android-x86') {
    const isX86 = deviceType === 'android-x86';
    return (
      <div className="relative mb-8 bg-gradient-to-r from-emerald-500/15 via-brand-500/15 to-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg shadow-emerald-500/5">
        <div className="flex items-start sm:items-center gap-3.5 flex-1">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
            <Smartphone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                {isX86 ? 'Android x86_64 Detected (Emulator / Intel)' : 'Android Detected'}
              </span>
              <span className="text-[var(--color-ink)] font-bold text-sm sm:text-base">
                {isX86 ? 'Optimized x86_64 Package Ready' : 'Ready for Instant Install'}
              </span>
            </div>
            <p className="text-[var(--color-ink-muted)] text-xs sm:text-sm mt-0.5">
              {isX86 ? (
                <>
                  Your device requires the <strong className="text-emerald-600 dark:text-emerald-400">x86_64 APK</strong> or{' '}
                  <strong className="text-[var(--color-ink)]">Universal APK</strong> to prevent native translation crashes.
                </>
              ) : (
                <>
                  Recommended: <strong className="text-[var(--color-ink)]">Standard 64-bit APK</strong> for modern phones, or{' '}
                  <strong className="text-[var(--color-ink)]">Universal APK</strong> if you&apos;re unsure.
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
          {isX86 ? (
            <>
              <a
                href={x86_64DownloadUrl}
                download={`NivaTV_x86_64_v${appVersion}.apk`}
                className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/20 transition-all text-center"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Download x86_64 APK</span>
              </a>
              <a
                href={universalDownloadUrl}
                download={`NivaTV_universal_v${appVersion}.apk`}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-line)] hover:border-emerald-500/40 text-[var(--color-ink)] text-xs font-semibold transition-all text-center"
              >
                <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Universal</span>
              </a>
            </>
          ) : (
            <>
              <a
                href={standardDownloadUrl}
                download={`NivaTV_arm64_v${appVersion}.apk`}
                className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-brand-600/20 transition-all text-center"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Download APK (64-bit)</span>
              </a>
              <a
                href={universalDownloadUrl}
                download={`NivaTV_universal_v${appVersion}.apk`}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-line)] hover:border-brand-500/40 text-[var(--color-ink)] text-xs font-semibold transition-all text-center"
              >
                <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Universal</span>
              </a>
            </>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] p-1 rounded-lg hover:bg-[var(--color-surface-2)] transition-colors shrink-0"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (deviceType === 'ios') {
    return (
      <div className="relative mb-8 bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-2xl p-4 sm:p-5 flex items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-surface)] border border-[var(--color-line)] flex items-center justify-center shrink-0">
            <Apple className="w-5 h-5 text-[var(--color-ink)]" />
          </div>
          <div>
            <span className="inline-block px-2 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink)] text-xs font-semibold mb-1">
              Apple iOS Detected
            </span>
            <p className="text-[var(--color-ink-muted)] text-xs sm:text-sm">
              NivaTV APK runs on Android. You can download the APK file here to transfer to your Android TV or phone.
            </p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] p-1 rounded-lg hover:bg-[var(--color-surface)] transition-colors shrink-0"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative mb-8 bg-brand-500/10 border border-brand-500/20 rounded-2xl p-4 sm:p-5 flex items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shrink-0">
          <Monitor className="w-5 h-5 text-brand-500" />
        </div>
        <div>
          <span className="inline-block px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-600 dark:text-brand-400 text-xs font-semibold mb-1">
            Desktop Browser
          </span>
          <p className="text-[var(--color-ink-muted)] text-xs sm:text-sm">
            Download the APK directly to your computer or sideload it onto your Android Smart TV / FireStick.
          </p>
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] p-1 rounded-lg hover:bg-[var(--color-surface-2)] transition-colors shrink-0"
        aria-label="Dismiss banner"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

