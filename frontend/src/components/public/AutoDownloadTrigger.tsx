'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';

interface AutoDownloadTriggerProps {
  version: string;
  downloadUrl: string;
}

export default function AutoDownloadTrigger({ version, downloadUrl }: AutoDownloadTriggerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Allow explicit trigger via URL param (e.g. ?force=1)
    if (searchParams.get('force') === '1') {
      initiateDownload(version, downloadUrl);
      return;
    }

    // Client-side version check against backend: only auto-download on the official domain
    // so search engines and local previews don't get redirected.
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (!origin.startsWith('https://nivatv.luxomall.in')) {
      return;
    }

    const controller = new AbortController();
    fetch('https://nivatv.luxomall.in/api/app/version-check', {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data: { data?: { update_required?: boolean; latest_version?: string; current_version?: string } }) => {
        if (!data?.data) return;
        const { update_required, latest_version } = data.data;
        if (update_required || (latest_version && latest_version !== version)) {
          initiateDownload(latest_version || version, downloadUrl);
        }
      })
      .catch(() => {
        // Backend unreachable — don't block the user, just show the page normally
      });

    return () => controller.abort();
  }, [version, downloadUrl, searchParams]);

  return null;
}

function initiateDownload(version: string, url: string) {
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `NivaTV_arm64_v${version}.apk`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
