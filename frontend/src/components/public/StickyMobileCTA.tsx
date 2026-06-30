'use client';
import Link from 'next/link';
import { Key, Download } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function StickyMobileCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`md:hidden fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      {/* Safe area backdrop */}
      <div className="bg-[#0f0f11]/96 backdrop-blur-xl border-t border-white/[0.08]">
        <div className="flex gap-3 px-4 pt-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <Link
            href="/pricing"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm transition-colors"
          >
            <Key className="w-4 h-4" /> Buy License
          </Link>
          <Link
            href="/download"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.08] border border-white/[0.1] text-white font-bold text-sm transition-colors"
          >
            <Download className="w-4 h-4" /> Download APK
          </Link>
        </div>
      </div>
    </div>
  );
}
