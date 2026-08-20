'use client';

import { useState, useEffect } from 'react';
import { Smartphone, CheckCircle, Monitor, Apple, X } from 'lucide-react';

export default function AndroidAutoDetectBanner() {
  const [deviceType, setDeviceType] = useState<'android' | 'ios' | 'desktop' | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = window.navigator.userAgent || '';
    if (/Android/i.test(ua)) {
      setDeviceType('android');
    } else if (/iPhone|iPad|iPod/i.test(ua)) {
      setDeviceType('ios');
    } else {
      setDeviceType('desktop');
    }
  }, []);

  if (!deviceType || dismissed) return null;

  if (deviceType === 'android') {
    return (
      <div className="relative mb-8 bg-gradient-to-r from-emerald-500/15 via-indigo-500/15 to-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 flex items-start sm:items-center justify-between gap-4 shadow-lg shadow-emerald-950/30">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Android Detected
              </span>
              <span className="text-white font-bold text-sm sm:text-base">Ready for Instant Install</span>
            </div>
            <p className="text-slate-300 text-xs sm:text-sm mt-0.5">
              Your device is compatible with the <strong className="text-white">Standard 64-bit APK (Recommended)</strong>.
            </p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors shrink-0"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (deviceType === 'ios') {
    return (
      <div className="relative mb-8 bg-slate-900/60 border border-white/10 rounded-2xl p-4 sm:p-5 flex items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
            <Apple className="w-5 h-5 text-slate-300" />
          </div>
          <div>
            <span className="inline-block px-2 py-0.5 rounded-full bg-white/10 text-slate-300 text-xs font-semibold mb-1">
              Apple iOS Detected
            </span>
            <p className="text-slate-300 text-xs sm:text-sm">
              NivaTV APK runs on Android. You can download the APK file here to transfer to your Android TV or phone.
            </p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors shrink-0"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative mb-8 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 sm:p-5 flex items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
          <Monitor className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <span className="inline-block px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-1">
            Desktop Browser
          </span>
          <p className="text-slate-300 text-xs sm:text-sm">
            Download the APK directly to your computer or sideload it onto your Android Smart TV / FireStick.
          </p>
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors shrink-0"
        aria-label="Dismiss banner"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
