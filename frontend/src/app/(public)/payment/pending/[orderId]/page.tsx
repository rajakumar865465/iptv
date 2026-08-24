'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getManualOrder } from '@/lib/publicApi';
import { Clock, CheckCircle, XCircle, MessageCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

function PendingPaymentContent() {
  const { orderId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const data = await getManualOrder(orderId as string, { email: email || '' });
      setOrder(data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll every 10 seconds if pending
    const interval = setInterval(() => {
      if (order?.status === 'pending' || !order) {
        fetchStatus();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [orderId, order?.status]);

  if (loading) {
    return <div className="min-h-screen pt-32 text-center text-[var(--color-ink-muted)]">Loading order status...</div>;
  }

  if (!order) {
    return (
      <div className="min-h-screen pt-32 text-center text-[var(--color-ink-muted)]">
        Order not found. <Link href="/pricing" className="text-indigo-400 underline">Return to pricing</Link>
      </div>
    );
  }

  // Admin WhatsApp Number (should match env, hardcoded for UI presentation as per plan)
  const whatsappNumber = '919876543210';
  const whatsappMsg = `Hello NivaTV Admin,\n\nI have made a payment. Please verify and activate my subscription.\n\n*Order ID:* ${order.order_id}\n*Plan:* ${order.plan_name}\n*Amount:* ₹${order.amount}\n*UTR:* ${order.utr_number}\n*Name:* ${order.full_name}\n\nI am attaching the payment screenshot below:`;
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMsg)}`;

  return (
    <div className="min-h-screen pt-24 px-4 bg-[var(--color-base)] pb-20">
      <div className="max-w-xl mx-auto">
        
        {order.status === 'pending' && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-8 text-center shadow-xl">
            <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="w-10 h-10 text-amber-500 animate-pulse" />
            </div>
            <h1 className="text-3xl font-bold text-[var(--color-ink)] mb-2">Verification Pending</h1>
            <p className="text-[var(--color-ink-muted)] mb-6">
              Your payment of <span className="text-[var(--color-ink)] font-semibold">₹{order.amount}</span> with UTR <span className="text-[var(--color-ink)] font-mono">{order.utr_number}</span> has been submitted.
            </p>
            
            <div className="bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-xl p-4 mb-8 text-left">
              <h3 className="font-semibold text-[var(--color-ink-muted)] mb-2 text-sm uppercase tracking-wider">Next Steps:</h3>
              <ol className="list-decimal list-inside text-[var(--color-ink-muted)] text-sm space-y-2">
                <li>Take a screenshot of your successful payment.</li>
                <li>Click the WhatsApp button below to send it to us.</li>
                <li>Our admin will verify the payment and activate your subscription shortly.</li>
              </ol>
            </div>

            <a 
              href={whatsappUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full py-4 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-bold text-lg shadow-lg shadow-[#25D366]/20 transition-all hover:-translate-y-1"
            >
              <MessageCircle className="w-6 h-6" />
              Send Screenshot on WhatsApp
            </a>
            <p className="text-xs text-slate-500 mt-4">Order ID: {order.order_id}</p>
          </div>
        )}

        {order.status === 'approved' && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-8 text-center shadow-xl">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
            <h1 className="text-3xl font-bold text-[var(--color-ink)] mb-2">Payment Approved!</h1>
            <p className="text-[var(--color-ink-muted)] mb-6">
              Your subscription for <strong>{order.plan_name}</strong> is now active.
            </p>

            {order.license_key && (
              <div className="bg-[var(--color-surface-2)] border border-emerald-500/30 rounded-xl p-4 mb-6">
                <p className="text-[var(--color-ink-muted)] text-sm mb-1">Your License Key</p>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-2xl font-mono text-emerald-400 font-bold">{order.license_key}</span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(order.license_key);
                      alert('License key copied!');
                    }}
                    className="p-2 bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] rounded-lg text-[var(--color-ink-muted)]"
                    title="Copy License Key"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2">Save this key to access your stream on any device.</p>
              </div>
            )}

            <Link 
              href="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all"
            >
              Start Watching <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {order.status === 'rejected' && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-8 text-center shadow-xl">
            <div className="w-20 h-20 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-rose-500" />
            </div>
            <h1 className="text-3xl font-bold text-[var(--color-ink)] mb-2">Payment Rejected</h1>
            <p className="text-[var(--color-ink-muted)] mb-4">
              We could not verify your payment.
            </p>
            {order.rejection_reason && (
              <div className="bg-[var(--color-surface-2)] border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm mb-6 text-left">
                <strong>Reason:</strong> {order.rejection_reason}
              </div>
            )}
            <Link 
              href="/pricing"
              className="inline-block px-8 py-3 bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-white rounded-xl font-bold transition-all border border-[var(--color-line)]"
            >
              Try Again
            </Link>
            
            <div className="mt-8 pt-6 border-t border-[var(--color-line)]">
              <p className="text-slate-500 text-sm mb-3">If you believe this is a mistake, contact support.</p>
              <a 
                href={whatsappUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full py-3 bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 hover:bg-[#25D366]/20 rounded-xl font-semibold text-sm transition-all"
              >
                <MessageCircle className="w-5 h-5" />
                Contact Support via WhatsApp
              </a>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function PendingPaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen pt-32 text-center text-[var(--color-ink-muted)]">Loading order status...</div>}>
      <PendingPaymentContent />
    </Suspense>
  );
}
