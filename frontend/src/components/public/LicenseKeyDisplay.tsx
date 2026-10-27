'use client';
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function LicenseKeyDisplay({ licenseKey }: { licenseKey: string }) {
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(licenseKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const maskedKey = licenseKey
    ? licenseKey.slice(0, 4) + ' •••• •••• •••• ' + licenseKey.slice(-4)
    : '';

  return (
    <div className="flex items-center justify-between gap-2.5 sm:gap-3 bg-[var(--color-surface-2)] border border-brand-500/30 rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-sm">
      <span className="font-mono text-xs sm:text-sm md:text-base font-bold text-brand-600 dark:text-brand-400 tracking-wider select-all truncate">
        {showKey ? licenseKey : maskedKey}
      </span>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-ink)] border border-[var(--color-line)] shadow-sm cursor-pointer whitespace-nowrap"
        >
          {showKey ? 'Hide' : 'Reveal'}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer whitespace-nowrap ${
            copied
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-600'
              : 'bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-ink)] border border-[var(--color-line)]'
          }`}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
