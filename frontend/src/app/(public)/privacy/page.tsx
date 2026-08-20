import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  FileText,
  Mail,
  Scale,
  Database,
  Smartphone,
  Eye,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import PageTracker from '@/components/public/PageTracker';

export const metadata: Metadata = {
  title: 'Privacy Policy — NivaTV',
  description:
    'Official Privacy Policy and Platform Terms for NivaTV. Learn how we handle personal data, cookies, device identifiers, and intellectual property compliance.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://nivatv.luxomall.in/privacy' },
};

const SECTIONS = [
  { id: 'definitions', title: '1. Interpretation & Definitions' },
  { id: 'disclaimer', title: '2. Content & Open-Source Indexing' },
  { id: 'collection', title: '3. Information We Collect' },
  { id: 'usage', title: '4. How We Use Your Data' },
  { id: 'retention', title: '5. Data Retention & Security' },
  { id: 'rights', title: '6. Your Rights & Data Deletion' },
  { id: 'dmca', title: '7. DMCA Takedown & Contact' },
];

export default function PrivacyPage() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nivatv.luxomall.in' },
      { '@type': 'ListItem', position: 2, name: 'Privacy Policy', item: 'https://nivatv.luxomall.in/privacy' },
    ],
  };

  return (
    <div className="pt-24 pb-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto text-white/80">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <PageTracker page="privacy" />

      {/* Header */}
      <div className="border-b border-white/10 pb-8 mb-10">
        <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-3">
          <ShieldCheck className="w-4 h-4" />
          <span>Legal &amp; Compliance Center</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4 font-display">
          Privacy Policy
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-white/80">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/80 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Effective: August 20, 2026
          </span>
          <span className="text-white/60">Jurisdiction: Tripura, India</span>
          <span className="text-white/60">•</span>
          <span className="text-white/60">Version 2.8</span>
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
                  className="group flex items-center justify-between py-2 px-3 rounded-xl text-xs sm:text-sm text-white/80 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <span className="group-hover:translate-x-0.5 transition-transform">{sec.title}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-white/60 group-hover:text-indigo-400 transition-colors" />
                </a>
              ))}
            </nav>

            <div className="mt-6 pt-5 border-t border-white/10">
              <p className="text-xs text-white/60 mb-2">Need legal or DMCA assistance?</p>
              <a
                href="mailto:support@nivatv.luxomall.in"
                className="text-xs font-semibold text-indigo-400 hover:underline block truncate"
              >
                support@nivatv.luxomall.in
              </a>
            </div>
          </div>
        </aside>

        {/* Main Legal Content */}
        <main className="lg:col-span-8 space-y-8">
          {/* Section 1: Definitions */}
          <section id="definitions" className="bg-[#121218] border border-white/10 rounded-2xl p-6 sm:p-8 scroll-mt-28">
            <div className="flex items-center gap-3 mb-4">
              <Scale className="w-5 h-5 text-indigo-400 shrink-0" />
              <h2 className="text-xl sm:text-2xl font-bold text-white">1. Interpretation and Definitions</h2>
            </div>
            <p className="text-white/80 text-sm sm:text-base leading-relaxed mb-4">
              This Privacy Policy describes Our policies and procedures on the collection, use, and disclosure of Your
              information when You use the Service and tells You about Your privacy rights and how the law protects You.
            </p>
            <p className="text-white/80 text-sm sm:text-base leading-relaxed mb-6">
              We use Your Personal Data to provide and improve the Service. By accessing or using the Service, You agree to the
              collection and use of information in accordance with this Privacy Policy.
            </p>

            <h3 className="text-base font-bold text-white mb-3">Definitions for this Policy:</h3>
            <div className="space-y-3 text-xs sm:text-sm text-white/80">
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <strong className="text-white">Account:</strong> A unique account created for You to access Our Service or
                specific features thereof.
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <strong className="text-white">Application:</strong> Refers to <em>NivaTV</em>, the software application
                provided by the Company.
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <strong className="text-white">Company:</strong> Refers to <em>NivaTV</em> (&quot;We&quot;, &quot;Us&quot;, or
                &quot;Our&quot;), situated and operating in <strong>Tripura, India</strong>.
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <strong className="text-white">Device:</strong> Any device capable of accessing the Service, including
                Android smartphones, tablets, TV boxes, smart displays, or PCs.
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <strong className="text-white">Personal Data:</strong> Any information that identifies or can reasonably be
                linked to an identified individual.
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <strong className="text-white">Service:</strong> Refers to the NivaTV mobile app and the website accessible
                at{' '}
                <a href="https://nivatv.luxomall.in" className="text-indigo-400 hover:underline">
                  https://nivatv.luxomall.in
                </a>
                .
              </div>
            </div>
          </section>

          {/* Section 2: Content & Open-Source Indexing (integrated naturally) */}
          <section id="disclaimer" className="bg-[#121218] border border-white/10 rounded-2xl p-6 sm:p-8 scroll-mt-28">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0" />
              <h2 className="text-xl sm:text-2xl font-bold text-white">2. Content &amp; Open-Source Indexing Policy</h2>
            </div>
            <p className="text-white/80 text-sm sm:text-base leading-relaxed mb-4">
              NivaTV operates strictly as an open-source media player software client and indexer for freely accessible,
              publicly broadcast stream feeds.
            </p>
            <div className="space-y-3 text-xs sm:text-sm text-white/80">
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <strong className="text-white block mb-1">Platform Neutrality &amp; Hosting</strong>
                NivaTV does not own, produce, host, broadcast, or transmit any video streams or copyrighted media directly.
                All indexed streams originate from public third-party servers.
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <strong className="text-white block mb-1">No Uptime Guarantee</strong>
                We do not guarantee the continuous availability, quality, or stability of any third-party stream URLs. Stream
                feeds are subject to alteration or termination by their originating broadcasters without notice.
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <strong className="text-white block mb-1">Intellectual Property &amp; Takedowns</strong>
                We respect intellectual property rights. If a copyright holder submits a valid takedown request for any
                indexed stream link, we will immediately disable and remove access from our catalog upon verification.
              </div>
            </div>
          </section>

          {/* Section 3: Collection */}
          <section id="collection" className="bg-[#121218] border border-white/10 rounded-2xl p-6 sm:p-8 scroll-mt-28">
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-5 h-5 text-indigo-400 shrink-0" />
              <h2 className="text-xl sm:text-2xl font-bold text-white">3. Information We Collect</h2>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-white/80">
              <div>
                <h3 className="text-white font-bold text-sm sm:text-base mb-1.5">A. Personal Data</h3>
                <p className="leading-relaxed mb-2">
                  When purchasing a subscription, creating an account, or seeking support, We may collect:
                </p>
                <ul className="list-disc list-inside space-y-1 text-white/80 ml-2">
                  <li>Full name</li>
                  <li>Email address</li>
                  <li>Mobile phone number (for OTP authentication and license delivery)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-white font-bold text-sm sm:text-base mb-1.5">B. Device Identifiers &amp; Usage Data</h3>
                <p className="leading-relaxed">
                  When You access the Service via mobile devices, We automatically collect hardware identifiers (UUID /
                  Android ID), app version, IP address, and connection timestamps. Hardware identifiers are used exclusively to
                  enforce license device concurrency limits.
                </p>
              </div>

              <div>
                <h3 className="text-white font-bold text-sm sm:text-base mb-1.5">C. Cookies &amp; Local Storage</h3>
                <p className="leading-relaxed">
                  We use essential session tokens and local storage strictly to remember your active login state and license
                  keys. We do not deploy third-party advertising cookies or cross-site tracking pixels.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Usage & SMS Notice */}
          <section id="usage" className="bg-[#121218] border border-white/10 rounded-2xl p-6 sm:p-8 scroll-mt-28">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-5 h-5 text-indigo-400 shrink-0" />
              <h2 className="text-xl sm:text-2xl font-bold text-white">4. How We Use Your Data</h2>
            </div>
            <p className="text-white/80 text-sm sm:text-base leading-relaxed mb-3">
              We process Personal Data under valid legal bases for the following purposes:
            </p>
            <ul className="space-y-2 text-xs sm:text-sm text-white/80 mb-6">
              <li>
                <strong className="text-white">• Service Provision:</strong> Delivering and validating digital license keys,
                maintaining active playback sessions.
              </li>
              <li>
                <strong className="text-white">• Account Management:</strong> Facilitating secure sign-in via password, OTP, or
                Google OAuth.
              </li>
              <li>
                <strong className="text-white">• Customer Support:</strong> Resolving technical inquiries and subscription
                requests.
              </li>
              <li>
                <strong className="text-white">• Security &amp; Fraud Prevention:</strong> Protecting system integrity and
                preventing unauthorized license cloning.
              </li>
            </ul>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 text-white font-bold text-xs sm:text-sm mb-1.5">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>Text Messages (SMS) &amp; Mobile Data Privacy</span>
              </div>
              <p className="text-xs text-white/80 leading-relaxed">
                Mobile phone numbers collected for OTP verification are used solely for authentication and critical account
                alerts. <strong>No mobile phone information is ever sold, rented, or shared with third-party advertisers or
                marketing agencies.</strong>
              </p>
            </div>
          </section>

          {/* Section 5: Retention & Security */}
          <section id="retention" className="bg-[#121218] border border-white/10 rounded-2xl p-6 sm:p-8 scroll-mt-28">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="w-5 h-5 text-indigo-400 shrink-0" />
              <h2 className="text-xl sm:text-2xl font-bold text-white">5. Data Retention &amp; Security</h2>
            </div>
            <p className="text-white/80 text-sm sm:text-base leading-relaxed mb-3">
              We retain Personal Data only for as long as necessary to fulfill the operational purposes described herein:
            </p>
            <ul className="space-y-1.5 text-xs sm:text-sm text-white/80 mb-4">
              <li>• Account records: Retained during the active subscription plus up to 24 months for audit compliance.</li>
              <li>• Support correspondence: Retained for up to 24 months to track resolution quality.</li>
              <li>• Diagnostic server logs: Automatically rotated and purged on a scheduled basis.</li>
            </ul>
            <p className="text-white/80 text-xs sm:text-sm leading-relaxed">
              We enforce industry-standard security measures, including TLS/HTTPS data in transit, bcrypt password hashing, and
              role-based database access controls.
            </p>
          </section>

          {/* Section 6: User Rights */}
          <section id="rights" className="bg-[#121218] border border-white/10 rounded-2xl p-6 sm:p-8 scroll-mt-28">
            <div className="flex items-center gap-3 mb-4">
              <Eye className="w-5 h-5 text-indigo-400 shrink-0" />
              <h2 className="text-xl sm:text-2xl font-bold text-white">6. Your Rights &amp; Data Deletion</h2>
            </div>
            <p className="text-white/80 text-sm sm:text-base leading-relaxed mb-3">
              You have the right to access, update, or request the permanent deletion of your personal information from our
              systems.
            </p>
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 text-xs sm:text-sm text-white/80">
              <strong className="text-white block mb-1">To request account or data deletion:</strong>
              Email{' '}
              <a href="mailto:support@nivatv.luxomall.in" className="text-indigo-400 font-semibold underline">
                support@nivatv.luxomall.in
              </a>{' '}
              with the subject &quot;Data Deletion Request&quot; from your registered email. Requests are verified and completed
              within 30 days.
            </div>
          </section>

          {/* Section 7: DMCA & Contact */}
          <section id="dmca" className="bg-[#121218] border border-white/10 rounded-2xl p-6 sm:p-8 scroll-mt-28">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="w-5 h-5 text-indigo-400 shrink-0" />
              <h2 className="text-xl sm:text-2xl font-bold text-white">7. DMCA Inquiries &amp; Contact Us</h2>
            </div>
            <p className="text-white/80 text-sm sm:text-base leading-relaxed mb-4">
              If you have any questions regarding this Privacy Policy, or if you are a copyright owner requesting a channel
              delisting, please reach out to us:
            </p>
            <div className="grid sm:grid-cols-2 gap-4 text-xs sm:text-sm">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <span className="text-white/60 block mb-1">Official Legal Email</span>
                <a
                  href="mailto:support@nivatv.luxomall.in"
                  className="text-white font-bold hover:text-indigo-400 transition-colors"
                >
                  support@nivatv.luxomall.in
                </a>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <span className="text-white/60 block mb-1">Support Portal</span>
                <Link
                  href="/support"
                  className="text-indigo-400 font-bold hover:underline inline-flex items-center gap-1"
                >
                  <span>nivatv.luxomall.in/support</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
            <p className="text-xs text-white/60 mt-5">
              Operating entity: NivaTV, Tripura, India. Governed by applicable Indian Information Technology (IT) Rules and
              Digital Personal Data Protection standards.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
