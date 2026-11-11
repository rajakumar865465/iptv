'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, CheckCircle2 } from 'lucide-react';

interface AutoDownloadTriggerProps {
  version: string;
  downloadUrl: string;
  isForceUpdate?: boolean;
}

export default function AutoDownloadTrigger({
  version,
  downloadUrl,
  isForceUpdate = false,
}: AutoDownloadTriggerProps) {
  const searchParams = useSearchParams();
  const [downloadStarted, setDownloadStarted] = useState(false);

  useEffect(() => {
    // Only trigger on client
    if (typeof window === 'undefined') return;

    const forceParam = searchParams.get('force') === '1' || searchParams.get('auto') === '1';
    const ua = window.navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);

    // Auto-trigger if explicit query param OR if force update is required on Android
    if (forceParam || (isForceUpdate && isAndroid)) {
      const timer = setTimeout(() => {
        initiateDownload(version, downloadUrl);
        setDownloadStarted(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [version, downloadUrl, searchParams, isForceUpdate]);

  if (!downloadStarted) return null;

  return (
    <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-3 text-xs text-[var(--color-ink)] animate-in fade-in slide-in-from-top-1 duration-300">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
        <span>
          <strong>Download started automatically!</strong> If not, tap the button to retry.
        </span>
      </div>
      <button
        onClick={() => initiateDownload(version, downloadUrl)}
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
  link.setAttribute('download', `NivaTV_arm64_v${version}.apk`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
