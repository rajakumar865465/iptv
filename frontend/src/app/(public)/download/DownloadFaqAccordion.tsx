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
              <span className="text-brand-600 dark:text-brand-400 font-semibold">Standard (64-bit)</span> APK for the smallest download.
            </p>
            <p className="text-[var(--color-ink-muted)] text-sm mt-2 leading-relaxed">
              Not sure what CPU your phone, TV box, or emulator uses? Pick the{' '}
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Universal (All-in-One)</span> APK — it bundles
              ARM64, ARM32, and x86_64 together so it installs everywhere. Use{' '}
              <span className="text-amber-600 dark:text-amber-400 font-semibold">Legacy (32-bit)</span> for pre-2017 phones or{' '}
              <span className="text-[var(--color-ink)] font-semibold">x86_64</span> for lightweight Android emulators and Chromebooks.
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
                    <th className="text-left text-emerald-600 dark:text-emerald-400 font-semibold pb-2 pr-4">Universal (All)</th>
                    <th className="text-left text-amber-600 dark:text-amber-400 font-semibold pb-2 pr-4">Legacy (32-bit)</th>
                    <th className="text-left text-[var(--color-ink)] font-semibold pb-2">x86_64</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line)]">
                  {[
                    { feature: 'Architecture', standard: 'ARM64-v8a', universal: 'ARM64 + ARM32 + x86_64', legacy: 'ARMeabi-v7a', x86: 'x86_64' },
                    { feature: 'Min Android', standard: 'Android 5.0+', universal: 'Android 5.0+', legacy: 'Android 5.0+', x86: 'Android 5.0+' },
                    { feature: 'Device Coverage', standard: '~95% of phones', universal: '100% of Android devices', legacy: 'Older / budget devices', x86: 'Emulators & Intel PCs' },
                    { feature: 'Best For', standard: 'Modern phones, TVs', universal: 'Any device (zero guesswork)', legacy: 'Pre-2017 budget phones', x86: 'Android Studio / Chromebook' },
                    { feature: 'Download Type', standard: 'Smallest 64-bit', universal: 'All-in-one bundle', legacy: 'Lightweight 32-bit', x86: 'Dedicated x86_64' },
                  ].map(row => (
                    <tr key={row.feature}>
                      <td className="py-2.5 pr-4 text-[var(--color-ink-muted)]">{row.feature}</td>
                      <td className="py-2.5 pr-4 text-[var(--color-ink)]">{row.standard}</td>
                      <td className="py-2.5 pr-4 text-emerald-600 dark:text-emerald-400 font-medium">{row.universal}</td>
                      <td className="py-2.5 pr-4 text-[var(--color-ink-muted)]">{row.legacy}</td>
                      <td className="py-2.5 text-[var(--color-ink-muted)]">{row.x86}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Common devices */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-xl p-3">
              <p className="text-brand-600 dark:text-brand-400 font-semibold text-xs mb-2">✅ Standard (64-bit)</p>
              <ul className="space-y-1 text-[var(--color-ink-muted)] text-xs">
                <li>• Samsung Galaxy (2018+)</li>
                <li>• Xiaomi, OnePlus, Realme, OPPO, Vivo</li>
                <li>• Android TV &amp; Fire TV Stick</li>
              </ul>
            </div>
            <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-xl p-3">
              <p className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs mb-2">🌐 Universal (All Devices)</p>
              <ul className="space-y-1 text-[var(--color-ink-muted)] text-xs">
                <li>• Every Android phone &amp; tablet</li>
                <li>• Fixes &quot;App not installed&quot; ABI errors</li>
                <li>• Safe default for sharing</li>
              </ul>
            </div>
            <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-xl p-3">
              <p className="text-amber-600 dark:text-amber-400 font-semibold text-xs mb-2">📦 Legacy (32-bit)</p>
              <ul className="space-y-1 text-[var(--color-ink-muted)] text-xs">
                <li>• Budget phones (2013–2016)</li>
                <li>• 32-bit only Fire TV / TV boxes</li>
                <li>• Minimal storage footprint</li>
              </ul>
            </div>
            <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-xl p-3">
              <p className="text-[var(--color-ink)] font-semibold text-xs mb-2">💻 x86_64 Build</p>
              <ul className="space-y-1 text-[var(--color-ink-muted)] text-xs">
                <li>• Android Studio Emulator</li>
                <li>• Chromebooks &amp; WSA</li>
                <li>• Intel / AMD Android tablets</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

