import { CheckCircle, Shield, Zap, Headphones } from 'lucide-react';
import { getPublicPlans } from '@/lib/publicApi';
import PlanCard from '@/components/public/PlanCard';
import FAQAccordion from '@/components/public/FAQAccordion';
import OfferTrigger from '@/components/public/OfferTrigger';
import type { Metadata } from 'next';
import type { Plan } from '@/lib/publicApi';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Pricing — IPTVLive',
  description: 'Simple, transparent pricing for premium Indian live TV. Daily trial, monthly and yearly plans.',
};

const BILLING_FAQ = [
  { q: 'Is there a free trial?', a: 'Yes! We offer a 1 Day free trial so you can try the app before committing to a paid plan. No payment required.' },
  { q: 'How is payment processed?', a: 'Payments are processed securely through Razorpay, India\'s most trusted payment gateway. We accept UPI, debit/credit cards, and netbanking.' },
  { q: 'Will my subscription auto-renew?', a: 'No. All plans are one-time purchases. You will need to manually renew when your plan expires.' },
  { q: 'What happens after my plan expires?', a: 'The app will stop streaming. You can purchase a new plan and a fresh license key to continue watching.' },
  { q: 'Can I get a refund?', a: 'Due to the digital nature of the product, refunds are not available once the license key has been delivered. Contact support if you face any technical issues.' },
];

const TRUST = [
  { icon: Shield, title: 'Secure Payment', desc: 'Razorpay — PCI DSS compliant, trusted by millions.' },
  { icon: Zap, title: 'Instant Delivery', desc: 'License key generated and shown within seconds of payment.' },
  { icon: CheckCircle, title: 'No Auto-Renewal', desc: 'Pay once, use until expiry. No surprises.' },
  { icon: Headphones, title: 'Dedicated Support', desc: 'WhatsApp & email support for all customers.' },
];

const TRUST_LINES = [
  'Instant license after payment',
  'UPI / PhonePe / GPay / Cards accepted',
  'No auto-renewal',
  'Support available',
];

type PlanVariant = 'most-popular' | 'save-more' | 'best-value' | 'starter';

function planVariant(plan: Plan): PlanVariant {
  if (plan.price === 0) return 'starter';
  if (plan.duration_days === 30 || plan.duration_days === 90) return 'most-popular';
  if (plan.duration_days === 180) return 'save-more';
  return plan.duration_days >= 365 ? 'best-value' : 'starter';
}

function getPlanOrder(plan: Plan): number {
  if (plan.price === 0) return -1;
  return plan.duration_days;
}

function dedupePlans(plans: Plan[]): Plan[] {
  const seen = new Set<string>();
  const out: Plan[] = [];
  for (const plan of plans) {
    const key = `${plan.duration_days}-${plan.price === 0 ? 'free' : 'paid'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(plan);
  }
  return out;
}

export default async function PricingPage() {
  let plans: Plan[] = [];
  try {
    plans = await getPublicPlans();
  } catch {
    // Backend not available during build, use empty
  }

  const visiblePlans = dedupePlans(plans).sort((a, b) => getPlanOrder(a) - getPlanOrder(b));

  const monthlyPricePerMonth = (plan: Plan): number | null => {
    if (plan.duration_days < 30 || plan.price === 0) return null;
    return Math.round(plan.price / (plan.duration_days / 30));
  };

  const plan1m = visiblePlans.find(p => p.duration_days === 30);
  const plan1y = visiblePlans.find(p => p.duration_days >= 365);
  const plan1mPrice = plan1m ? monthlyPricePerMonth(plan1m) : null;
  const plan1yPrice = plan1y ? monthlyPricePerMonth(plan1y) : null;

  return (
    <div className="pt-24 pb-20 px-4">
      <OfferTrigger />
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-red-600/15 border border-red-500/30 rounded-full px-4 py-1.5 text-red-400 text-sm font-medium mb-4">
            Launch Pricing — Limited Time
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">Simple, Honest Pricing</h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto mb-3">
            Try free for a day, go monthly, or save big with a full year. No auto-renewal, no hidden charges.
          </p>
          <p className="text-slate-500 text-sm">License activates immediately inside the app after payment.</p>
        </div>

        {/* Trust micro-lines */}
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-8 text-sm text-slate-400">
          {TRUST_LINES.map(t => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />{t}
            </span>
          ))}
        </div>

        {/* Recommendation strip */}
        {(plan1mPrice || plan1yPrice) && (
          <div className="max-w-2xl mx-auto bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 mb-10 text-center">
            {plan1mPrice && (
              <p className="text-slate-300 text-sm">
                <span className="text-red-400 font-semibold">Most Popular:</span> 1 Month plan for regular viewers — only ₹{plan1mPrice}/month
              </p>
            )}
            {plan1yPrice && (
              <p className="text-slate-400 text-xs mt-1">
                <span className="text-amber-400 font-semibold">Best value:</span> 1 Year plan — only ₹{plan1yPrice}/month, save the most
              </p>
            )}
          </div>
        )}

        {/* Plan cards — all plans in a single responsive grid */}
        {visiblePlans.length > 0 ? (
          <div className={
            visiblePlans.length === 3
              ? 'grid grid-cols-1 md:grid-cols-3 gap-6 mb-16'
              : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16'
          }>
            {visiblePlans.map(plan => (
              <PlanCard key={plan.id} plan={plan} variant={planVariant(plan)} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-slate-500 mb-16">
            <p className="text-lg font-medium">Plans loading...</p>
            <p className="text-sm mt-2">If plans do not appear, please refresh the page.</p>
          </div>
        )}

        {/* Trust badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {TRUST.map(t => {
            const Icon = t.icon;
            return (
              <div key={t.title} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <Icon className="w-6 h-6 text-red-400 mx-auto mb-2" />
                <h3 className="text-white text-sm font-semibold mb-1">{t.title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{t.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Billing FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-8">Billing Questions</h2>
          <FAQAccordion items={BILLING_FAQ} />
        </div>

      </div>
    </div>
  );
}
