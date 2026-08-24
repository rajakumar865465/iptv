'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function DownloadFaqAccordion() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-[var(--color-line)] bg-[var(--color-surface-2)] rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[var(--color-surface)] transition-colors"
        aria-expanded={open}
      >
        <div>
          <p className="text-[var(--color-ink)] font-semibold">Not sure which version to download?</p>
          <p className="text-[var(--color-ink-muted)] text-sm mt-0.5">
            Tap to see which APK is right for your device
          </p>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-[var(--color-ink-muted)] shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-6 pb-6 border-t border-[var(--color-line)] pt-5 space-y-6">
          {/* Simple rule */}
          <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-4">
            <p className="text-brand-600 dark:text-brand-400 font-semibold text-sm mb-1">✅ Quick Answer</p>
            <p className="text-[var(--color-ink-muted)] text-sm leading-relaxed">
              <strong className="text-[var(--color-ink)]">If your phone was bought in 2017 or later</strong> — download the{' '}
              <span className="text-brand-600 dark:text-brand-400 font-semibold">Standard (64-bit)</span> APK. It works on
              virtually all modern Android phones, tablets, and Android TV boxes.
            </p>
            <p className="text-[var(--color-ink-muted)] text-sm mt-2 leading-relaxed">
              Only switch to the <span className="text-amber-600 dark:text-amber-400 font-semibold">Legacy (32-bit)</span> APK
              if the Standard version fails to install on your device.
            </p>
          </div>

          {/* Comparison table */}
          <div>
            <p className="text-[var(--color-ink)] font-semibold text-sm mb-3">Comparison</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-line)]">
                    <th className="text-left text-[var(--color-ink-muted)] font-medium pb-2 pr-4">Feature</th>
                    <th className="text-left text-brand-600 dark:text-brand-400 font-semibold pb-2 pr-4">Standard (64-bit)</th>
                    <th className="text-left text-amber-600 dark:text-amber-400 font-semibold pb-2">Legacy (32-bit)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line)]">
                  {[
                    { feature: 'File Size', standard: '32.5 MB', legacy: '29.3 MB' },
                    { feature: 'Architecture', standard: 'ARM64-v8a', legacy: 'ARMeabi-v7a' },
                    { feature: 'Min Android', standard: 'Android 5.0+', legacy: 'Android 5.0+' },
                    { feature: 'Device Coverage', standard: '~95% of all Android devices', legacy: 'Older / budget devices' },
                    { feature: 'Best For', standard: 'Modern phones, tablets, Android TV', legacy: 'Pre-2017 budget phones' },
                    { feature: 'Performance', standard: '⚡ Faster (native 64-bit)', legacy: '✓ Compatible' },
                  ].map(row => (
                    <tr key={row.feature}>
                      <td className="py-2.5 pr-4 text-[var(--color-ink-muted)]">{row.feature}</td>
                      <td className="py-2.5 pr-4 text-[var(--color-ink)]">{row.standard}</td>
                      <td className="py-2.5 text-[var(--color-ink-muted)]">{row.legacy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Common devices */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-xl p-3">
              <p className="text-brand-600 dark:text-brand-400 font-semibold text-xs mb-2">✅ Standard (64-bit) works on</p>
              <ul className="space-y-1 text-[var(--color-ink-muted)] text-xs">
                <li>• Samsung Galaxy S / A / M series (2018+)</li>
                <li>• Xiaomi / Redmi (2018+)</li>
                <li>• OnePlus, Realme, OPPO, Vivo</li>
                <li>• Android TV boxes &amp; smart TVs</li>
                <li>• All 64-bit Android phones &amp; tablets</li>
              </ul>
            </div>
            <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-xl p-3">
              <p className="text-amber-600 dark:text-amber-400 font-semibold text-xs mb-2">📦 Legacy (32-bit) works on</p>
              <ul className="space-y-1 text-[var(--color-ink-muted)] text-xs">
                <li>• Very old budget Android phones</li>
                <li>• Devices from 2013–2016</li>
                <li>• Any device where Standard fails to install</li>
                <li>• 32-bit only Android hardware</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

