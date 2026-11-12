'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, CheckCircle2 } from 'lucide-react';

interface AutoDownloadTriggerProps {
  version: string;
  downloadUrl: string;
  universalDownloadUrl?: string;
  x86_64DownloadUrl?: string;
  legacyDownloadUrl?: string;
  isForceUpdate?: boolean;
}

function getDownloadFilename(url: string, version: string): string {
  if (url.includes('app-universal-release.apk')) return `NivaTV_universal_v${version}.apk`;
  if (url.includes('app-x86_64-release.apk')) return `NivaTV_x86_64_v${version}.apk`;
  if (url.includes('app-release-32bit.apk')) return `NivaTV_arm32_v${version}.apk`;
  if (url.includes('app-release.apk')) return `NivaTV_arm64_v${version}.apk`;
  const lastSegment = url.split('/').pop()?.split('?')[0];
  return lastSegment || `NivaTV_v${version}.apk`;
}

export default function AutoDownloadTrigger({
  version,
  downloadUrl,
  universalDownloadUrl,
  x86_64DownloadUrl,
  legacyDownloadUrl,
  isForceUpdate = false,
}: AutoDownloadTriggerProps) {
  const searchParams = useSearchParams();
  const [downloadStarted, setDownloadStarted] = useState(false);

  const archParam = searchParams.get('arch');
  const ua = typeof window !== 'undefined' ? window.navigator.userAgent || '' : '';
  const platform = typeof window !== 'undefined' ? window.navigator.platform || '' : '';
  const isX86Android =
    /Android/i.test(ua) &&
    /(?:^|[^a-z0-9])(x86_64|x86|i686|gphone_x86|gphone64_x86|emulator)(?:$|[^a-z0-9])/i.test(
      `${ua} ${platform}`
    );

  let resolvedUrl = downloadUrl;
  if (archParam === 'universal' && universalDownloadUrl) {
    resolvedUrl = universalDownloadUrl;
  } else if (archParam === 'x86_64' && x86_64DownloadUrl) {
    resolvedUrl = x86_64DownloadUrl;
  } else if (archParam === 'arm32' && legacyDownloadUrl) {
    resolvedUrl = legacyDownloadUrl;
  } else if (isX86Android) {
    resolvedUrl = x86_64DownloadUrl || universalDownloadUrl || downloadUrl;
  }

  useEffect(() => {
    // Only trigger on client
    if (typeof window === 'undefined') return;

    const forceParam = searchParams.get('force') === '1' || searchParams.get('auto') === '1';
    const isAndroid = /Android/i.test(ua);

    // Auto-trigger if explicit query param OR if force update is required on Android
    if (forceParam || (isForceUpdate && isAndroid)) {
      const timer = setTimeout(() => {
        initiateDownload(version, resolvedUrl);
        setDownloadStarted(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [version, resolvedUrl, searchParams, isForceUpdate, ua]);

  if (!downloadStarted) return null;

  return (
    <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-3 text-xs text-[var(--color-ink)]">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
        <span>
          <strong>Download started automatically!</strong> If not, tap the button to retry.
        </span>
      </div>
      <button
        onClick={() => initiateDownload(version, resolvedUrl)}
        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold text-[11px] shadow-sm transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Download Now</span>
      </button>
    </div>
  );
}

function initiateDownload(version: string, url: string) {
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', getDownloadFilename(url, version));
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
