'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Script from 'next/script';
import { ShieldCheck, Loader2, AlertCircle, Tag } from 'lucide-react';
import { getPublicPlans, getSevenDayOffer, createOrder, verifyPayment, getPublicErrorMessage } from '@/lib/publicApi';
import type { Plan } from '@/lib/publicApi';
import AuthModal from '@/components/auth/AuthModal';

declare global {
  interface Window {
    Razorpay: new (opts: object) => { open(): void };
  }
}

const loadRazorpay = () =>
  new Promise<boolean>((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) return resolve(true);

    // If script exists but Razorpay isn't loaded, it might have failed previously (e.g. adblocker).
    // Let's remove it and try injecting a fresh one just in case they disabled their adblocker.
    const existingScript = document.querySelector<HTMLScriptElement>('script[src*="checkout.razorpay.com"]');
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.id = 'razorpay-checkout-js';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);

    // Safety timeout
    setTimeout(() => {
      if (typeof window !== 'undefined' && window.Razorpay) resolve(true);
      else resolve(false);
    }, 8000);
  });

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
  const [user, setUser] = useState<any>(null);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    // Check if logged in to pre-fill form
    const token = localStorage.getItem('adminToken');
    if (token) {
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          if (data.data?.user) {
            setUser(data.data.user);
            setForm(prev => ({
              customer_name: data.data.user.full_name || prev.customer_name,
              email: data.data.user.email || prev.email,
              mobile: data.data.user.mobile || prev.mobile,
            }));
          }
        })
        .catch(() => {});
    }

    if (isOfferFlow) {
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
    
    // Auth Guard
    if (!user) {
      setAuthOpen(true);
      return;
    }

    if (!form.customer_name.trim() || !form.email.trim() || !form.mobile.trim()) {
      return setError('Please fill all fields.');
    }
    if (!selectedPlanId) return setError('Please select a plan.');

    setLoading(true);
    try {
      const order = await createOrder({ plan_id: selectedPlanId, ...form, offer_price: offerPriceParam });

      if (order.amount === 0) {
        router.push(`/payment/success?order_id=${order.order_id}`);
        return;
      }

      if (!order.key_id || order.key_id === 'mock_key') {
        throw new Error('Payment gateway not configured. Please contact support.');
      }

      // Redirect to proxy checkout
      const returnUrl = encodeURIComponent(`${window.location.origin}/payment/success`);
      window.location.href = `https://luxomall.pdf-cropper.site/api/proxy/checkout?order_id=${order.order_id}&type=public&key_id=${order.key_id}&return_url=${returnUrl}`;
    } catch (err: any) {
      const errorText = err.response?.data?.error || err.response?.data?.message || '';
      if (err.response?.status === 409 && errorText.includes('UPI')) {
        router.push(`/checkout?plan=${selectedPlanId}${offerPriceParam ? `&offer_price=${offerPriceParam}` : ''}`);
        return;
      }
      const msg = getPublicErrorMessage(err, 'Failed to initiate payment. Please try again.');
      setError(msg);
      setLoading(false);
    }
  }, [form, selectedPlanId, router, offerPriceParam, user]);

  const handleAuthSuccess = (u: any) => {
    setUser(u);
    setForm(prev => ({
      customer_name: u.full_name || prev.customer_name,
      email: u.email || prev.email,
      mobile: u.mobile || prev.mobile,
    }));
  };

  return (
    <>
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} onSuccess={handleAuthSuccess} />
      <Script id="razorpay-sdk" src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <div className="pt-24 pb-20 px-4">
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
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500/50"
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
            <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-xl px-4 py-3 text-sm">
              <span className="text-indigo-400 font-semibold">{selectedPlan.name}</span>
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
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          ))}

          {error && (
            <div className="flex items-center gap-2 bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 text-sm px-4 py-3 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <button
            onClick={handlePay}
            disabled={loading || !selectedPlan}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-base transition-colors"
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
    </>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="pt-32 text-center text-slate-400">Loading...</div>}>
      <PaymentForm />
    </Suspense>
  );
}
