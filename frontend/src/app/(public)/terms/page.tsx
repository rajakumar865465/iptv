import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, AlertTriangle, FileText, Scale, Lock, RefreshCw, Mail } from 'lucide-react';
import PageTracker from '@/components/public/PageTracker';

export const metadata: Metadata = {
  title: 'Terms & Conditions — NivaTV',
  description:
    'Review the official Terms & Conditions, open-source content indexing policy, license rules, and DMCA copyright compliance guidelines for NivaTV.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://nivatv.luxomall.in/terms' },
};

export default function TermsPage() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nivatv.luxomall.in' },
      { '@type': 'ListItem', position: 2, name: 'Terms & Conditions', item: 'https://nivatv.luxomall.in/terms' },
    ],
  };

  const sections = [
    {
      title: '1. Acceptance of Terms',
      content: `By purchasing a license key, downloading the APK, or accessing any part of the NivaTV software application and website (https://nivatv.luxomall.in), you explicitly agree to be bound by these Terms and Conditions and our Privacy Policy. If you do not agree, you must discontinue using the Service immediately.`,
    },
    {
      title: '2. Nature of the Service & Open-Source Content Disclaimer',
      content: `NivaTV is strictly a media player software client and search indexer designed to organize publicly available, open-source, and free-to-air stream links on behalf of the user. NivaTV does NOT host, re-transmit, archive, control, or upload any media content or audio/video streams on its servers. All live stream signals are broadcast by independent third-party entities over public networks.`,
    },
    {
      title: '3. Intellectual Property & DMCA Copyright Takedowns',
      content: `NivaTV strictly respects copyright and intellectual property rights. We do not claim ownership of any third-party logos, trademarks, channel names, or stream content displayed. If you are a copyright owner or authorized representative and believe any indexed stream link violates your copyright, you may notify us at support@nivatv.luxomall.in with proof of ownership. We will immediately remove or disable access to the contested stream links upon receiving a valid request.`,
    },
    {
      title: '4. License Keys & Device Limits',
      content: `Each license key purchased is for private personal viewing only. Licenses are bound to the specific number of concurrent devices defined by your subscription tier. Sharing, distributing, or reselling license keys or attempting to circumvent device concurrency controls will result in immediate termination of the license without refund.`,
    },
    {
      title: '5. No Refund Policy',
      content: `Due to the digital delivery and instantaneous activation of cryptographic license keys, all subscription purchases are final and non-refundable once the activation key has been delivered. If you experience technical connectivity issues, contact our support team for troubleshooting assistance.`,
    },
    {
      title: '6. Stream Availability & Uptime Disclaimer',
      content: `While we strive to provide a smooth, low-latency playback platform, NivaTV does not guarantee 100% channel uptime or uninterrupted service. Broadcasters may change URLs, apply regional geoblocks, or cease broadcasting at their sole discretion. Channels may be added, replaced, or removed at any time without prior notice.`,
    },
    {
      title: '7. Prohibited Uses',
      content: `You agree not to: (a) re-broadcast, capture, or publicly display streams for commercial gain; (b) reverse engineer, decompile, or modify the NivaTV application; (c) bypass authentication tokens or rate limiting mechanisms; (d) use the Service for any unlawful purpose under the laws of India or your local jurisdiction.`,
    },
    {
      title: '8. Governing Law & Jurisdiction',
      content: `These Terms and Conditions shall be governed by and construed in accordance with the laws of India. Any disputes arising in connection with the Service shall be subject to the exclusive jurisdiction of the competent courts in Tripura, India.`,
    },
  ];

  return (
    <div className="pt-24 pb-24 px-4 max-w-4xl mx-auto">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <PageTracker page="terms" />

      {/* Header */}
      <div className="text-center mb-12">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
          <Scale className="w-7 h-7 text-indigo-400" />
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-3 font-display">
          Terms &amp; Conditions
        </h1>
        <p className="text-slate-400 text-sm sm:text-base">
          Last updated: <strong className="text-slate-200">August 20, 2026</strong>
        </p>
      </div>

      {/* Highlight Box */}
      <div className="mb-12 bg-slate-900/60 border border-white/10 rounded-3xl p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-2">Platform Summary</h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              NivaTV is an IPTV media player tool for personal stream management. We provide software access to open-source,
              publicly accessible stream URLs and do not broadcast or host proprietary video streams.
            </p>
          </div>
        </div>
      </div>

      {/* Terms Sections */}
      <div className="space-y-8">
        {sections.map((section) => (
          <div key={section.title} className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8">
            <h2 className="text-xl font-bold text-white mb-3">{section.title}</h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">{section.content}</p>
          </div>
        ))}
      </div>

      {/* Contact CTA */}
      <div className="mt-12 text-center bg-indigo-500/10 border border-indigo-500/20 rounded-3xl p-8">
        <h3 className="text-xl font-bold text-white mb-2">Have Questions or Copyright Concerns?</h3>
        <p className="text-slate-300 text-sm mb-5">
          Our compliance and support teams are available 24/7 to resolve inquiries or copyright notices.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="mailto:support@nivatv.luxomall.in"
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all"
          >
            Email Support: support@nivatv.luxomall.in
          </a>
          <Link
            href="/support"
            className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 font-semibold text-sm transition-all border border-white/10"
          >
            Help &amp; Support Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
