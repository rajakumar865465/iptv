import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  FileText,
  AlertTriangle,
  Mail,
  Scale,
  Database,
  Smartphone,
  Eye,
  Bell,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import PageTracker from '@/components/public/PageTracker';

export const metadata: Metadata = {
  title: 'Privacy Policy — NivaTV',
  description:
    'Read the official Privacy Policy and Content Disclaimer for NivaTV. Learn how we handle personal data, cookies, device identifiers, and intellectual property compliance.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://nivatv.luxomall.in/privacy' },
};

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
    <div className="pt-24 pb-24 px-4 max-w-4xl mx-auto">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <PageTracker page="privacy" />

      {/* Header */}
      <div className="text-center mb-12">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-7 h-7 text-indigo-400" />
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-3 font-display">
          Privacy Policy
        </h1>
        <p className="text-slate-400 text-sm sm:text-base">
          Last updated: <strong className="text-slate-200">August 20, 2026</strong>
        </p>
      </div>

      {/* Highlights & Content Disclaimer Callout */}
      <div className="mb-12 bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-amber-500/10 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-xl shadow-amber-950/20">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-2">
              Important: Platform &amp; Open-Source Content Disclaimer
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-3">
              <strong>NivaTV</strong> is strictly a software media player platform and indexing tool that enables users to
              access publicly available, open-source, and free-to-air stream links.
            </p>
            <ul className="space-y-1.5 text-xs sm:text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span>
                  <strong>No Content Hosting:</strong> NivaTV does not own, host, archive, broadcast, or transmit any video
                  streams or media content directly. All streams are sourced from publicly available third-party servers.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span>
                  <strong>No Broadcast Guarantees:</strong> We provide no warranty regarding channel uptime, availability, or
                  uninterrupted broadcasting of third-party feeds.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span>
                  <strong>Immediate DMCA &amp; Copyright Removal:</strong> We strictly respect all intellectual property
                  rights. If you are a copyright owner and wish to request the removal of any indexed stream link, contact us
                  at{' '}
                  <a
                    href="mailto:support@nivatv.luxomall.in"
                    className="text-indigo-400 underline hover:text-indigo-300 font-semibold"
                  >
                    support@nivatv.luxomall.in
                  </a>
                  . We will expeditiously review and disable access immediately.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Main Privacy Document Content */}
      <div className="space-y-10 text-slate-300 leading-relaxed text-sm sm:text-base">
        {/* Section 1 */}
        <section className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-4">
            <Scale className="w-6 h-6 text-indigo-400 shrink-0" />
            <h2 className="text-xl sm:text-2xl font-bold text-white">1. Interpretation and Definitions</h2>
          </div>
          <p className="mb-4">
            This Privacy Policy describes Our policies and procedures on the collection, use, and disclosure of Your
            information when You use the Service and tells You about Your privacy rights and how the law protects You.
          </p>
          <p className="mb-4">
            We use Your Personal Data to provide and improve the Service. By accessing or using the Service, You agree to the
            collection and use of information in accordance with this Privacy Policy.
          </p>

          <h3 className="text-lg font-bold text-white mt-6 mb-3">Definitions</h3>
          <ul className="space-y-2.5 text-sm">
            <li>
              <strong className="text-white">Account:</strong> A unique account created for You to access Our Service or
              parts of Our Service.
            </li>
            <li>
              <strong className="text-white">Application:</strong> Refers to <em>NivaTV</em>, the software application
              provided by the Company.
            </li>
            <li>
              <strong className="text-white">Company:</strong> Refers to <em>NivaTV</em> (&quot;We&quot;, &quot;Us&quot;, or
              &quot;Our&quot;), operating in <strong>Tripura, India</strong>.
            </li>
            <li>
              <strong className="text-white">Country / State:</strong> Tripura, India.
            </li>
            <li>
              <strong className="text-white">Device:</strong> Any hardware device capable of accessing the Service, including
              Android smartphones, tablets, Android TV boxes, Smart TVs, and PCs.
            </li>
            <li>
              <strong className="text-white">Personal Data:</strong> Any information relating to an identified or
              identifiable individual (e.g., name, email, phone number).
            </li>
            <li>
              <strong className="text-white">Service:</strong> Refers to the NivaTV Mobile Application, the Website (
              <a href="https://nivatv.luxomall.in" className="text-indigo-400 hover:underline">
                https://nivatv.luxomall.in
              </a>
              ), or both.
            </li>
            <li>
              <strong className="text-white">Service Provider:</strong> Any natural or legal person processing data on behalf
              of the Company (such as payment gateways, authentication providers, and infrastructure hosts).
            </li>
            <li>
              <strong className="text-white">Usage Data:</strong> Data collected automatically, generated by using the
              Service or from the Service infrastructure (e.g., session durations, API call diagnostics).
            </li>
          </ul>
        </section>

        {/* Section 2 */}
        <section className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-6 h-6 text-indigo-400 shrink-0" />
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              2. Collecting and Using Your Personal Information
            </h2>
          </div>

          <h3 className="text-lg font-semibold text-white mb-2">Types of Data Collected</h3>
          
          <h4 className="text-white font-bold text-sm mt-4 mb-2">A. Personal Data</h4>
          <p className="mb-3">
            While using Our Service, We may ask You to provide Us with certain personally identifiable information used to
            authenticate Your account, issue license keys, and provide customer support:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm text-slate-300 ml-2 mb-4">
            <li>Email address</li>
            <li>First name and last name</li>
            <li>Phone number (for OTP authentication and license delivery)</li>
          </ul>

          <h4 className="text-white font-bold text-sm mt-4 mb-2">B. Usage Data &amp; Device Identifiers</h4>
          <p className="text-sm mb-3">
            Usage Data is collected automatically when using the Service. This may include Your Device IP address, operating
            system version, browser type, diagnostic crash logs, and unique hardware device IDs used exclusively for
            enforcing device concurrency limits tied to your license tier.
          </p>

          <h4 className="text-white font-bold text-sm mt-4 mb-2">C. Tracking Technologies and Cookies</h4>
          <p className="text-sm mb-3">
            We use essential session and persistent cookies to authenticate users, prevent fraudulent access, and remember
            functional preferences (such as language selection). We do not deploy third-party advertising tracking cookies.
          </p>
        </section>

        {/* Section 3 */}
        <section className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-6 h-6 text-indigo-400 shrink-0" />
            <h2 className="text-xl sm:text-2xl font-bold text-white">3. Use of Your Personal Data</h2>
          </div>
          <p className="mb-3">The Company uses Personal Data for the following legitimate purposes:</p>
          <ul className="space-y-2 text-sm">
            <li>
              <strong className="text-white">• To deliver and maintain the Service:</strong> Managing user sessions, license
              key validations, and stream proxy connections.
            </li>
            <li>
              <strong className="text-white">• To manage Your Account:</strong> Permitting secure login via email, mobile
              OTP, or Google OAuth.
            </li>
            <li>
              <strong className="text-white">• For contract performance:</strong> Fulfilling subscription orders and digital
              license deliveries.
            </li>
            <li>
              <strong className="text-white">• To contact You:</strong> Sending security alerts, version updates, and
              customer support responses.
            </li>
            <li>
              <strong className="text-white">• For fraud prevention &amp; device compliance:</strong> Verifying that active
              streams do not exceed allocated device thresholds.
            </li>
          </ul>

          <div className="mt-6 bg-slate-900/60 border border-white/5 rounded-2xl p-5">
            <h3 className="text-white font-bold text-sm mb-2 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400" /> Text Messages &amp; OTP Privacy Notice
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              If You opt in to receive SMS (e.g., for login OTPs or license activation alerts), We collect and store Your phone
              number solely for authentication and service notifications. <strong>No mobile phone information is ever sold,
              rented, or shared with third parties or affiliates for marketing or advertising purposes.</strong>
            </p>
          </div>
        </section>

        {/* Section 4 */}
        <section className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="w-6 h-6 text-indigo-400 shrink-0" />
            <h2 className="text-xl sm:text-2xl font-bold text-white">4. Data Retention and Security</h2>
          </div>
          <p className="mb-3 text-sm">
            We retain Personal Data only for as long as necessary to fulfill the purposes outlined in this policy:
          </p>
          <ul className="space-y-2 text-sm text-slate-300 mb-6">
            <li>
              <strong className="text-white">• User Account Records:</strong> Retained for the duration of the account plus up
              to 24 months after account closure for audit and dispute resolution.
            </li>
            <li>
              <strong className="text-white">• Customer Support Data:</strong> Stored for up to 24 months to ensure service
              quality.
            </li>
            <li>
              <strong className="text-white">• Diagnostic &amp; Server Logs:</strong> Rotated and purged regularly (up to 24
              months) for security troubleshooting.
            </li>
          </ul>
          <p className="text-sm">
            We employ industry-standard encryption (TLS/HTTPS), bcrypt password hashing (12 rounds), and secure tokenized
            authentication. However, no electronic transmission over the internet is 100% impenetrable.
          </p>
        </section>

        {/* Section 5 */}
        <section className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-4">
            <Eye className="w-6 h-6 text-indigo-400 shrink-0" />
            <h2 className="text-xl sm:text-2xl font-bold text-white">5. Your Privacy Rights &amp; Data Deletion</h2>
          </div>
          <p className="mb-4 text-sm">
            You have the right to access, rectify, or request the deletion of any Personal Data We hold about You. You may
            manage your profile details within the Application or submit a formal deletion request to Our support team.
          </p>
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-5 text-sm">
            <p className="text-white font-semibold mb-1">How to Request Account &amp; Data Deletion:</p>
            <p className="text-slate-300 text-xs sm:text-sm">
              Send an email from your registered address to{' '}
              <a href="mailto:support@nivatv.luxomall.in" className="text-indigo-400 underline font-medium">
                support@nivatv.luxomall.in
              </a>{' '}
              with the subject <em>&quot;Data Deletion Request&quot;</em>. We will process and permanently remove your data within
              30 days.
            </p>
          </div>
        </section>

        {/* Section 6 */}
        <section className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-4">
            <Mail className="w-6 h-6 text-indigo-400 shrink-0" />
            <h2 className="text-xl sm:text-2xl font-bold text-white">6. Contact Us &amp; DMCA Agent</h2>
          </div>
          <p className="mb-4 text-sm">
            For privacy inquiries, copyright/DMCA notices, or technical support, contact us directly:
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <span className="text-xs text-slate-400 block mb-1">Official Support Email</span>
              <a
                href="mailto:support@nivatv.luxomall.in"
                className="text-white font-bold text-sm sm:text-base hover:text-indigo-400 transition-colors"
              >
                support@nivatv.luxomall.in
              </a>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <span className="text-xs text-slate-400 block mb-1">Online Support Portal</span>
              <Link
                href="/support"
                className="text-indigo-400 font-bold text-sm sm:text-base hover:underline inline-flex items-center gap-1.5"
              >
                <span>Visit Support Page</span>
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-6 text-center">
            Registered jurisdiction: Tripura, India. Operating under applicable Indian Information Technology (IT) laws and
            Digital Personal Data Protection guidelines.
          </p>
        </section>
      </div>
    </div>
  );
}
