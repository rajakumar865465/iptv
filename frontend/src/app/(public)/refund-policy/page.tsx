import Link from 'next/link';
import { ShieldCheck, RefreshCw, FileText } from 'lucide-react';
import type { Metadata } from 'next';
import PageTracker from '@/components/public/PageTracker';

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy — NivaTV',
  description: 'Learn about our refund, cancellation, and transaction dispute policies at NivaTV.',
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  alternates: { canonical: 'https://nivatv.luxomall.in/refund-policy' },
};

export default function RefundPolicyPage() {
  return (
    <div className="pt-24 pb-20 px-4">
      <PageTracker page="refund-policy" />
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-white mb-3">Refund &amp; Cancellation Policy</h1>
          <p className="text-slate-400">Last updated: August 2026</p>
        </div>

        <div className="space-y-8 bg-[#121218] border border-white/10 rounded-2xl p-6 sm:p-8 text-slate-300 leading-relaxed text-sm">
          <section className="border-b border-white/5 pb-6">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" /> 1. Digital License Delivery
            </h2>
            <p>
              NivaTV provides digital license keys (activation codes) for its media player app. All license keys are generated instantly and delivered on-screen and via email immediately upon successful payment confirmation. No physical shipping is required.
            </p>
          </section>

          <section className="border-b border-white/5 pb-6">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-indigo-400" /> 2. Refund Eligibility
            </h2>
            <p className="mb-3">
              We offer a <strong>Free 1-Day Trial</strong> plan so all users can fully test the player app, channel lists, and stream compatibility on their devices before choosing to purchase a paid subscription.
            </p>
            <p className="mb-3">
              Because license keys are digital goods that are active immediately upon delivery, <strong>all sales of paid licenses are final and non-refundable</strong> once a key has been generated and delivered.
            </p>
            <p>
              Exceptions are made only for duplicate transactions (where you were charged twice for the same license purchase). If a duplicate charge occurs, please contact us with transaction details, and we will issue a full refund for the duplicate payment.
            </p>
          </section>

          <section className="border-b border-white/5 pb-6">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" /> 3. Cancellation Policy
            </h2>
            <p className="mb-3">
              NivaTV operates on a manual renewal model. We do not support or charge any auto-recurring subscription fees. 
            </p>
            <p>
              Since there is no auto-billing, there is no recurring subscription to cancel. Once your purchased license validity period (e.g. 1 Month, 1 Year) expires, your access will automatically cease, and you will not be billed again unless you choose to manually buy a new license.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Processing of Refunds</h2>
            <p className="mb-3">
              Approved refunds (e.g., for duplicate transactions or payment gateway errors) are processed back to the original payment source (UPI, netbanking, or card) used at the time of purchase.
            </p>
            <p>
              Refunds typically reflect in your account within <strong>5 to 7 business days</strong> as per standard banking and Razorpay settlement workflows.
            </p>
          </section>
        </div>

        <div className="mt-8 text-center text-sm text-slate-400">
          Have questions about your payment? Visit our{' '}
          <Link href="/support" className="text-indigo-400 hover:underline">
            Support Page
          </Link>{' '}
          or email us at support@nivatv.luxomall.in.
        </div>
      </div>
    </div>
  );
}
