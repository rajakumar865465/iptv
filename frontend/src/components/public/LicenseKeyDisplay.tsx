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
    <div className="flex flex-col sm:flex-row items-center gap-3 bg-[var(--color-surface-2)] border border-brand-500/30 rounded-xl px-5 py-4">
      <span className="flex-1 font-mono text-base sm:text-lg font-bold text-brand-600 dark:text-brand-400 tracking-widest break-all">
        {showKey ? licenseKey : maskedKey}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => setShowKey(!showKey)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-ink)] border border-[var(--color-line)] shadow-sm cursor-pointer"
        >
          {showKey ? 'Hide' : 'Reveal'}
        </button>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer ${
            copied
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-600'
              : 'bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-ink)] border border-[var(--color-line)]'
          }`}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
