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
      <div className="bg-[var(--color-surface)]/95 backdrop-blur-xl border-t border-[var(--color-line)] shadow-card-lg">
        <div className="flex gap-3 px-4 pt-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <Link
            href="/pricing"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white font-bold text-sm transition-colors shadow-lg shadow-brand-600/20"
          >
            <Key className="w-4 h-4" /> Buy License
          </Link>
          <Link
            href="/download"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-line)] text-[var(--color-ink)] font-bold text-sm transition-colors"
          >
            <Download className="w-4 h-4" /> Download APK
          </Link>
        </div>
      </div>
    </div>
  );
}
