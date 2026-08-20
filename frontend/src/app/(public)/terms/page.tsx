import type { Metadata } from 'next';
import Link from 'next/link';
import { Scale, ShieldCheck, Mail, ExternalLink, ChevronRight, FileText } from 'lucide-react';
import PageTracker from '@/components/public/PageTracker';

export const metadata: Metadata = {
  title: 'Terms & Conditions — NivaTV',
  description:
    'Review the official Terms & Conditions, open-source content indexing policy, license rules, and DMCA copyright compliance guidelines for NivaTV.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://nivatv.luxomall.in/terms' },
};

const SECTIONS = [
  { id: 'acceptance', title: '1. Acceptance of Terms' },
  { id: 'platform', title: '2. Open-Source Indexing Disclaimer' },
  { id: 'dmca', title: '3. Intellectual Property & DMCA' },
  { id: 'license', title: '4. License Keys & Device Limits' },
  { id: 'refund', title: '5. No Refund Policy' },
  { id: 'availability', title: '6. Stream Availability Disclaimer' },
  { id: 'prohibited', title: '7. Prohibited Uses' },
  { id: 'governing', title: '8. Governing Law & Jurisdiction' },
];

export default function TermsPage() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nivatv.luxomall.in' },
      { '@type': 'ListItem', position: 2, name: 'Terms & Conditions', item: 'https://nivatv.luxomall.in/terms' },
    ],
  };

  return (
    <div className="pt-24 pb-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto text-slate-200">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <PageTracker page="terms" />

      {/* Header */}
      <div className="border-b border-white/10 pb-8 mb-10">
        <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-3">
          <Scale className="w-4 h-4" />
          <span>Legal Agreements</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4 font-display">
          Terms &amp; Conditions
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-300">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-200 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Effective: August 20, 2026
          </span>
          <span className="text-slate-400">Jurisdiction: Tripura, India</span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-400">Version 2.8</span>
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Sticky Table of Contents Sidebar */}
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-28 bg-[#121218] border border-white/10 rounded-2xl p-5 shadow-xl">
            <h2 className="text-white font-bold text-sm uppercase tracking-wider mb-4 pb-2 border-b border-white/10 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Table of Contents</span>
            </h2>
            <nav className="space-y-1">
              {SECTIONS.map((sec) => (
                <a
                  key={sec.id}
                  href={`#${sec.id}`}
                  className="group flex items-center justify-between py-2 px-3 rounded-xl text-xs sm:text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <span className="group-hover:translate-x-0.5 transition-transform">{sec.title}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                </a>
              ))}
            </nav>

            <div className="mt-6 pt-5 border-t border-white/10">
              <p className="text-xs text-slate-400 mb-2">Have a question or request?</p>
              <a
                href="mailto:support@nivatv.luxomall.in"
                className="text-xs font-semibold text-indigo-400 hover:underline block truncate"
              >
                support@nivatv.luxomall.in
              </a>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="lg:col-span-8 space-y-8">
          <section id="acceptance" className="bg-[#121218] border border-white/10 rounded-2xl p-6 sm:p-8 scroll-mt-28">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">1. Acceptance of Terms</h2>
            <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
              By purchasing a license key, downloading the APK, or accessing any part of the NivaTV application and website
              (https://nivatv.luxomall.in), you explicitly agree to be bound by these Terms and Conditions and our Privacy
              Policy. If you do not agree, you must discontinue using the Service immediately.
            </p>
          </section>

          <section id="platform" className="bg-[#121218] border border-white/10 rounded-2xl p-6 sm:p-8 scroll-mt-28">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">2. Open-Source Content Indexing Disclaimer</h2>
            <p className="text-slate-200 text-sm sm:text-base leading-relaxed mb-3">
              NivaTV is strictly a media player software client and search indexer designed to organize publicly available,
              open-source, and free-to-air stream links on behalf of the user.
            </p>
            <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
              NivaTV does <strong>NOT</strong> host, re-transmit, archive, control, or upload any media content or
              audio/video streams on its servers. All live stream signals are broadcast by independent third-party entities
              over public networks.
            </p>
          </section>

          <section id="dmca" className="bg-[#121218] border border-white/10 rounded-2xl p-6 sm:p-8 scroll-mt-28">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">3. Intellectual Property &amp; DMCA Takedowns</h2>
            <p className="text-slate-200 text-sm sm:text-base leading-relaxed mb-3">
              NivaTV strictly respects copyright and intellectual property rights. We do not claim ownership of any third-party
              logos, trademarks, channel names, or stream content displayed.
            </p>
            <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
              If you are a copyright owner and believe any indexed stream link violates your copyright, notify us at{' '}
              <a href="mailto:support@nivatv.luxomall.in" className="text-indigo-400 font-semibold underline">
                support@nivatv.luxomall.in
              </a>
              . We will expeditiously remove or disable access to the contested stream links upon verification.
            </p>
          </section>

          <section id="license" className="bg-[#121218] border border-white/10 rounded-2xl p-6 sm:p-8 scroll-mt-28">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">4. License Keys &amp; Device Limits</h2>
            <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
              Each license key purchased is for private personal viewing only. Licenses are bound to the specific number of
              concurrent devices defined by your subscription tier. Sharing, distributing, or reselling license keys or
              attempting to circumvent device concurrency controls will result in immediate termination without refund.
            </p>
          </section>

          <section id="refund" className="bg-[#121218] border border-white/10 rounded-2xl p-6 sm:p-8 scroll-mt-28">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">5. No Refund Policy</h2>
            <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
              Due to the digital delivery and instantaneous activation of cryptographic license keys, all subscription
              purchases are final and non-refundable once the activation key has been delivered. If you experience technical
              connectivity issues, contact our support team for troubleshooting assistance.
            </p>
          </section>

          <section id="availability" className="bg-[#121218] border border-white/10 rounded-2xl p-6 sm:p-8 scroll-mt-28">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">6. Stream Availability Disclaimer</h2>
            <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
              While we strive to provide a smooth, low-latency playback platform, NivaTV does not guarantee 100% channel uptime
              or uninterrupted service. Broadcasters may change URLs, apply regional geoblocks, or cease broadcasting at their
              sole discretion. Channels may be added, replaced, or removed at any time without prior notice.
            </p>
          </section>

          <section id="prohibited" className="bg-[#121218] border border-white/10 rounded-2xl p-6 sm:p-8 scroll-mt-28">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">7. Prohibited Uses</h2>
            <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
              You agree not to: (a) re-broadcast, capture, or publicly display streams for commercial gain; (b) reverse engineer,
              decompile, or modify the NivaTV application; (c) bypass authentication tokens or rate limiting mechanisms; (d) use
              the Service for any unlawful purpose under the laws of India or your local jurisdiction.
            </p>
          </section>

          <section id="governing" className="bg-[#121218] border border-white/10 rounded-2xl p-6 sm:p-8 scroll-mt-28">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">8. Governing Law &amp; Jurisdiction</h2>
            <p className="text-slate-200 text-sm sm:text-base leading-relaxed mb-4">
              These Terms and Conditions shall be governed by and construed in accordance with the laws of India. Any disputes
              arising in connection with the Service shall be subject to the exclusive jurisdiction of the competent courts in
              Tripura, India.
            </p>
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-xs sm:text-sm text-slate-300">
              For legal inquiries, contact:{' '}
              <a href="mailto:support@nivatv.luxomall.in" className="text-indigo-400 font-semibold underline">
                support@nivatv.luxomall.in
              </a>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
