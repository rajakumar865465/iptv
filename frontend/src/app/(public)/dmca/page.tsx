import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldAlert, ShieldCheck, Mail, ExternalLink, ChevronRight, FileText, CheckCircle } from 'lucide-react';
import PageTracker from '@/components/public/PageTracker';

export const metadata: Metadata = {
  title: 'DMCA & Copyright Policy — NivaTV',
  description:
    'Read the official DMCA policy, Free-to-Air (FTA) indexing disclaimer, and copyright takedown notice guidelines for NivaTV.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://nivatv.luxomall.in/dmca' },
};

const SECTIONS = [
  { id: 'overview', title: '1. Overview & Service Nature' },
  { id: 'non-hosting', title: '2. Non-Hosting & Aggregator Notice' },
  { id: 'dmca-compliance', title: '3. DMCA Copyright Compliance' },
  { id: 'takedown-notice', title: '4. Notice & Takedown Procedure' },
  { id: 'counter-notice', title: '5. Counter-Notification Procedure' },
  { id: 'repeat-infringer', title: '6. Repeat Infringer Policy' },
  { id: 'designated-agent', title: '7. Designated DMCA Agent Contact' },
];

export default function DmcaPage() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nivatv.luxomall.in' },
      { '@type': 'ListItem', position: 2, name: 'DMCA Policy', item: 'https://nivatv.luxomall.in/dmca' },
    ],
  };

  return (
    <div className="pt-24 pb-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto text-[var(--color-ink)]/80">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <PageTracker page="dmca" />

      {/* Header */}
      <div className="border-b border-[var(--color-line)] pb-8 mb-10">
        <div className="flex items-center gap-2 text-brand-500 text-xs font-semibold uppercase tracking-wider mb-3">
          <ShieldAlert className="w-4 h-4" />
          <span>Copyright &amp; Intellectual Property</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-[var(--color-ink)] tracking-tight mb-4 font-display">
          DMCA &amp; Copyright Policy
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-[var(--color-ink)]/80">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-line)] text-[var(--color-ink)]/80 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Effective Date: August 2026
          </span>
          <span className="text-[var(--color-ink)]/60">Digital Millennium Copyright Act (17 U.S.C. § 512)</span>
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* Sticky Table of Contents */}
        <aside className="lg:col-span-1 sticky top-28 hidden lg:block bg-surface border border-[var(--color-line)] rounded-2xl p-5 backdrop-blur-md shadow-xl">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]/90 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand-500" />
            Sections
          </p>
          <nav className="space-y-1.5 text-xs">
            {SECTIONS.map((sec) => (
              <a
                key={sec.id}
                href={`#${sec.id}`}
                className="block text-[var(--color-ink)]/80 hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] px-2.5 py-1.5 rounded-lg transition-colors truncate"
              >
                {sec.title}
              </a>
            ))}
          </nav>

          <div className="mt-6 pt-5 border-t border-[var(--color-line)]">
            <p className="text-xs text-[var(--color-ink)]/80 mb-2 font-medium">Fast DMCA Notice?</p>
            <a
              href="mailto:dmca@nivatv.luxomall.in?subject=DMCA%20Takedown%20Request"
              className="flex items-center gap-1.5 text-xs text-brand-500 hover:text-indigo-300 font-semibold"
            >
              Email DMCA Agent <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </aside>

        {/* Content Body */}
        <div className="lg:col-span-3 space-y-8 text-sm sm:text-base leading-relaxed text-[var(--color-ink-muted)]">
          
          {/* Section 1: Overview */}
          <section id="overview" className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl p-6 sm:p-8 scroll-mt-28">
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--color-ink)] mb-4">1. Overview &amp; Service Nature</h2>
            <p className="mb-4">
              NivaTV (<a href="https://nivatv.luxomall.in" className="text-brand-500 hover:underline">https://nivatv.luxomall.in</a>) respects the intellectual property rights of content creators, broadcasters, and copyright owners. We comply strictly with the Digital Millennium Copyright Act of 1998 (&quot;DMCA&quot;) and applicable international copyright laws.
            </p>
            <p>
              NivaTV is an Android media player software and indexing aggregator. It provides users with a convenient client interface to discover and play publicly available, Free-to-Air (FTA) broadcasts, HLS streams, and openly accessible digital media transmissions across the web.
            </p>
          </section>

          {/* Section 2: Non-Hosting */}
          <section id="non-hosting" className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl p-6 sm:p-8 scroll-mt-28">
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--color-ink)] mb-4">2. Non-Hosting &amp; Aggregator Notice</h2>
            <p className="mb-4">
              <strong>NivaTV does not own, host, upload, record, re-encode, or store any video, audio, or multimedia streams on its servers.</strong>
            </p>
            <ul className="list-disc pl-5 space-y-2 mb-4 text-[var(--color-ink-muted)]">
              <li>
                All stream URLs indexed by the application are fetched from publicly accessible internet sources, open-source community repositories, and third-party servers.
              </li>
              <li>
                The transmission and broadcasting of all media content remain under the sole control of the original content provider or server host.
              </li>
              <li>
                Purchased subscription plans represent software utility licenses for client-side playback convenience, channel organization, and software support — not the purchase or sale of copyrighted media.
              </li>
            </ul>
            <p>
              If a source stream is removed or made private by its host provider, it will naturally cease functioning within the NivaTV app interface.
            </p>
          </section>

          {/* Section 3: DMCA Compliance */}
          <section id="dmca-compliance" className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl p-6 sm:p-8 scroll-mt-28">
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--color-ink)] mb-4">3. DMCA Copyright Compliance</h2>
            <p className="mb-4">
              In accordance with Title 17, United States Code, Section 512(c)(2), NivaTV will expeditiously review and respond to valid notices of claimed copyright infringement submitted to our designated copyright agent.
            </p>
            <p>
              Upon receipt of a valid and complete infringement notice, NivaTV will take immediate action to disable access to or remove the referenced channel stream links from our searchable index within <strong>24 to 48 hours</strong>.
            </p>
          </section>

          {/* Section 4: Notice & Takedown Procedure */}
          <section id="takedown-notice" className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl p-6 sm:p-8 scroll-mt-28">
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--color-ink)] mb-4">4. Notice &amp; Takedown Procedure</h2>
            <p className="mb-4">
              If you are a copyright owner or an authorized agent representing one, and you believe that content indexed by NivaTV infringes upon your copyright, please submit a written notification containing all of the following elements:
            </p>
            <div className="space-y-3 bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-xl p-5 text-sm">
              <div className="flex items-start gap-2.5">
                <CheckCircle className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
                <p><strong>1. Identification of Work:</strong> A clear description of the copyrighted work that you claim has been infringed.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
                <p><strong>2. Identification of Material:</strong> The exact channel name, stream URL, or listing within NivaTV that you request to be removed.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
                <p><strong>3. Contact Information:</strong> Your full legal name, company name (if applicable), mailing address, telephone number, and email address.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
                <p><strong>4. Good Faith Statement:</strong> A statement that you have a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
                <p><strong>5. Accuracy Statement &amp; Signature:</strong> A statement made under penalty of perjury that the information in the notification is accurate and that you are authorized to act on behalf of the copyright owner, along with your physical or electronic signature.</p>
              </div>
            </div>
            <p className="mt-4 text-xs text-amber-300/80">
              * Note: Please be aware that under 17 U.S.C. § 512(f), any person who knowingly materially misrepresents that material or activity is infringing may be subject to liability for damages.
            </p>
          </section>

          {/* Section 5: Counter-Notification */}
          <section id="counter-notice" className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl p-6 sm:p-8 scroll-mt-28">
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--color-ink)] mb-4">5. Counter-Notification Procedure</h2>
            <p className="mb-4">
              If a broadcaster or channel publisher believes their channel index link was removed or disabled by mistake or misidentification, they may file a written counter-notification with our DMCA agent containing:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-[var(--color-ink-muted)]">
              <li>Identification of the material that was removed or to which access was disabled.</li>
              <li>A statement under penalty of perjury that the subscriber has a good faith belief that the material was removed or disabled as a result of mistake or misidentification.</li>
              <li>The subscriber&apos;s name, address, telephone number, and consent to local jurisdiction.</li>
              <li>A physical or electronic signature of the subscriber.</li>
            </ul>
          </section>

          {/* Section 6: Repeat Infringer */}
          <section id="repeat-infringer" className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl p-6 sm:p-8 scroll-mt-28">
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--color-ink)] mb-4">6. Repeat Infringer Policy</h2>
            <p>
              NivaTV maintains a strict policy of terminating or permanently blacklisting source streams and third-party feed URLs that are found to be repeatedly subject to valid copyright infringement claims.
            </p>
          </section>

          {/* Section 7: Designated Agent */}
          <section id="designated-agent" className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl p-6 sm:p-8 scroll-mt-28">
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--color-ink)] mb-4 flex items-center gap-2">
              <Mail className="w-6 h-6 text-brand-500" />
              7. Designated DMCA Agent Contact
            </h2>
            <p className="mb-6">
              Please direct all copyright infringement notices, DMCA inquiries, and takedown communications to our designated agent:
            </p>
            <div className="bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-xl p-5 space-y-2 text-sm">
              <p><span className="text-[var(--color-ink-muted)]">Agent / Department:</span> <span className="text-[var(--color-ink)] font-semibold">NivaTV Copyright &amp; Legal Compliance</span></p>
              <p><span className="text-[var(--color-ink-muted)]">Organization:</span> <span className="text-[var(--color-ink)] font-semibold">Luxomall Digital Services</span></p>
              <p><span className="text-[var(--color-ink-muted)]">Primary DMCA Email:</span> <a href="mailto:dmca@nivatv.luxomall.in" className="text-brand-500 font-semibold underline">dmca@nivatv.luxomall.in</a></p>
              <p><span className="text-[var(--color-ink-muted)]">Secondary Email:</span> <a href="mailto:support@nivatv.luxomall.in" className="text-brand-500 font-semibold underline">support@nivatv.luxomall.in</a></p>
              <p><span className="text-[var(--color-ink-muted)]">Address:</span> <span className="text-[var(--color-ink)]">Near GMC Hospital, Bhangagarh, Guwahati, Assam, India - 781005</span></p>
            </div>
            <p className="mt-4 text-xs text-[var(--color-ink-muted)]">
              We respond to all verified takedown notices within 24 to 48 business hours.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
