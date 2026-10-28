'use client';
import { useEffect, useState, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  CheckCircle, 
  Download, 
  Key, 
  Headphones, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  Trophy, 
  Zap, 
  Tv, 
  ShieldCheck, 
  PartyPopper 
} from 'lucide-react';
import { getOrderStatus } from '@/lib/publicApi';
import type { OrderStatus } from '@/lib/publicApi';
import LicenseKeyDisplay from '@/components/public/LicenseKeyDisplay';
import { markTrialUsed } from '@/lib/behaviorTracker';
import confetti from 'canvas-confetti';

const ACTIVATION_STEPS = [
  'Download & install the NivaTV APK on your Android Phone or Android TV.',
  'Open the app and log in or tap "Activate License".',
  'Paste your VIP License Key and tap the Activate button.',
  'Instant Unlocked! Enjoy 850+ Live Channels, Movies & Sports in 4K clarity.',
];

// Play celebratory gentle chime using Web Audio API (100% native, zero external assets)
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

// "Fulgari" / Sparkler Fireworks Dopamine Explosion
function triggerFulgariFireworks() {
  playCelebrationChime();

  const duration = 4.5 * 1000;
  const animationEnd = Date.now() + duration;

  // 1. Instant Big Center Fireworks Cannon Burst
  confetti({
    particleCount: 140,
    spread: 120,
    origin: { y: 0.55 },
    zIndex: 99999,
    colors: ['#FFD700', '#FF1493', '#00FFFF', '#7FFF00', '#FF4500', '#9400D3', '#FFFFFF'],
    shapes: ['star', 'circle'],
    scalar: 1.25,
  });

  // 2. Realistic "Fulgari" / Sparkler Cracklers (Fountains shooting from bottom-left & bottom-right)
  const sparklerInterval: any = setInterval(() => {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) {
      return clearInterval(sparklerInterval);
    }

    const progress = timeLeft / duration;

    // Left sparkler fountain shooting sparks toward center
    confetti({
      particleCount: Math.floor(25 * progress) + 12,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.85 },
      startVelocity: 60,
      colors: ['#FFD700', '#FFA500', '#FF3366', '#00F0FF', '#39FF14'],
      shapes: ['star', 'circle'],
      zIndex: 99999,
      ticks: 180,
      gravity: 1.1,
      scalar: 1.15,
    });

    // Right sparkler fountain shooting sparks toward center
    confetti({
      particleCount: Math.floor(25 * progress) + 12,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.85 },
      startVelocity: 60,
      colors: ['#FFD700', '#FFA500', '#FF3366', '#00F0FF', '#39FF14'],
      shapes: ['star', 'circle'],
      zIndex: 99999,
      ticks: 180,
      gravity: 1.1,
      scalar: 1.15,
    });

    // Random sparkling bursts in upper sky
    if (Math.random() > 0.4) {
      confetti({
        particleCount: 18,
        spread: 360,
        startVelocity: 30,
        origin: { x: Math.random() * 0.6 + 0.2, y: Math.random() * 0.4 + 0.1 },
        colors: ['#FFD700', '#FFFFFF', '#00FFFF', '#FF69B4', '#76FF03'],
        shapes: ['star'],
        zIndex: 99999,
        scalar: 1.3,
      });
    }
  }, 280);
}

