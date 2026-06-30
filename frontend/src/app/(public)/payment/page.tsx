'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Script from 'next/script';
import { ShieldCheck, Loader2, AlertCircle, Tag } from 'lucide-react';
import { getPublicPlans, getSevenDayOffer, createOrder, verifyPayment } from '@/lib/publicApi';
import type { Plan } from '@/lib/publicApi';

declare global {
  interface Window {
    Razorpay: new (opts: object) => { open(): void };
  }
}

function PaymentForm() {
  const params = useSearchParams();
  const router = useRouter();
  const planIdParam = params.get('plan_id') ? parseInt(params.get('plan_id')!) : null;
  const offerPriceParam = params.get('offer_price') ? parseInt(params.get('offer_price')!) : undefined;
  const isOfferFlow = !!offerPriceParam;

  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(planIdParam);
  const [form, setForm] = useState({ customer_name: '', email: '', mobile: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOfferFlow) {
      // Scratch card flow: fetch hidden offer plan
      getSevenDayOffer()
        .then(plan => {
          const offerAsPlan: Plan = {
            id: plan.id,
            name: plan.name,
            price: offerPriceParam!,
            regular_price: plan.price,
            duration_days: plan.duration_days,
            max_devices: plan.max_devices,
            description: 'Special offer — scratch card deal',
            sort_order: 0,
            offer_label: 'Special Offer',
            is_popular: false,
            is_best_value: false,
          };
          setPlans([offerAsPlan]);
          setSelectedPlanId(plan.id);
        })
        .catch(() => setError('Failed to load offer plan. Please go back and try again.'));
    } else {
      // Normal flow: fetch public plans
      getPublicPlans()
        .then(p => {
          setPlans(p);
          if (!selectedPlanId && p.length > 0) setSelectedPlanId(p[0].id);
          else if (planIdParam && p.find(x => x.id === planIdParam)) setSelectedPlanId(planIdParam);
        })
        .catch(() => setError('Failed to load plans. Please refresh the page.'));
    }
  }, []);

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  const handlePay = useCallback(async () => {
    setError('');
    if (!form.customer_name.trim() || !form.email.trim() || !form.mobile.trim()) {
      return setError('Please fill all fields.');
    }
    if (!selectedPlanId) return setError('Please select a plan.');
    if (!window.Razorpay) return setError('Payment gateway not loaded. Please refresh.');

    setLoading(true);
    try {
      const order = await createOrder({ plan_id: selectedPlanId, ...form, offer_price: offerPriceParam });

      if (!order.key_id || order.key_id === 'mock_key') {
        throw new Error('Payment gateway not configured. Please contact support.');
      }

      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'NivaTV',
        description: order.plan_name,
        order_id: order.order_id,
        prefill: { name: order.customer_name, email: order.email, contact: order.mobile },
        theme: { color: '#ef4444' },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            router.push(`/payment/success?order_id=${response.razorpay_order_id}`);
          } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || 'Payment verification failed. Please contact support.';
            alert(msg);
            router.push(`/payment/failed?order_id=${response.razorpay_order_id}`);
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });
      rzp.open();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to initiate payment. Please try again.';
      setError(msg);
      setLoading(false);
    }
  }, [form, selectedPlanId, router, offerPriceParam]);

  return (
    <div className="pt-24 pb-20 px-4">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-white mb-2">Complete Purchase</h1>
          <p className="text-slate-400 text-sm">Your license key will be shown immediately after payment.</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">

          {/* Offer banner */}
          {isOfferFlow && selectedPlan && (
            <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
              <Tag className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-amber-300 font-bold text-sm">Special Scratch Card Offer</p>
                <p className="text-slate-400 text-xs">
                  {selectedPlan.duration_days} Days Access ·{' '}
                  <span className="line-through text-slate-500 mr-1">₹{Math.round(selectedPlan.regular_price ?? 49)}</span>
                  <span className="text-amber-400 font-semibold">₹{offerPriceParam}</span>
                </p>
              </div>
            </div>
          )}

          {/* Plan selector — only shown in normal flow */}
          {!isOfferFlow && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Select Plan</label>
              <select
                value={selectedPlanId ?? ''}
                onChange={e => setSelectedPlanId(parseInt(e.target.value))}
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500/50"
              >
                {plans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ₹{Math.round(p.price)} / {p.duration_days >= 365 ? `${Math.round(p.duration_days / 365)}yr` : p.duration_days >= 30 ? `${Math.round(p.duration_days / 30)}mo` : `${p.duration_days}d`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Selected plan summary */}
          {selectedPlan && !isOfferFlow && (
            <div className="bg-red-600/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm">
              <span className="text-red-400 font-semibold">{selectedPlan.name}</span>
              <span className="text-slate-400 ml-2">· ₹{Math.round(selectedPlan.price)} · {selectedPlan.max_devices} device{selectedPlan.max_devices > 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Form fields */}
          {[
            { name: 'customer_name', label: 'Full Name', type: 'text', placeholder: 'Rahul Kumar' },
            { name: 'email', label: 'Email Address', type: 'email', placeholder: 'rahul@example.com' },
            { name: 'mobile', label: 'Mobile Number', type: 'tel', placeholder: '9999999999' },
          ].map(f => (
            <div key={f.name}>
              <label className="block text-sm font-medium text-slate-300 mb-2">{f.label}</label>
              <input
                type={f.type}
                placeholder={f.placeholder}
                value={form[f.name as keyof typeof form]}
                onChange={e => setForm(prev => ({ ...prev, [f.name]: e.target.value }))}
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-red-500/50"
              />
            </div>
          ))}

          {error && (
            <div className="flex items-center gap-2 bg-red-600/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <button
            onClick={handlePay}
            disabled={loading || !selectedPlan}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-base transition-colors"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {loading
              ? 'Processing...'
              : selectedPlan
                ? `Pay ₹${isOfferFlow ? offerPriceParam : Math.round(selectedPlan.price)} Securely`
                : 'Pay Securely'}
          </button>

          <div className="flex items-center justify-center gap-2 text-slate-500 text-xs">
            <ShieldCheck className="w-4 h-4 text-green-500" />
            Secured by Razorpay · UPI · Cards · Netbanking
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="pt-32 text-center text-slate-400">Loading...</div>}>
      <PaymentForm />
    </Suspense>
  );
}
