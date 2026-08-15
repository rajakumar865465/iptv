import Link from 'next/link';
import { Download, Smartphone, CheckCircle, AlertCircle, Package, Calendar, HardDrive } from 'lucide-react';
import { getAppDownload } from '@/lib/publicApi';
import type { Metadata } from 'next';
import PageTracker from '@/components/public/PageTracker';

export const metadata: Metadata = {
  title: 'Download APK — NivaTV',
  description: 'Download the latest NivaTV APK for Android. Free to download, license required to stream.',
};
export const dynamic = 'force-dynamic';

const INSTALL_STEPS = [
  { step: 1, text: 'Download the APK file from the button above.' },
  { step: 2, text: 'On your Android device, go to Settings → Security → Enable "Install from Unknown Sources".' },
  { step: 3, text: 'Open the downloaded APK file and tap Install.' },
  { step: 4, text: 'Open the app, create an account or log in.' },
  { step: 5, text: 'Go to License Activation and paste your license key.' },
  { step: 6, text: 'Enjoy live TV!' },
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
  const downloadUrl = release ? toDirectDownloadUrl(release.apk_url) : '/downloads/app-release.apk';


  return (
    <div className="pt-24 pb-20 px-4">
      <PageTracker page="download" />
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 flex items-center justify-center mx-auto mb-5">
            <Smartphone className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-3">Download NivaTV</h1>
          <p className="text-slate-400">Free Android app. License key required to stream channels.</p>
        </div>

        {/* Release card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-10">
          {release ? (
            <>
              <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div>
                  <h2 className="text-white font-bold text-xl">NivaTV v{release.version}</h2>
                  <p className="text-slate-400 text-sm">Latest stable release</p>
                </div>
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium px-3 py-1.5 rounded-full">
                  <CheckCircle className="w-4 h-4" /> Latest Version
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                {[
                  { icon: Package, label: 'Version', value: release.version },
                  { icon: HardDrive, label: 'File Size', value: release.file_size || 'N/A' },
                  { icon: Smartphone, label: 'Android', value: `${release.minimum_android_version}+` },
                  { icon: Calendar, label: 'Released', value: new Date(release.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
                ].map(info => {
                  const Icon = info.icon;
                  return (
                    <div key={info.label} className="bg-white/5 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                        <Icon className="w-3.5 h-3.5" /> {info.label}
                      </div>
                      <div className="text-white font-semibold text-sm">{info.value}</div>
                    </div>
                  );
                })}
              </div>

              {release.release_notes && release.release_notes.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-white font-semibold text-sm mb-3">What&apos;s New</h3>
                  <ul className="space-y-2">
                    {release.release_notes.map((note, i) => (
                      <li key={i} className="flex items-start gap-2 text-slate-400 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /> {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {release.force_update && (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm px-4 py-2.5 rounded-xl mb-5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Update required — older versions may not stream correctly.
                </div>
              )}

              <a
                href={downloadUrl}
                download={downloadUrl.startsWith('http') ? undefined : 'app-release.apk'}
                target={downloadUrl.startsWith('http') ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg transition-colors shadow-lg shadow-indigo-500/20"
              >
                <Download className="w-6 h-6" /> Download APK (v{release.version})
              </a>
            </>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400">No release available yet. Check back soon.</p>
            </div>
          )}
        </div>

        {/* Installation guide */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
          <h2 className="text-white font-bold text-lg mb-5">Installation Guide</h2>
          <ol className="space-y-4">
            {INSTALL_STEPS.map(s => (
              <li key={s.step} className="flex items-start gap-4">
                <span className="w-7 h-7 shrink-0 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center">
                  {s.step}
                </span>
                <p className="text-slate-300 text-sm leading-relaxed pt-0.5">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* No license yet CTA */}
        <div className="text-center bg-gradient-to-r from-indigo-600/15 to-violet-600/10 border border-indigo-500/20 rounded-2xl p-6">
          <p className="text-white font-semibold mb-2">Don&apos;t have a license key yet?</p>
          <p className="text-slate-400 text-sm mb-4">Purchase a plan to get your license key and unlock all channels.</p>
          <Link href="/pricing" className="inline-block px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors">
            View Plans & Buy License
          </Link>
        </div>
      </div>
    </div>
  );
}
