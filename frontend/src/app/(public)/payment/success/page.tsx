'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Download, Key, Headphones, AlertCircle, Loader2 } from 'lucide-react';
import { getOrderStatus } from '@/lib/publicApi';
import type { OrderStatus } from '@/lib/publicApi';
import LicenseKeyDisplay from '@/components/public/LicenseKeyDisplay';
import { markTrialUsed } from '@/lib/behaviorTracker';
import confetti from 'canvas-confetti';

const ACTIVATION_STEPS = [
  'Download & install the NivaTV APK.',
  'Open the app and create an account or log in.',
  'Go to License Activation in the app.',
  'Paste your license key and tap Activate.',
  'Start watching 500+ live channels!',
];

function SuccessContent() {
  const params = useSearchParams();
  const orderId = params.get('order_id');
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) { void Promise.resolve().then(() => { setError('No order ID found.'); setLoading(false); }); return; }
    getOrderStatus(orderId)
      .then(data => {
        setOrder(data);
        // Mark trial used so the scratch card offer fires on next visit
        if (data.amount === 0 || (data.duration_days !== null && data.duration_days <= 1)) {
          markTrialUsed();
        }
        if (data.license_key) {
          const duration = 3 * 1000;
          const animationEnd = Date.now() + duration;
          const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
          
          const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;
          
          const interval: any = setInterval(function() {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) {
              return clearInterval(interval);
            }
            const particleCount = 50 * (timeLeft / duration);
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
          }, 250);
        }
      })
      .catch(() => setError('Could not load order details. Contact support.'))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return (
      <div className="pt-32 text-center">
        <Loader2 className="w-8 h-8 text-red-400 animate-spin mx-auto mb-3" />
        <p className="text-[var(--color-ink-muted)]">Loading your license...</p>
      </div>
    );
  }

  if (error || !order?.license_key) {
    return (
      <div className="pt-24 pb-20 px-4 max-w-md mx-auto text-center">
        <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-[var(--color-ink)] mb-3">Something went wrong</h1>
        <p className="text-[var(--color-ink-muted)] mb-6">{error || 'License key not found for this order. Contact support.'}</p>
        <Link href="/support" className="px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 dark:hover:bg-brand-400 text-white font-semibold text-sm transition-colors">
          Contact Support
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-20 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Success banner */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-9 h-9 text-green-400" />
          </div>
          <h1 className="text-4xl font-extrabold text-[var(--color-ink)] mb-2">Payment Successful!</h1>
          <p className="text-[var(--color-ink-muted)]">Your license key is ready. Copy it and activate your app.</p>
        </div>

        {/* License key */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl p-6 mb-6">
          <h2 className="text-[var(--color-ink)] font-bold mb-1">Your License Key</h2>
          <p className="text-[var(--color-ink-muted)] text-xs mb-4">Save this key — you will need it to activate the app.</p>
          <LicenseKeyDisplay licenseKey={order.license_key} />

          <div className="grid grid-cols-2 gap-4 mt-5">
            <div className="bg-[var(--color-surface)] rounded-xl p-3">
              <p className="text-[var(--color-ink-muted)] text-xs mb-0.5">Plan</p>
              <p className="text-[var(--color-ink)] font-semibold text-sm">{order.plan_name}</p>
            </div>
            <div className="bg-[var(--color-surface)] rounded-xl p-3">
              <p className="text-[var(--color-ink-muted)] text-xs mb-0.5">Duration</p>
              <p className="text-[var(--color-ink)] font-semibold text-sm">
                {order.duration_days && order.duration_days >= 365
                  ? `${Math.round(order.duration_days / 365)} Year`
                  : order.duration_days && order.duration_days >= 30
                  ? `${Math.round(order.duration_days / 30)} Month${order.duration_days >= 60 ? 's' : ''}`
                  : `${order.duration_days} Days`}
              </p>
            </div>
            <div className="bg-[var(--color-surface)] rounded-xl p-3">
              <p className="text-[var(--color-ink-muted)] text-xs mb-0.5">Max Devices</p>
              <p className="text-[var(--color-ink)] font-semibold text-sm">{order.max_devices} Device{(order.max_devices ?? 0) > 1 ? 's' : ''}</p>
            </div>
            <div className="bg-[var(--color-surface)] rounded-xl p-3">
              <p className="text-[var(--color-ink-muted)] text-xs mb-0.5">Status</p>
              <p className="text-green-400 font-semibold text-sm capitalize">{order.license_status}</p>
            </div>
          </div>
        </div>

        {/* Activation steps */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl p-6 mb-6">
          <h2 className="text-[var(--color-ink)] font-bold mb-5">How to Activate</h2>
          <ol className="space-y-3">
            {ACTIVATION_STEPS.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 shrink-0 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="text-[var(--color-ink-muted)] text-sm leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/download" className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 dark:hover:bg-brand-400 text-white font-semibold text-sm transition-colors">
            <Download className="w-4 h-4" /> Download APK
          </Link>
          <Link href="/license" className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)] text-[var(--color-ink)] font-semibold text-sm transition-colors border border-[var(--color-line)]">
            <Key className="w-4 h-4" /> Check License Status
          </Link>
          <Link href="/support" className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)] text-[var(--color-ink)] font-semibold text-sm transition-colors border border-[var(--color-line)]">
            <Headphones className="w-4 h-4" /> Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="pt-32 text-center text-[var(--color-ink-muted)]">Loading...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