function SuccessContent() {
  const params = useSearchParams();
  const orderId = params.get('order_id');
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const handleCelebrate = useCallback(() => {
    triggerFulgariFireworks();
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
          // Launch the explosive dopamine phuljhadi animation!
          triggerFulgariFireworks();
        }
      })
      .catch(() => setError('Could not load order details. Contact support.'))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return (
      <div className="pt-32 pb-24 text-center">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin mx-auto mb-3" />
        <p className="text-slate-600 dark:text-[var(--color-ink-muted)] font-semibold text-sm">
          Securing and loading your VIP license...
        </p>
      </div>
    );
  }

  if (error || !order?.license_key) {
    return (
      <div className="pt-24 pb-20 px-4 max-w-md mx-auto text-center">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-[var(--color-ink)] mb-3">Something went wrong</h1>
        <p className="text-slate-600 dark:text-[var(--color-ink-muted)] mb-6 text-sm">
          {error || 'License key not found for this order. Contact support.'}
        </p>
        <Link 
          href="/support" 
          className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm transition-colors shadow-lg shadow-brand-500/20"
        >
          Contact Support
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-20 pb-20 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* 🎆 CELEBRATION HEADER WITH ANIMATED HALO & TROPHY */}
        <div className="text-center relative pt-4 pb-2">
          
          {/* Pulsing radiant halo behind badge */}
          <div className="relative w-24 h-24 mx-auto mb-5 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-emerald-400 animate-spin blur-lg opacity-70" />
            <div className="absolute inset-1 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center" />
            <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-xl shadow-emerald-500/40">
              <CheckCircle className="w-9 h-9 stroke-[2.5]" />
            </div>
            {/* Sparkle decorative chips */}
            <div className="absolute -top-1 -right-1 p-1 bg-amber-400 text-slate-950 rounded-full shadow-md animate-bounce">
              <Sparkles className="w-4 h-4 fill-amber-400" />
            </div>
          </div>

          {/* Celebratory Badge */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-extrabold text-xs uppercase tracking-wider mb-3 shadow-2xs">
            <PartyPopper className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>VIP Access Unlocked</span>
          </div>

          {/* Animated Gradient Headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-3">
            Payment Successful! <span className="inline-block animate-pulse">🎉</span>
          </h1>
          
          <p className="text-slate-600 dark:text-[var(--color-ink-muted)] text-sm sm:text-base max-w-lg mx-auto font-medium">
            Congratulations! Your ultra high-speed premium subscription is ready. Copy your VIP key below and activate instantly.
          </p>
        </div>

        {/* 🚀 SURPRISE DOPAMINE PERKS CHIPS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-800 dark:text-slate-200 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold">
              <Tv className="w-4 h-4" />
            </div>
            <span>850+ Live Channels</span>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-800 dark:text-slate-200 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-brand-500/15 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 font-bold">
              <Zap className="w-4 h-4" />
            </div>
            <span>Anti-Stutter &amp; 4K HDR</span>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-800 dark:text-slate-200 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span>100% Ad-Free Live TV</span>
          </div>
        </div>

        {/* 🏆 SHIMMERING VIP LICENSE CARD */}
        <div className="relative p-[2px] rounded-3xl bg-gradient-to-r from-amber-400 via-rose-500 to-emerald-400 shadow-xl shadow-brand-500/10">
          <div className="bg-white dark:bg-slate-900 rounded-[22px] p-6 sm:p-7 space-y-5">
            
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <h2 className="text-slate-900 dark:text-white font-extrabold text-base sm:text-lg">
                    Your VIP License Key
                  </h2>
                </div>
                <p className="text-slate-500 dark:text-[var(--color-ink-muted)] text-xs font-medium mt-0.5">
                  Save this key — you will need it to activate the app.
                </p>
              </div>

              {/* Interactive Celebrate Again Button */}
              <button
                type="button"
                onClick={handleCelebrate}
                title="Launch fireworks again!"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <span>🎆 Sparks</span>
              </button>
            </div>

            {/* License Key Component */}
            <div className="bg-slate-50 dark:bg-slate-950/60 p-2 sm:p-2.5 rounded-2xl border border-slate-200 dark:border-white/10">
              <LicenseKeyDisplay licenseKey={order.license_key} />
            </div>

            {/* Plan Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200 dark:border-white/5">
                <p className="text-slate-500 dark:text-[var(--color-ink-muted)] text-[11px] font-semibold uppercase tracking-wider mb-0.5">
                  Plan
                </p>
                <p className="text-slate-900 dark:text-white font-extrabold text-sm">{order.plan_name}</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200 dark:border-white/5">
                <p className="text-slate-500 dark:text-[var(--color-ink-muted)] text-[11px] font-semibold uppercase tracking-wider mb-0.5">
                  Duration
                </p>
                <p className="text-slate-900 dark:text-white font-extrabold text-sm">
                  {order.duration_days && order.duration_days >= 365
                    ? `${Math.round(order.duration_days / 365)} Year`
                    : order.duration_days && order.duration_days >= 30
                    ? `${Math.round(order.duration_days / 30)} Month${order.duration_days >= 60 ? 's' : ''}`
                    : `${order.duration_days} Days`}
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200 dark:border-white/5">
                <p className="text-slate-500 dark:text-[var(--color-ink-muted)] text-[11px] font-semibold uppercase tracking-wider mb-0.5">
                  Devices
                </p>
                <p className="text-slate-900 dark:text-white font-extrabold text-sm">
                  {order.max_devices} Device{(order.max_devices ?? 0) > 1 ? 's' : ''}
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200 dark:border-white/5">
                <p className="text-slate-500 dark:text-[var(--color-ink-muted)] text-[11px] font-semibold uppercase tracking-wider mb-0.5">
                  Status
                </p>
                <p className="text-emerald-700 dark:text-emerald-400 font-extrabold text-sm capitalize flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {order.license_status || 'Active'}
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* 📱 HOW TO ACTIVATE STEPS */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-[var(--color-line)] rounded-3xl p-6 sm:p-7 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-4">
          <h2 className="text-slate-900 dark:text-white font-extrabold text-base flex items-center gap-2">
            <span>⚡ 4-Step Quick Activation Guide</span>
          </h2>
          <ol className="space-y-3">
            {ACTIVATION_STEPS.map((step, i) => (
              <li key={i} className="flex items-start gap-3.5">
                <span className="w-6 h-6 shrink-0 rounded-full bg-brand-600 text-white text-xs font-black flex items-center justify-center mt-0.5 shadow-sm">
                  {i + 1}
                </span>
                <span className="text-slate-700 dark:text-slate-200 text-sm font-medium leading-relaxed">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* 🎯 ACTION CTAS */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link 
            href="/download" 
            className="flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-extrabold text-base transition-all shadow-xl shadow-brand-600/30 cursor-pointer active:scale-98"
          >
            <Download className="w-5 h-5" /> Download App &amp; Watch Now
          </Link>
          <Link 
            href="/license" 
            className="flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-sm transition-all border border-slate-300 dark:border-white/10"
          >
            <Key className="w-4 h-4 text-brand-500" /> Check License Status
          </Link>
          <Link 
            href="/support" 
            className="sm:w-auto px-5 flex items-center justify-center gap-2 py-4 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm transition-all border border-slate-300 dark:border-white/10"
          >
            <Headphones className="w-4 h-4" /> Support
          </Link>
        </div>

      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense 
      fallback={
        <div className="pt-32 pb-24 text-center">
          <Loader2 className="w-10 h-10 text-brand-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-600 dark:text-[var(--color-ink-muted)] font-semibold text-sm">
            Loading your license...
          </p>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}