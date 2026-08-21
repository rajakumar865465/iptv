import Link from 'next/link';
import Image from 'next/image';

export default function PublicFooter() {
  return (
    <footer className="bg-surface border-t border-line">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-6">

        {/* Main grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10">

          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4 w-fit">
              <Image src="/logo.png" alt="" width={32} height={32} className="h-8 w-auto object-contain" />
              <span className="font-display text-lg font-bold tracking-tight leading-none select-none">
                <span className="text-white">Niva</span>
                <span className="text-brand-500">TV</span>
              </span>
            </Link>
            <p className="text-ink-muted text-sm leading-relaxed mb-4">
              Premium Android media player for Free-to-Air (FTA) and publicly available Indian live TV channels.
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
                { href: '/payment', label: 'Instant Checkout' },
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
                { href: '/refund-policy', label: 'Refund & Cancellation Policy' },
              ].map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="text-slate-400 hover:text-white text-sm transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-5">
              <div className="text-xs text-ink-subtle mb-2 uppercase tracking-widest font-medium">Payment methods</div>
              <div className="flex flex-wrap gap-1.5">
                {['UPI', 'PhonePe', 'GPay', 'Paytm', 'Cards'].map(m => (
                  <span key={m} className="text-[10px] px-2 py-0.5 rounded bg-white/[0.05] border border-white/[0.07] text-ink-muted">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-white/[0.06] pt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <p className="text-ink-muted text-xs">
            &copy; {new Date().getFullYear()} NivaTV. All rights reserved.
          </p>
          <p className="text-ink-subtle text-xs max-w-md text-right leading-relaxed">
            For entertainment use only. Channel availability may change based on stream or source status.
          </p>
        </div>

      </div>
    </footer>
  );
}
