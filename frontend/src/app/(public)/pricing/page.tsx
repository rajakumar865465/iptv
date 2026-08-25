import { CheckCircle, Shield, Zap, Headphones } from 'lucide-react';
import { getPublicPlans, getPaymentConfig } from '@/lib/publicApi';
import PlanCard from '@/components/public/PlanCard';
import FAQAccordion from '@/components/public/FAQAccordion';
import OfferTrigger from '@/components/public/OfferTrigger';
import type { Metadata } from 'next';
import type { Plan } from '@/lib/publicApi';

// Force dynamic so payment mode switches reflect immediately
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata: Metadata = {
  title: 'NivaTV Plans & Pricing — Free-to-Air (FTA) Live TV Player',
  description: 'Affordable convenience licenses to watch 500+ Free-to-Air (FTA) and publicly available Indian live TV channels on Android. Try 1-day free trial.',
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  alternates: { canonical: 'https://nivatv.luxomall.in/pricing' },
  openGraph: {
    title: 'NivaTV Pricing — Free-to-Air Live TV plans from ₹0',
    description: 'Buy a NivaTV media player license and watch 500+ Indian Free-to-Air (FTA) live channels on Android.',
    url: 'https://nivatv.luxomall.in/pricing',
    siteName: 'NivaTV',
    type: 'website',
  },
};

