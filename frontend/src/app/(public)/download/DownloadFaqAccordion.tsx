'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function DownloadFaqAccordion() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-white/10 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/5 transition-colors"
        aria-expanded={open}
      >
        <div>
          <p className="text-white font-semibold">Not sure which version to download?</p>
          <p className="text-slate-400 text-sm mt-0.5">
            Tap to see which APK is right for your device
          </p>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-6 pb-6 border-t border-white/10 pt-5 space-y-6">
          {/* Simple rule */}
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
            <p className="text-indigo-300 font-semibold text-sm mb-1">✅ Quick Answer</p>
            <p className="text-slate-300 text-sm leading-relaxed">
              <strong className="text-white">If your phone was bought in 2017 or later</strong> — download the{' '}
              <span className="text-indigo-400 font-semibold">Standard (64-bit)</span> APK. It works on
              virtually all modern Android phones, tablets, and Android TV boxes.
            </p>
            <p className="text-slate-400 text-sm mt-2 leading-relaxed">
              Only switch to the <span className="text-amber-400 font-semibold">Legacy (32-bit)</span> APK
              if the Standard version fails to install on your device.
            </p>
          </div>

          {/* Comparison table */}
          <div>
            <p className="text-white font-semibold text-sm mb-3">Comparison</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-slate-400 font-medium pb-2 pr-4">Feature</th>
                    <th className="text-left text-indigo-400 font-semibold pb-2 pr-4">Standard (64-bit)</th>
                    <th className="text-left text-amber-400 font-semibold pb-2">Legacy (32-bit)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[
                    { feature: 'File Size', standard: '32.5 MB', legacy: '29.3 MB' },
                    { feature: 'Architecture', standard: 'ARM64-v8a', legacy: 'ARMeabi-v7a' },
                    { feature: 'Min Android', standard: 'Android 5.0+', legacy: 'Android 5.0+' },
                    { feature: 'Device Coverage', standard: '~95% of all Android devices', legacy: 'Older / budget devices' },
                    { feature: 'Best For', standard: 'Modern phones, tablets, Android TV', legacy: 'Pre-2017 budget phones' },
                    { feature: 'Performance', standard: '⚡ Faster (native 64-bit)', legacy: '✓ Compatible' },
                  ].map(row => (
                    <tr key={row.feature}>
                      <td className="py-2.5 pr-4 text-slate-400">{row.feature}</td>
                      <td className="py-2.5 pr-4 text-white">{row.standard}</td>
                      <td className="py-2.5 text-slate-300">{row.legacy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Common devices */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-indigo-400 font-semibold text-xs mb-2">✅ Standard (64-bit) works on</p>
              <ul className="space-y-1 text-slate-400 text-xs">
                <li>• Samsung Galaxy S / A / M series (2018+)</li>
                <li>• Xiaomi / Redmi (2018+)</li>
                <li>• OnePlus, Realme, OPPO, Vivo</li>
                <li>• Android TV boxes &amp; smart TVs</li>
                <li>• All 64-bit Android phones &amp; tablets</li>
              </ul>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-amber-400 font-semibold text-xs mb-2">📦 Legacy (32-bit) works on</p>
              <ul className="space-y-1 text-slate-400 text-xs">
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
