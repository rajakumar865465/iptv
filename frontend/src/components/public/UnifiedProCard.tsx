'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Sparkles, ShieldCheck } from 'lucide-react';
import type { Plan } from '@/lib/publicApi';
import { useAuth } from '@/contexts/AuthContext';
import AuthModal from '@/components/auth/AuthModal';

interface Props {
  trialPlan?: Plan;
  paidPlan?: Plan;
  paymentMode?: string;
}

const TRIAL_FEATURES = [
  'Free-to-Air (FTA) channels',
  'All Exclusive Pro channels',
  'Indian & regional content',
  'Full HD & 4K streams',
  '30 Days 100% Free access',
  '1 Device (Mobile / Android TV)',
];

const PAID_FEATURES = [
  'Free-to-Air (FTA) channels',
  'All Exclusive Pro channels',
  'Indian & regional content',
  'HD quality streams',
  'Regular channel updates',
  '2 Devices (Multi-device access)',
  'No auto-renewal',
];

export default function UnifiedProCard({ trialPlan, paidPlan, paymentMode = 'razorpay' }: Props) {
  const router = useRouter();
  const { user, token } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  // Auto-detect: if user has already claimed trial, default to paid mode
  const hasClaimedTrial = !!user?.has_claimed_trial;
  const [mode, setMode] = useState<'trial' | 'paid'>('trial');

  // React to user auth state change
  useEffect(() => {
    if (hasClaimedTrial) {
      setMode('paid');
    }
  }, [hasClaimedTrial]);

  const isTrial = mode === 'trial' && !hasClaimedTrial && !!trialPlan;
  const activePlan = isTrial ? trialPlan! : (paidPlan || trialPlan!);

  const handleAction = (e: React.MouseEvent) => {
    e.preventDefault();
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
    const isAuthenticated = !!(user || token || storedToken);

    const targetUrl = (paymentMode === 'manual' && activePlan.price > 0)
      ? `/checkout?plan=${activePlan.id}`
      : `/payment?plan_id=${activePlan.id}`;

    if (!isAuthenticated) {
      setAuthOpen(true);
      return;
    }

    router.push(targetUrl);
  };

  const handleAuthSuccess = (_loggedInUser: any) => {
    setAuthOpen(false);
    // After login, if user already claimed trial, route to paid Pro
    const userClaimed = _loggedInUser?.has_claimed_trial || user?.has_claimed_trial;
    const planToUse = (userClaimed || !isTrial) ? (paidPlan || activePlan) : activePlan;
    const targetUrl = (paymentMode === 'manual' && planToUse.price > 0)
      ? `/checkout?plan=${planToUse.id}`
      : `/payment?plan_id=${planToUse.id}`;
    router.push(targetUrl);
  };

  // Card theme styling: emerald for Free Trial, clean WHITE / surface for Paid Pro
  const wrapperClass = isTrial
    ? 'relative rounded-2xl border flex flex-col transition-all duration-300 hover:-translate-y-1.5 overflow-hidden shadow-card hover:shadow-card-hover bg-gradient-to-b from-emerald-600/20 via-emerald-600/8 to-[var(--color-surface)] border-emerald-500/50 shadow-xl shadow-emerald-500/10'
    : 'relative rounded-2xl border flex flex-col transition-all duration-300 hover:-translate-y-1.5 overflow-hidden shadow-card hover:shadow-card-hover bg-[var(--color-surface)] border-[var(--color-line)] hover:border-[var(--color-ink-subtle)]/30';

  const badgeText = isTrial ? '1-Month Free Trial' : '';
  const badgeClass = isTrial ? 'bg-emerald-600 text-white' : '';
  const iconCls = isTrial ? 'text-emerald-500' : 'text-green-500';
  const btnClass = isTrial
    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
    : 'bg-[var(--color-surface-2)] hover:bg-[var(--color-line)] text-[var(--color-ink)] border border-[var(--color-line)]';

  const features = isTrial ? TRIAL_FEATURES : PAID_FEATURES;
  const buttonText = isTrial ? 'Claim 1-Month Free Trial' : 'Start Watching Instantly';

  return (
    <div className={wrapperClass}>
      {badgeText && (
        <div className={'w-full text-center text-xs font-bold py-1.5 tracking-wider uppercase ' + badgeClass}>
          {badgeText}
        </div>
      )}

      <div className="p-4 sm:p-6 flex flex-col flex-1">
        {/* Top tag / Trial claimed indicator */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {isTrial ? (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              100% FREE TRIAL
            </span>
          ) : hasClaimedTrial ? (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Trial Already Claimed
            </span>
          ) : (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--color-surface-2)] text-[var(--color-ink-muted)] border border-[var(--color-line)]">
              2 Devices Access
            </span>
          )}
        </div>

        <h3 className="text-xl font-bold text-[var(--color-ink)] mb-1">Pro</h3>
        <p className="text-[var(--color-ink-muted)] text-sm mb-1">
          {isTrial
            ? 'All Free & Pro channels unlocked with 1 device access'
            : 'All free and paid channels validity - 30 days'}
        </p>
        <p className="text-[var(--color-ink-subtle)] text-xs mb-3">
          Monthly Plan &bull; {isTrial ? '1 Device' : '2 Devices'}
        </p>

        {/* Option toggle for eligible visitors */}
        {!hasClaimedTrial && paidPlan && trialPlan && (
          <div className="mb-4 bg-[var(--color-surface-2)] p-1 rounded-xl flex items-center border border-[var(--color-line)] text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode('trial')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                mode === 'trial'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
              }`}
            >
              1 Device &bull; ₹0 Free Trial
            </button>
            <button
              type="button"
              onClick={() => setMode('paid')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                mode === 'paid'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-black shadow-sm'
                  : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
              }`}
            >
              2 Devices &bull; ₹79/mo
            </button>
          </div>
        )}

        {/* Price display */}
        <div className="mb-2">
          <div className="flex items-end gap-2 flex-wrap">
            {isTrial ? (
              <>
                <span className="text-2xl text-red-500/80 line-through font-bold decoration-2">
                  ₹{Math.round(trialPlan?.regular_price || 79)}
                </span>
                <span className="text-4xl font-extrabold text-emerald-500">
                  ₹0
                </span>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider mb-1">
                  100% Free
                </span>
              </>
            ) : (
              <>
                <span className="text-4xl font-extrabold text-[var(--color-ink)]">
                  ₹{Math.round(activePlan.price || 79)}
                </span>
                <span className="text-[var(--color-ink-subtle)] text-sm font-semibold mb-1">
                  /month
                </span>
              </>
            )}
          </div>
        </div>

        {/* Monthly subtitle */}
        <div className="mb-3">
          {isTrial ? (
            <p className="text-[var(--color-ink-subtle)] text-xs font-medium">
              Enjoy 30 days full access with 1 device, then ₹79/month
            </p>
          ) : (
            <p className="text-emerald-500 font-bold text-xs">
              Great value with 2-device multi-screen access!
            </p>
          )}
        </div>

        {/* Features list */}
        <ul className="space-y-2 mb-6 flex-1 mt-2">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
              <Check className={'w-4 h-4 shrink-0 ' + iconCls} />
              {f}
            </li>
          ))}
        </ul>

        {/* CTA Button & Guarantee */}
        <div className="flex flex-col gap-2 mt-auto">
          <button
            type="button"
            onClick={handleAction}
            className={'w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm sm:text-base transition-all min-h-[44px] cursor-pointer ' + btnClass}
          >
            {buttonText}
          </button>
          <p className="text-center text-[10px] text-[var(--color-ink-subtle)] px-2">
            {isTrial
              ? 'Try it for 30 Days, 100% Free. No Credit Card Required.'
              : 'Instant license key generated immediately after payment.'}
          </p>
        </div>
      </div>

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
