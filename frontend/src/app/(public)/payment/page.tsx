'use client';

import { useEffect, useState, useCallback, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Script from 'next/script';
import Link from 'next/link';
import {
  ShieldCheck, Loader2, AlertCircle, Tag, Check, X,
  ArrowRight, Sparkles, Tv2, Smartphone, Zap, Lock,
  ChevronRight, RefreshCw, HelpCircle
} from 'lucide-react';
import {
  getPublicPlans, getSevenDayOffer, createOrder, getPublicErrorMessage,
  getPaymentConfig, validateCoupon, type Plan, type CouponValidationResult
} from '@/lib/publicApi';
import AuthModal from '@/components/auth/AuthModal';
import { useAuth } from '@/contexts/AuthContext';

declare global {
  interface Window {
    Razorpay: new (opts: object) => { open(): void };
  }
}

function PaymentForm() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, token, isReady, refreshUser } = useAuth();
  const planIdParam = params.get('plan_id') ? parseInt(params.get('plan_id')!) : null;
  const offerPriceParam = params.get('offer_price') ? parseInt(params.get('offer_price')!) : undefined;
  const isOfferFlow = !!offerPriceParam;

  const [paymentMode, setPaymentMode] = useState<string>('razorpay');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(planIdParam);
  const [form, setForm] = useState({ customer_name: '', email: '', mobile: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authOpen, setAuthOpen] = useState(false);

  // Coupon State
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResult | null>(null);

  // Sync user profile to form fields
  useEffect(() => {
    if (user) {
      setForm(prev => ({
        customer_name: user.full_name || prev.customer_name,
        email: user.email || prev.email,
        mobile: user.mobile || prev.mobile,
      }));
    }
  }, [user]);

  // Prompt login automatically if user lands on payment unauthenticated
  useEffect(() => {
    if (isReady && !user && !token) {
      setAuthOpen(true);
    }
  }, [isReady, user, token]);

  useEffect(() => {
    getPaymentConfig()
      .then(config => {
        if (config) {
          setPaymentMode(config.payment_mode || 'razorpay');
          if (config.payment_mode === 'manual') {
            router.replace(`/checkout?plan=${planIdParam || ''}${offerPriceParam ? `&offer_price=${offerPriceParam}` : ''}`);
            return;
          }
        }
      })
      .catch(() => {});

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
            description: 'Special Scratch Card Discount Deal',
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
  }, [isOfferFlow, offerPriceParam, planIdParam, router]);

  const selectedPlan = useMemo(() => plans.find(p => p.id === selectedPlanId), [plans, selectedPlanId]);
  const hasClaimedTrial = !!user?.has_claimed_trial || (typeof window !== 'undefined' && localStorage.getItem('nivatv_trial_claimed') === 'true');

  useEffect(() => {
    if (hasClaimedTrial && selectedPlan?.price === 0) {
      const paidPro = plans.find(p => p.id === 63 || (p.price > 0 && p.duration_days === 30)) || plans.find(p => p.price > 0);
      if (paidPro) {
        setSelectedPlanId(paidPro.id);
      }
    }
  }, [hasClaimedTrial, selectedPlan, plans]);

  // Re-validate coupon when selected plan changes
  useEffect(() => {
    if (appliedCoupon && selectedPlanId) {
      setCouponLoading(true);
      validateCoupon({
        code: appliedCoupon.code,
        plan_id: selectedPlanId,
        offer_price: offerPriceParam,
      })
        .then(res => {
          setAppliedCoupon(res);
          setCouponError('');
        })
        .catch(err => {
          setAppliedCoupon(null);
          setCouponError(getPublicErrorMessage(err, 'Coupon is not applicable to this plan.'));
        })
        .finally(() => setCouponLoading(false));
    }
  }, [selectedPlanId, offerPriceParam]);

  // Handle Apply Coupon
  const handleApplyCoupon = async (codeToApply?: string) => {
    const code = (codeToApply || couponCodeInput).trim().toUpperCase();
    if (!code) {
      setCouponError('Please enter a coupon code.');
      return;
    }
    if (!selectedPlanId) {
      setCouponError('Please select a plan first.');
      return;
    }

    setCouponLoading(true);
    setCouponError('');
    try {
      const result = await validateCoupon({
        code,
        plan_id: selectedPlanId,
        offer_price: offerPriceParam,
      });
      setAppliedCoupon(result);
      setCouponCodeInput('');
    } catch (err: any) {
      setAppliedCoupon(null);
      setCouponError(getPublicErrorMessage(err, 'Invalid or expired coupon code.'));
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError('');
  };

  // Pricing calculations
  const originalPrice = isOfferFlow && offerPriceParam !== undefined ? offerPriceParam : (selectedPlan ? Number(selectedPlan.price) : 0);
  const discountAmount = appliedCoupon ? appliedCoupon.discount_amount : 0;
  const finalPrice = Math.max(0, originalPrice - discountAmount);

  // Handle Payment Submit
  const handlePay = useCallback(async () => {
    setError('');

    // Auth Guard
    if (!user) {
      setAuthOpen(true);
      return;
    }

    if (!form.customer_name.trim() || !form.email.trim() || !form.mobile.trim()) {
      return setError('Please fill all required billing fields.');
    }
    if (!selectedPlanId) return setError('Please select a plan.');

    if (selectedPlan?.price === 0 && hasClaimedTrial) {
      return setError('You have already claimed your 1-Month Free Trial. Please select a paid plan.');
    }

    setLoading(true);
    try {
      const order = await createOrder({
        plan_id: selectedPlanId,
        ...form,
        offer_price: offerPriceParam,
        coupon_code: appliedCoupon ? appliedCoupon.code : undefined,
      });

      // Free plan or 100% off coupon
      if (order.amount === 0) {
        try {
          if (selectedPlan?.price === 0) {
            localStorage.setItem('nivatv_trial_claimed', 'true');
          }
        } catch (_) {}
        void refreshUser();
        router.push(`/payment/success?order_id=${order.order_id}`);
        return;
      }

      if (!order.key_id || order.key_id === 'mock_key') {
        throw new Error('Payment gateway not configured. Please contact support.');
      }

      // Redirect to proxy checkout with live Razorpay keys
      const returnUrl = encodeURIComponent(`${window.location.origin}/payment/success`);
      window.location.href = `https://payment.catsnamegenerator.site/api/proxy/checkout?order_id=${order.order_id}&type=public&key_id=${order.key_id}&return_url=${returnUrl}`;
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
  }, [form, selectedPlanId, selectedPlan, router, offerPriceParam, appliedCoupon, user, hasClaimedTrial]);

  const handleAuthSuccess = (u: any) => {
    setAuthOpen(false);
    setForm(prev => ({
      customer_name: u.full_name || prev.customer_name,
      email: u.email || prev.email,
      mobile: u.mobile || prev.mobile,
    }));
  };

  // If not logged in, show clean modern Sign In Required view
  if (isReady && !user && !token) {
    return (
      <>
        <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} onSuccess={handleAuthSuccess} />
        <div className="pt-28 pb-20 px-4 min-h-[75vh] flex items-center justify-center">
          <div className="max-w-md w-full bg-[var(--color-surface)] border border-[var(--color-line)] rounded-3xl p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-brand-500/10 border border-brand-500/30 text-brand-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-inner">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-extrabold text-[var(--color-ink)] mb-2">Sign In Required</h1>
            <p className="text-[var(--color-ink-muted)] text-sm mb-6 leading-relaxed">
              Please sign in before completing your order. Your live TV license key and instant stream access will be permanently linked to your account.
            </p>
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="w-full py-3.5 px-4 bg-brand-600 hover:bg-brand-500 text-white rounded-2xl font-bold text-base transition-all shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              Sign In / Create Free Account
            </button>
            <div className="mt-5">
              <Link href="/pricing" className="text-xs text-[var(--color-ink-subtle)] hover:text-[var(--color-ink)] transition-colors">
                ← Back to Plans & Pricing
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} onSuccess={handleAuthSuccess} />
      <Script id="razorpay-sdk" src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />

      <div className="pt-20 pb-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        {/* Header Breadcrumb */}
        <div className="mb-8">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors mb-3"
          >
            ← Back to Pricing
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h1 className="text-3xl font-extrabold text-[var(--color-ink)] tracking-tight">Complete Your Order</h1>
              <p className="text-[var(--color-ink-muted)] text-sm mt-1">Instant activation · Official Razorpay Checkout · 100% Secure</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-500 font-medium bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full w-fit">
              <ShieldCheck className="w-4 h-4" /> 256-Bit SSL Encrypted
            </div>
          </div>
        </div>

        {/* 2-Column Split Cart Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* LEFT COLUMN: Order Summary & Plan Features */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
            <div className="bg-[var(--color-surface)] border border-slate-200 dark:border-[var(--color-line)] rounded-3xl p-6 sm:p-7 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-6">
              
              {/* Order Card Header */}
              <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-200 dark:border-[var(--color-line)]">
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-brand-600 dark:text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2.5 py-0.5 rounded-full">
                    Selected Subscription
                  </span>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-[var(--color-ink)] mt-2">
                    {selectedPlan?.name || 'Live TV Plan'}
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-[var(--color-ink-muted)] font-medium mt-0.5">
                    {selectedPlan?.duration_days ?? 30} Days Unlimited Access · {selectedPlan?.max_devices ?? 1} Device{selectedPlan?.max_devices && selectedPlan.max_devices > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-slate-900 dark:text-[var(--color-ink)]">
                    ₹{Math.round(originalPrice)}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-[var(--color-ink-subtle)] font-medium">Billed Once</span>
                </div>
              </div>

              {/* Offer Banner if active */}
              {isOfferFlow && (
                <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5">
                  <Sparkles className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0" />
                  <div className="text-xs">
                    <p className="text-amber-600 dark:text-amber-400 font-bold">Special Scratch Card Price Applied</p>
                    <p className="text-slate-600 dark:text-[var(--color-ink-muted)] mt-0.5">
                      Regular: <span className="line-through">₹{selectedPlan?.regular_price}</span> → Special: <span className="text-amber-600 dark:text-amber-400 font-bold">₹{offerPriceParam}</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Plan Included Features */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-700 dark:text-[var(--color-ink-muted)] uppercase tracking-wider">What&apos;s Included:</p>
                <div className="space-y-2.5 text-xs text-slate-800 dark:text-[var(--color-ink)]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                    <span><strong className="text-slate-900 dark:text-white">850+ Live Channels</strong> (Hindi, Tamil, Telugu, Bengali &amp; 8 more)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                    <span><strong className="text-slate-900 dark:text-white">{selectedPlan?.max_devices ?? 1} Device Concurrent Access</strong> (Phone, TV, Tablet)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                    <span><strong className="text-slate-900 dark:text-white">Anti-Stutter &amp; Fast Buffer Engine</strong> (Clean smooth playback)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                    <span><strong className="text-slate-900 dark:text-white">Instant Key Delivery</strong> on screen &amp; synced to your account</span>
                  </div>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="pt-4 border-t border-slate-200 dark:border-[var(--color-line)] space-y-2.5 text-sm">
                <div className="flex justify-between text-slate-600 dark:text-[var(--color-ink-muted)] text-xs font-medium">
                  <span>Subtotal</span>
                  <span className="text-slate-900 dark:text-[var(--color-ink)] font-bold">₹{Math.round(originalPrice)}</span>
                </div>

                {appliedCoupon && (
                  <div className="flex justify-between items-center text-xs text-emerald-900 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 rounded-xl border border-emerald-500/30">
                    <div className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                      <span>Coupon ({appliedCoupon.code})</span>
                    </div>
                    <span className="font-black text-sm text-emerald-700 dark:text-emerald-300">- ₹{appliedCoupon.discount_amount}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-600 dark:text-[var(--color-ink-muted)] text-xs font-medium">
                  <span>Platform &amp; Gateway Fees</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">₹0 (Waived)</span>
                </div>

                <div className="flex justify-between text-slate-600 dark:text-[var(--color-ink-muted)] text-xs font-medium">
                  <span>Taxes (GST)</span>
                  <span className="text-slate-900 dark:text-[var(--color-ink)] font-semibold">Included</span>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-[var(--color-line)] flex items-baseline justify-between">
                  <span className="font-bold text-base text-slate-900 dark:text-[var(--color-ink)]">Total Due Today</span>
                  <div className="text-right">
                    <span className="text-2xl font-black text-brand-600 dark:text-brand-500">₹{Math.round(finalPrice)}</span>
                    {appliedCoupon && (
                      <p className="text-xs text-emerald-800 dark:text-emerald-400 font-bold mt-0.5">
                        🎉 You saved ₹{appliedCoupon.discount_amount}!
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Trust Badges */}
              <div className="pt-3 border-t border-slate-200 dark:border-[var(--color-line)] grid grid-cols-2 gap-3 text-xs text-slate-600 dark:text-[var(--color-ink-muted)] font-medium">
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                  <span>256-Bit SSL Secured</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                  <span>Instant Activation</span>
                </div>
              </div>

            </div>
          </div>

          {/* RIGHT COLUMN: Contact Details, Coupon Input & Razorpay Action */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-[var(--color-surface)] border border-slate-200 dark:border-[var(--color-line)] rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-6">
              
              {/* Account Pill */}
              {user && (
                <div className="flex items-center justify-between bg-slate-50 dark:bg-[var(--color-surface-2)] border border-slate-200 dark:border-[var(--color-line)] rounded-2xl px-4 py-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-brand-500/20 text-brand-600 dark:text-brand-400 font-bold flex items-center justify-center text-sm">
                      {((user.full_name || user.email || 'U')[0] || 'U').toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-[var(--color-ink)]">{user.full_name || 'Subscriber'}</p>
                      <p className="text-slate-500 dark:text-[var(--color-ink-muted)] text-[11px] font-medium">{user.email}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md font-bold border border-emerald-300 dark:border-emerald-500/20">
                    <Check className="w-3 h-3 stroke-[2.5]" /> Signed In
                  </span>
                </div>
              )}

              {/* Plan Switcher Dropdown (normal flow only) */}
              {!isOfferFlow && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[var(--color-ink-muted)] mb-2">
                    Change Subscription Plan
                  </label>
                  <select
                    value={selectedPlanId ?? ''}
                    onChange={e => setSelectedPlanId(parseInt(e.target.value))}
                    className="w-full bg-white dark:bg-[var(--color-surface-2)] border border-slate-300 dark:border-[var(--color-line)] rounded-2xl px-4 py-3.5 text-slate-900 dark:text-[var(--color-ink)] text-sm font-bold focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all shadow-xs"
                  >
                    {(hasClaimedTrial ? plans.filter(p => p.price > 0) : plans).map(p => {
                      const isTrial = p.price === 0;
                      return (
                        <option key={p.id} value={p.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                          {p.name} — {isTrial ? '₹0 (1-Month Free Trial)' : `₹${Math.round(p.price)}`} · {p.duration_days >= 365 ? `${Math.round(p.duration_days / 365)} Year` : `${p.duration_days} Days`} · {p.max_devices} Device{p.max_devices > 1 ? 's' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Contact Information Fields */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[var(--color-ink-muted)]">
                    Billing Contact Details
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-[var(--color-ink-subtle)] font-medium">License sent here</span>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 dark:text-[var(--color-ink)] mb-1.5">Full Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={form.customer_name}
                      onChange={e => setForm(prev => ({ ...prev, customer_name: e.target.value }))}
                      required
                      className="w-full bg-white dark:bg-[var(--color-surface-2)] border border-slate-300 dark:border-[var(--color-line)] rounded-2xl px-4 py-3 text-slate-900 dark:text-[var(--color-ink)] placeholder-slate-400 dark:placeholder-[var(--color-ink-subtle)] text-sm font-medium focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all shadow-2xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-[var(--color-ink)] mb-1.5">Email Address *</label>
                      <input
                        type="email"
                        placeholder="name@example.com"
                        value={form.email}
                        onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                        required
                        className="w-full bg-white dark:bg-[var(--color-surface-2)] border border-slate-300 dark:border-[var(--color-line)] rounded-2xl px-4 py-3 text-slate-900 dark:text-[var(--color-ink)] placeholder-slate-400 dark:placeholder-[var(--color-ink-subtle)] text-sm font-medium focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-[var(--color-ink)] mb-1.5">WhatsApp Mobile *</label>
                      <input
                        type="tel"
                        placeholder="9876543210"
                        value={form.mobile}
                        onChange={e => setForm(prev => ({ ...prev, mobile: e.target.value }))}
                        required
                        className="w-full bg-white dark:bg-[var(--color-surface-2)] border border-slate-300 dark:border-[var(--color-line)] rounded-2xl px-4 py-3 text-slate-900 dark:text-[var(--color-ink)] placeholder-slate-400 dark:placeholder-[var(--color-ink-subtle)] text-sm font-medium focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all shadow-2xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* COUPON & PROMO CODE SECTION */}
              <div className="pt-2 border-t border-slate-200 dark:border-[var(--color-line)] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[var(--color-ink-muted)] flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-brand-600 dark:text-brand-500" />
                    Promo / Coupon Code
                  </label>
                  {appliedCoupon && (
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 stroke-[3]" /> Code Applied
                    </span>
                  )}
                </div>

                {appliedCoupon ? (
                  // Applied Coupon State
                  <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500/50 dark:border-emerald-500/40 rounded-2xl px-4 py-3.5 text-sm shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
                        %
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-emerald-900 dark:text-emerald-200 tracking-wider text-base">
                            {appliedCoupon.code}
                          </span>
                          <span className="text-xs bg-emerald-700 text-white dark:bg-emerald-500 dark:text-emerald-950 px-2.5 py-0.5 rounded-full font-black shadow-xs tracking-wide">
                            {appliedCoupon.formatted_discount}
                          </span>
                        </div>
                        {appliedCoupon.description && (
                          <p className="text-xs text-emerald-950 dark:text-emerald-200/90 font-bold mt-1">
                            {appliedCoupon.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      title="Remove coupon"
                      className="text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5 stroke-[2.5]" />
                    </button>
                  </div>
                ) : (
                  // Input State
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="Enter coupon code (e.g. WELCOME10)"
                          value={couponCodeInput}
                          onChange={e => {
                            setCouponCodeInput(e.target.value.toUpperCase());
                            setCouponError('');
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleApplyCoupon();
                            }
                          }}
                          className="w-full bg-white dark:bg-[var(--color-surface-2)] border border-slate-300 dark:border-[var(--color-line)] rounded-2xl px-4 py-3 text-slate-900 dark:text-[var(--color-ink)] placeholder-slate-400 dark:placeholder-[var(--color-ink-subtle)] text-sm font-mono font-bold uppercase tracking-wider focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all shadow-2xs"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleApplyCoupon()}
                        disabled={couponLoading || !couponCodeInput.trim()}
                        className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white/10 dark:text-white dark:hover:bg-white/20 disabled:opacity-50 border border-slate-900 dark:border-white/10 rounded-2xl text-sm font-bold transition-all cursor-pointer shrink-0 shadow-xs"
                      >
                        {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                      </button>
                    </div>

                    {/* Quick suggestion pills */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                      <span className="text-slate-600 dark:text-[var(--color-ink-subtle)] font-bold">Try:</span>
                      <button
                        type="button"
                        onClick={() => handleApplyCoupon('WELCOME10')}
                        className="px-2.5 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-500/10 dark:hover:bg-brand-500/20 dark:text-brand-400 border border-brand-300 dark:border-brand-500/20 rounded-lg font-mono font-bold transition-colors cursor-pointer shadow-2xs"
                      >
                        WELCOME10 (10% OFF)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyCoupon('SAVE50')}
                        className="px-2.5 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-500/10 dark:hover:bg-brand-500/20 dark:text-brand-400 border border-brand-300 dark:border-brand-500/20 rounded-lg font-mono font-bold transition-colors cursor-pointer shadow-2xs"
                      >
                        SAVE50 (₹50 OFF)
                      </button>
                    </div>
                  </div>
                )}

                {couponError && (
                  <p className="text-xs text-red-400 flex items-center gap-1.5 pt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {couponError}
                  </p>
                )}
              </div>

              {/* Error Banner */}
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-2xl flex items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* PRIMARY ACTION CTA */}
              <button
                type="button"
                onClick={handlePay}
                disabled={loading || !selectedPlan}
                className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl bg-brand-600 hover:bg-brand-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-extrabold text-base transition-all shadow-xl shadow-brand-600/25 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>
                      {selectedPlan
                        ? finalPrice === 0
                          ? 'Claim 100% Free Access Now'
                          : `Pay ₹${Math.round(finalPrice)} Securely`
                        : 'Proceed to Payment'}
                    </span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              {/* Supported payment methods & guarantee */}
              <div className="pt-2 text-center space-y-2">
                <p className="text-xs text-slate-600 dark:text-[var(--color-ink-muted)] font-medium">
                  Guaranteed safe checkout via <strong className="text-slate-900 dark:text-[var(--color-ink)] font-bold">Razorpay Live Gateway</strong>
                </p>
                <div className="flex items-center justify-center gap-3 text-xs text-slate-600 dark:text-[var(--color-ink-subtle)] font-semibold">
                  <span>UPI (GPay / PhonePe / Paytm)</span>
                  <span>·</span>
                  <span>Credit / Debit Cards</span>
                  <span>·</span>
                  <span>Netbanking</span>
                </div>
              </div>

              {/* Manual UPI fallback if mode is both */}
              {paymentMode === 'both' && selectedPlan && (
                <div className="pt-4 border-t border-[var(--color-line)] text-center">
                  <p className="text-xs text-[var(--color-ink-muted)] mb-1.5">Need to pay via QR code transfer?</p>
                  <Link
                    href={`/checkout?plan=${selectedPlan.id}${offerPriceParam ? `&offer_price=${offerPriceParam}` : ''}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-500 hover:text-brand-400"
                  >
                    Pay with Direct QR / UTR Reference &rarr;
                  </Link>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="pt-32 text-center text-[var(--color-ink-muted)]">Loading checkout...</div>}>
      <PaymentForm />
    </Suspense>
  );
}