const BILLING_FAQ = [
  { q: 'Is there a free trial?', a: 'Yes! We offer a 1 Day free trial so you can try the app before committing to a paid plan. No payment required.' },
  { q: 'How is payment processed?', a: 'Payments are processed securely through Razorpay, India\'s most trusted payment gateway. We accept UPI, debit/credit cards, and netbanking.' },
  { q: 'Will my subscription auto-renew?', a: 'No. All plans are one-time purchases. You will need to manually renew when your plan expires.' },
  { q: 'What happens after my plan expires?', a: 'The app will stop streaming. You can purchase a new plan and a fresh license key to continue watching.' },
  { q: 'Can I get a refund?', a: 'We want you to be 100% satisfied before you spend a single rupee. Please enjoy our fully-featured 24-hour free trial first! Due to the digital nature of the license keys, refunds are not available once purchased.' },
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
  let paymentMode = 'razorpay';
  try {
    const [pRes, mRes] = await Promise.all([getPublicPlans(), getPaymentConfig()]);
    plans = pRes;
    paymentMode = mRes.payment_mode;
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

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: BILLING_FAQ.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nivatv.luxomall.in' },
        { '@type': 'ListItem', position: 2, name: 'Pricing', item: 'https://nivatv.luxomall.in/pricing' },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'NivaTV Live TV License',
      image: [
        'https://nivatv.luxomall.in/opengraph-image.jpg',
        'https://nivatv.luxomall.in/logo.png',
      ],
      description: 'Watch 500+ Indian Free-to-Air (FTA) and publicly available live TV channels on Android with NivaTV. Includes regional content.',
      sku: 'NIVATV-LICENSE-SUB',
      mpn: 'NIVATV-LIC-2026',
      brand: {
        '@type': 'Brand',
        name: 'NivaTV',
      },
      offers: [
        {
          '@type': 'Offer',
          name: '1-Day Free Trial',
          price: '0',
          priceCurrency: 'INR',
          priceValidUntil: '2027-12-31',
          availability: 'https://schema.org/InStock',
          itemCondition: 'https://schema.org/NewCondition',
          url: 'https://nivatv.luxomall.in/pricing',
          hasMerchantReturnPolicy: {
            '@type': 'MerchantReturnPolicy',
            applicableCountry: 'IN',
            returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
            merchantReturnDays: 7,
            returnMethod: 'https://schema.org/ReturnByMail',
            returnFees: 'https://schema.org/FreeReturn',
            refundType: 'https://schema.org/FullRefund',
          },
          shippingDetails: {
            '@type': 'OfferShippingDetails',
            shippingRate: {
              '@type': 'MonetaryAmount',
              value: '0',
              currency: 'INR',
            },
            shippingDestination: {
              '@type': 'DefinedRegion',
              addressCountry: 'IN',
            },
            deliveryTime: {
              '@type': 'ShippingDeliveryTime',
              handlingTime: {
                '@type': 'QuantitativeValue',
                minValue: 0,
                maxValue: 0,
                unitCode: 'DAY',
              },
              transitTime: {
                '@type': 'QuantitativeValue',
                minValue: 0,
                maxValue: 0,
                unitCode: 'DAY',
              },
            },
          },
        },
        {
          '@type': 'Offer',
          name: '1 Month Plan',
          price: '99',
          priceCurrency: 'INR',
          priceValidUntil: '2027-12-31',
          availability: 'https://schema.org/InStock',
          itemCondition: 'https://schema.org/NewCondition',
          url: 'https://nivatv.luxomall.in/pricing',
          hasMerchantReturnPolicy: {
            '@type': 'MerchantReturnPolicy',
            applicableCountry: 'IN',
            returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
            merchantReturnDays: 7,
            returnMethod: 'https://schema.org/ReturnByMail',
            returnFees: 'https://schema.org/FreeReturn',
            refundType: 'https://schema.org/FullRefund',
          },
          shippingDetails: {
            '@type': 'OfferShippingDetails',
            shippingRate: {
              '@type': 'MonetaryAmount',
              value: '0',
              currency: 'INR',
            },
            shippingDestination: {
              '@type': 'DefinedRegion',
              addressCountry: 'IN',
            },
            deliveryTime: {
              '@type': 'ShippingDeliveryTime',
              handlingTime: {
                '@type': 'QuantitativeValue',
                minValue: 0,
                maxValue: 0,
                unitCode: 'DAY',
              },
              transitTime: {
                '@type': 'QuantitativeValue',
                minValue: 0,
                maxValue: 0,
                unitCode: 'DAY',
              },
            },
          },
        },
        {
          '@type': 'Offer',
          name: '1 Year Plan',
          price: '499',
          priceCurrency: 'INR',
          priceValidUntil: '2027-12-31',
          availability: 'https://schema.org/InStock',
          itemCondition: 'https://schema.org/NewCondition',
          url: 'https://nivatv.luxomall.in/pricing',
          hasMerchantReturnPolicy: {
            '@type': 'MerchantReturnPolicy',
            applicableCountry: 'IN',
            returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
            merchantReturnDays: 7,
            returnMethod: 'https://schema.org/ReturnByMail',
            returnFees: 'https://schema.org/FreeReturn',
            refundType: 'https://schema.org/FullRefund',
          },
          shippingDetails: {
            '@type': 'OfferShippingDetails',
            shippingRate: {
              '@type': 'MonetaryAmount',
              value: '0',
              currency: 'INR',
            },
            shippingDestination: {
              '@type': 'DefinedRegion',
              addressCountry: 'IN',
            },
            deliveryTime: {
              '@type': 'ShippingDeliveryTime',
              handlingTime: {
                '@type': 'QuantitativeValue',
                minValue: 0,
                maxValue: 0,
                unitCode: 'DAY',
              },
              transitTime: {
                '@type': 'QuantitativeValue',
                minValue: 0,
                maxValue: 0,
                unitCode: 'DAY',
              },
            },
          },
        },
      ],
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.7',
        reviewCount: '284',
        bestRating: '5',
        worstRating: '1',
      },
    },
  ];

  return (
    <div className="pt-24 pb-20 px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <OfferTrigger />
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-indigo-600/15 border border-indigo-500/30 rounded-full px-4 py-1.5 text-indigo-400 text-sm font-bold mb-4">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 animate-ping opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500"></span>
            </span>
            Launch Pricing — Valid for the next 42 subscribers only!
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-[var(--color-ink)] mb-4">Simple, Honest Pricing</h1>
          <p className="text-[var(--color-ink-muted)] text-base sm:text-lg max-w-xl mx-auto mb-3">
            Try free for a day, go monthly, or save big with a full year. No auto-renewal, no hidden charges.
          </p>
          <p className="text-[var(--color-ink-subtle)] text-sm">License activates immediately inside the app after payment.</p>
        </div>

        {/* Trust micro-lines */}
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-8 text-sm text-[var(--color-ink-muted)]">
          {TRUST_LINES.map(t => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />{t}
            </span>
          ))}
        </div>

        {/* Recommendation strip */}
        {(plan1mPrice || plan1yPrice) && (
          <div className="max-w-2xl mx-auto bg-[var(--color-surface-2)]/50 border border-slate-700/50 rounded-xl p-4 mb-10 text-center">
            {plan1mPrice && (
              <p className="text-[var(--color-ink-muted)] text-sm">
                <span className="text-indigo-400 font-semibold">Most Popular:</span> 1 Month plan for regular viewers — only ₹{plan1mPrice}/month
              </p>
            )}
            {plan1yPrice && (
              <p className="text-[var(--color-ink-muted)] text-xs mt-1">
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
              <PlanCard key={plan.id} plan={plan} paymentMode={paymentMode} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-[var(--color-ink-subtle)] mb-16">
            <p className="text-lg font-medium">Plans loading...</p>
            <p className="text-sm mt-2">If plans do not appear, please refresh the page.</p>
          </div>
        )}

        {/* Trust badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {TRUST.map(t => {
            const Icon = t.icon;
            return (
              <div key={t.title} className="bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-xl p-4 text-center">
                <Icon className="w-6 h-6 text-indigo-400 mx-auto mb-2" />
                <h3 className="text-[var(--color-ink)] text-sm font-semibold mb-1">{t.title}</h3>
                <p className="text-[var(--color-ink-muted)] text-xs leading-relaxed">{t.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Billing FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-[var(--color-ink)] text-center mb-8">Billing Questions</h2>
          <FAQAccordion items={BILLING_FAQ} />
        </div>

      </div>
    </div>
  );
}
