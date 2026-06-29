import Link from 'next/link';
import { Tv } from 'lucide-react';

export default function PublicFooter() {
  return (
    <footer className="bg-[#080808] border-t border-white/[0.07]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-6">

        {/* Main grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10">

          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4 w-fit">
              <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
                <Tv className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-white text-lg">IPTV<span className="text-red-500">Live</span></span>
            </Link>
            <p className="text-slate-500 text-sm leading-relaxed mb-4">
              Premium IPTV app for Indian &amp; regional channels. Watch live TV anytime on your Android device.
            </p>
            <Link
              href="/support"
              className="inline-flex items-center gap-2 text-xs text-green-400 hover:text-green-300 font-medium transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-green-500" />
              WhatsApp Support Available
            </Link>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-xs uppercase tracking-widest">Product</h4>
            <ul className="space-y-2.5">
              {[
                { href: '/features', label: 'Features' },
                { href: '/browse', label: 'Channel List' },
                { href: '/pricing', label: 'Pricing & Plans' },
                { href: '/download', label: 'Download APK' },
              ].map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="text-slate-400 hover:text-white text-sm transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-xs uppercase tracking-widest">Support</h4>
            <ul className="space-y-2.5">
              {[
                { href: '/payment', label: 'Buy License' },
                { href: '/license', label: 'Check License' },
                { href: '/support', label: 'Contact Support' },
                { href: '/download', label: 'Installation Guide' },
              ].map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="text-slate-400 hover:text-white text-sm transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-xs uppercase tracking-widest">Legal</h4>
            <ul className="space-y-2.5">
              {[
                { href: '/privacy', label: 'Privacy Policy' },
                { href: '/terms', label: 'Terms & Conditions' },
              ].map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="text-slate-400 hover:text-white text-sm transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-5">
              <div className="text-xs text-slate-600 mb-2 uppercase tracking-widest font-medium">Payment methods</div>
              <div className="flex flex-wrap gap-1.5">
                {['UPI', 'PhonePe', 'GPay', 'Paytm', 'Cards'].map(m => (
                  <span key={m} className="text-[10px] px-2 py-0.5 rounded bg-white/[0.05] border border-white/[0.07] text-slate-500">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-white/[0.06] pt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <p className="text-slate-600 text-xs">
            &copy; {new Date().getFullYear()} IPTVLive. All rights reserved.
          </p>
          <p className="text-slate-700 text-xs max-w-md text-right leading-relaxed">
            For entertainment use only. Channel availability may change based on stream or source status.
          </p>
        </div>

      </div>
    </footer>
  );
}
