'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getPublicPlans, createManualOrder, getSevenDayOffer, getPaymentConfig } from '@/lib/publicApi';
import { Copy, CheckCircle, Shield, AlertTriangle } from 'lucide-react';
import type { Plan } from '@/lib/publicApi';

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get('plan');
  const offerPrice = searchParams.get('offer_price');

  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    mobile: '',
    utr_number: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_note: ''
  });
  
  const [copied, setCopied] = useState(false);

  const [upiId, setUpiId] = useState('nivatv@upi');
  const [merchantName, setMerchantName] = useState('NivaTV');

  const [paymentMode, setPaymentMode] = useState<string>('manual');

  useEffect(() => {
    if (!planId) {
      router.push('/pricing');
      return;
    }
    Promise.all([
      getPublicPlans(),
      getPaymentConfig().catch(() => null)
    ]).then(async ([plans, config]) => {
      if (config) {
        setPaymentMode(config.payment_mode || 'manual');
        if (config.payment_mode === 'razorpay') {
          router.replace(`/payment?plan_id=${planId}${offerPrice ? `&offer_price=${offerPrice}` : ''}`);
          return;
        }
        if (config.upi_id) setUpiId(config.upi_id);
        if (config.upi_merchant_name) setMerchantName(config.upi_merchant_name);
      }
      let p = plans.find(p => p.id.toString() === planId);
      if (!p) {
        try {
          const offer = await getSevenDayOffer();
          if (offer.id.toString() === planId) {
            p = { ...offer, duration_days: 7 } as unknown as Plan;
          }
        } catch(e) {}
      }
      if (p) setPlan(p);
      else router.push('/pricing');
      
      setLoading(false);
    });
  }, [planId, router, offerPrice]);

  const handleCopy = () => {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await createManualOrder({
        ...form,
        plan_id: plan.id,
        ...(offerPrice && { offer_price: Number(offerPrice) }),
      });
      router.push(`/payment/pending/${res.order_id}?email=${encodeURIComponent(form.email)}`);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Payment submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center h-64 items-center"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!plan) return null;

  // Generate UPI URI
  const finalPrice = offerPrice ? Number(offerPrice) : plan.price;
  const upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${finalPrice}&cu=INR`;
  // Using a free QR code generator API for the URI
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUri)}`;

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 py-8">
      {/* Left Column - Payment Info & QR */}
      <div className="bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-2xl p-6 shadow-xl">
        <h2 className="text-2xl font-bold text-[var(--color-ink)] mb-6">Complete Your Payment</h2>
        
        <div className="bg-[var(--color-surface)] rounded-xl p-4 mb-6 border border-[var(--color-line)]">
          <h3 className="text-[var(--color-ink-muted)] text-sm mb-1">Selected Plan</h3>
          <div className="flex justify-between items-center">
            <span className="text-xl font-bold text-[var(--color-ink)]">{plan.name}</span>
            <span className="text-2xl font-black text-brand-500">₹{Math.round(finalPrice)}</span>
          </div>
          <p className="text-[var(--color-ink-muted)] text-sm mt-1">{plan.duration_days} Days Access • {plan.max_devices} Device</p>
        </div>

        <div className="flex flex-col items-center bg-white rounded-xl p-6 mb-6">
          <p className="text-slate-800 font-bold mb-4">Scan & Pay with any UPI App</p>
          <img src={qrUrl} alt="UPI QR Code" className="w-48 h-48 mb-4" />
          <div className="flex items-center gap-4 text-slate-600">
            <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo-vector.svg" className="h-6" alt="UPI" />
            <span className="font-medium text-sm">GPay, PhonePe, Paytm</span>
          </div>
        </div>

        <div className="bg-[var(--color-surface)] rounded-xl p-4 flex items-center justify-between border border-[var(--color-line)]">
          <div>
            <p className="text-[var(--color-ink-muted)] text-xs mb-1">Or Pay to UPI ID</p>
            <p className="text-[var(--color-ink)] font-mono">{upiId}</p>
          </div>
          <button 
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)] rounded-lg text-sm text-[var(--color-ink)] transition-colors"
          >
            {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Right Column - Submission Form */}
      <div className="bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-2xl p-6 shadow-xl">
        <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4">Submit Payment Details</h2>
        <p className="text-[var(--color-ink-muted)] text-sm mb-6">
          After making the payment, enter your Transaction ID (UTR) below to activate your subscription.
        </p>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl mb-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[var(--color-ink-muted)] text-sm mb-1.5">Full Name</label>
            <input required type="text" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} className="w-full bg-[var(--color-surface)] border border-[var(--color-line)] rounded-xl px-4 py-2.5 text-[var(--color-ink)] focus:outline-none focus:border-brand-500" placeholder="e.g. Rahul Kumar" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[var(--color-ink-muted)] text-sm mb-1.5">Email</label>
              <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full bg-[var(--color-surface)] border border-[var(--color-line)] rounded-xl px-4 py-2.5 text-[var(--color-ink)] focus:outline-none focus:border-brand-500" placeholder="your@email.com" />
            </div>
            <div>
              <label className="block text-[var(--color-ink-muted)] text-sm mb-1.5">Mobile Number</label>
              <input required type="tel" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} className="w-full bg-[var(--color-surface)] border border-[var(--color-line)] rounded-xl px-4 py-2.5 text-[var(--color-ink)] focus:outline-none focus:border-brand-500" placeholder="10-digit number" />
            </div>
          </div>

          <div>
            <label className="block text-[var(--color-ink-muted)] text-sm mb-1.5">Transaction ID / UTR Number</label>
            <input required type="text" value={form.utr_number} onChange={e => setForm({...form, utr_number: e.target.value})} className="w-full bg-[var(--color-surface)] border border-[var(--color-line)] rounded-xl px-4 py-2.5 text-[var(--color-ink)] focus:outline-none focus:border-brand-500 font-mono" placeholder="12-digit UTR (e.g. 312345678901)" />
            <p className="text-[var(--color-ink-muted)] text-xs mt-1.5">Find this in your payment app history (labeled as UTR or Ref No).</p>
          </div>

          <div className="pt-4">
            <button 
              type="submit" 
              disabled={submitting}
              className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 dark:hover:bg-brand-400 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-lg shadow-brand-500/20 flex justify-center items-center gap-2"
            >
              {submitting ? 'Submitting...' : 'Submit Payment'}
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 text-[var(--color-ink-muted)] text-xs mt-4">
            <Shield className="w-4 h-4" />
            <span>Secure Manual Verification</span>
          </div>

          {paymentMode === 'both' && (
            <div className="mt-4 pt-4 border-t border-[var(--color-line)] text-center">
              <p className="text-xs text-[var(--color-ink-muted)] mb-2">Want instant automated activation?</p>
              <Link 
                href={`/payment?plan_id=${plan.id}${offerPrice ? `&offer_price=${offerPrice}` : ''}`}
                className="inline-block text-xs font-semibold text-brand-500 hover:text-brand-400 underline"
              >
                Pay Online via Razorpay / Cards / Netbanking &rarr;
              </Link>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <div className="min-h-screen pt-24 px-4 bg-[var(--color-base)]">
      <Suspense fallback={<div className="text-center text-[var(--color-ink-muted)] py-10">Loading...</div>}>
        <CheckoutContent />
      </Suspense>
    </div>
  );
}
