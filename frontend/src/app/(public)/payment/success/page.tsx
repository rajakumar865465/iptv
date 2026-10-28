'use client';
import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Download, Key, Headphones, AlertCircle, Loader2 } from 'lucide-react';
import { getOrderStatus } from '@/lib/publicApi';
import type { OrderStatus } from '@/lib/publicApi';
import LicenseKeyDisplay from '@/components/public/LicenseKeyDisplay';
import { markTrialUsed } from '@/lib/behaviorTracker';
import confetti from 'canvas-confetti';
import { Fireworks } from 'fireworks-js';

const ACTIVATION_STEPS = [
  'Download & install the NivaTV APK.',
  'Open the app and create an account or log in.',
  'Go to License Activation in the app.',
  'Paste your license key and tap Activate.',
  'Start watching 500+ live channels!',
];

// Play celebratory gentle chime using native Web Audio API (100% native, zero external assets)
function playCelebrationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.11);
      gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.11 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.11);
      osc.stop(ctx.currentTime + idx * 0.11 + 0.4);
    });
  } catch {
    // Autoplay restrictions or unsupported
  }
}

function SuccessContent() {
  const params = useSearchParams();
  const orderId = params.get('order_id');
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fireworksContainerRef = useRef<HTMLDivElement>(null);
  const fireworksRef = useRef<Fireworks | null>(null);

  // Premium celebration animation (fireworks-js + canvas-confetti)
  const launchCelebration = () => {
    if (typeof window === 'undefined') return;

    // Respect reduced-motion accessibility preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    // Clean up any running instance
    if (fireworksRef.current) {
      try {
        fireworksRef.current.stop(true);
        fireworksRef.current.clear();
      } catch (_) {}
    }

    playCelebrationChime();

    // 1. Fireworks-js realistic colorful fireworks and glowing rocket trails
    if (fireworksContainerRef.current) {
      try {
        const fw = new Fireworks(fireworksContainerRef.current, {
          autoresize: true,
          opacity: 0.85,
          acceleration: 1.05,
          friction: 0.97,
          gravity: 1.5,
          particles: 65,
          traceLength: 3,
          traceSpeed: 10,
          explosion: 6,
          intensity: 28,
          flickering: 50,
          lineStyle: 'round',
          hue: { min: 0, max: 360 },
          delay: { min: 25, max: 45 },
          rocketsPoint: { min: 10, max: 90 },
          lineWidth: { explosion: { min: 1, max: 3 }, trace: { min: 1, max: 2 } },
          brightness: { min: 55, max: 85 },
          decay: { min: 0.015, max: 0.03 },
          mouse: { click: false, move: false, max: 1 },
        });
        fw.start();
        fireworksRef.current = fw;

        // Auto-stop after 3.5 seconds
        setTimeout(() => {
          if (fireworksRef.current) {
            fireworksRef.current.stop(true);
          }
        }, 3500);

        // Clear canvas after 4.5 seconds
        setTimeout(() => {
          if (fireworksRef.current) {
            fireworksRef.current.clear();
          }
        }, 4500);
      } catch (err) {
        console.warn('[Fireworks] error:', err);
      }
    }

    // 2. Canvas-confetti: corner fountains, falling particles from top, and golden stars
    const duration = 3.5 * 1000;
    const animationEnd = Date.now() + duration;

    // Center burst
    confetti({
      particleCount: 110,
      spread: 110,
      origin: { y: 0.5 },
      zIndex: 99999,
      colors: ['#FFD700', '#FF1493', '#00FFFF', '#7FFF00', '#FF4500', '#9400D3', '#FFFFFF'],
      shapes: ['star', 'circle'],
      scalar: 1.2,
    });

    const interval: any = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const progress = timeLeft / duration;

      // Left corner confetti
      confetti({
        particleCount: Math.floor(20 * progress) + 10,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.85 },
        startVelocity: 60,
        colors: ['#FFD700', '#FFA500', '#FF3366', '#00F0FF', '#39FF14'],
        shapes: ['star', 'circle'],
        zIndex: 99999,
        ticks: 160,
        gravity: 1.1,
        scalar: 1.1,
      });

      // Right corner confetti
      confetti({
        particleCount: Math.floor(20 * progress) + 10,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.85 },
        startVelocity: 60,
        colors: ['#FFD700', '#FFA500', '#FF3366', '#00F0FF', '#39FF14'],
        shapes: ['star', 'circle'],
        zIndex: 99999,
        ticks: 160,
        gravity: 1.1,
        scalar: 1.1,
      });

      // Falling confetti & golden star bursts from top
      if (Math.random() > 0.45) {
        confetti({
          particleCount: 15,
          spread: 120,
          startVelocity: 25,
          origin: { x: Math.random() * 0.8 + 0.1, y: 0 },
          colors: ['#FFD700', '#FFA500', '#FF1493', '#00FFFF', '#76FF03'],
          shapes: ['star', 'circle'],
          zIndex: 99999,
          gravity: 0.8,
          scalar: 1.2,
        });
      }
    }, 250);
  };

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (fireworksRef.current) {
        try {
          fireworksRef.current.stop(true);
          fireworksRef.current.clear();
        } catch (_) {}
      }
      confetti.reset();
    };
  }, []);

  useEffect(() => {
    if (!orderId) { 
      void Promise.resolve().then(() => { 
        setError('No order ID found.'); 
        setLoading(false); 
      }); 
      return; 
    }

    getOrderStatus(orderId)
      .then(data => {
        setOrder(data);
        if (data.amount === 0 || (data.duration_days !== null && data.duration_days <= 1)) {
          markTrialUsed();
        }
        if (data.license_key) {
          // Play once per unique transaction; prevent replaying on refresh
          const celebratedKey = `nivatv_celebrated_${orderId}`;
          if (typeof window !== 'undefined' && !sessionStorage.getItem(celebratedKey)) {
            sessionStorage.setItem(celebratedKey, 'true');
            setTimeout(() => {
              launchCelebration();
            }, 150);
          }
        }
      })
      .catch(() => setError('Could not load order details. Contact support.'))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return (
      <div className="pt-32 text-center">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin mx-auto mb-3" />
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
    <>
      {/* 🎆 Transparent full-screen fireworks & confetti overlay (non-blocking, zero scrollbars) */}
      <div 
        ref={fireworksContainerRef} 
        className="fixed inset-0 pointer-events-none z-50 overflow-hidden" 
        aria-hidden="true" 
      />

      <div className="pt-24 pb-20 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Success banner */}
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-9 h-9" />
            </div>
            <h1 className="text-4xl font-extrabold text-[var(--color-ink)] mb-2">Payment Successful!</h1>
            <p className="text-[var(--color-ink-muted)]">Your license key is ready. Copy it and activate your app.</p>
          </div>

          {/* License key */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl p-6 mb-6 shadow-sm">
            <h2 className="text-[var(--color-ink)] font-bold mb-1">Your License Key</h2>
            <p className="text-[var(--color-ink-muted)] text-xs mb-4">Save this key — you will need it to activate the app.</p>
            <LicenseKeyDisplay licenseKey={order.license_key} />

            <div className="grid grid-cols-2 gap-4 mt-5">
              <div className="bg-[var(--color-surface-2)] rounded-xl p-3 border border-[var(--color-line)]">
                <p className="text-[var(--color-ink-muted)] text-xs mb-0.5">Plan</p>
                <p className="text-[var(--color-ink)] font-semibold text-sm">{order.plan_name}</p>
              </div>
              <div className="bg-[var(--color-surface-2)] rounded-xl p-3 border border-[var(--color-line)]">
                <p className="text-[var(--color-ink-muted)] text-xs mb-0.5">Duration</p>
                <p className="text-[var(--color-ink)] font-semibold text-sm">
                  {order.duration_days && order.duration_days >= 365
                    ? `${Math.round(order.duration_days / 365)} Year`
                    : order.duration_days && order.duration_days >= 30
                    ? `${Math.round(order.duration_days / 30)} Month${order.duration_days >= 60 ? 's' : ''}`
                    : `${order.duration_days} Days`}
                </p>
              </div>
              <div className="bg-[var(--color-surface-2)] rounded-xl p-3 border border-[var(--color-line)]">
                <p className="text-[var(--color-ink-muted)] text-xs mb-0.5">Max Devices</p>
                <p className="text-[var(--color-ink)] font-semibold text-sm">{order.max_devices} Device{(order.max_devices ?? 0) > 1 ? 's' : ''}</p>
              </div>
              <div className="bg-[var(--color-surface-2)] rounded-xl p-3 border border-[var(--color-line)]">
                <p className="text-[var(--color-ink-muted)] text-xs mb-0.5">Status</p>
                <p className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm capitalize">{order.license_status}</p>
              </div>
            </div>
          </div>

          {/* Activation steps */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl p-6 mb-6 shadow-sm">
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
            <Link href="/download" className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-brand-500 hover:bg-brand-600 dark:hover:bg-brand-400 text-white font-semibold text-sm transition-colors shadow-md shadow-brand-500/20">
              <Download className="w-4 h-4" /> Download APK
            </Link>
            <Link href="/license" className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)] text-[var(--color-ink)] font-semibold text-sm transition-colors border border-[var(--color-line)]">
              <Key className="w-4 h-4" /> Check License Status
            </Link>
            <Link href="/support" className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)] text-[var(--color-ink)] font-semibold text-sm transition-colors border border-[var(--color-line)]">
              <Headphones className="w-4 h-4" /> Contact Support
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="pt-32 text-center text-[var(--color-ink-muted)]">Loading...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
