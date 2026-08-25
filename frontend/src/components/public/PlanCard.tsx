'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { getPaymentConfig } from '@/lib/publicApi';
import type { Plan } from '@/lib/publicApi';

const FEATURES = [
  'Free-to-Air (FTA) channels',
  'Publicly available streams',
  'Indian & regional content',
  'HD quality streams',
  'Regular channel updates',
  'No auto-renewal',
];

const TRIAL_FEATURES = [
  'Free-to-Air (FTA) channels',
  'Publicly available streams',
  'Indian & regional content',
  'HD quality streams',
  'Regular channel updates',
  'No payment required',
];

export type PlanVariant = 'most-popular' | 'save-more' | 'best-value' | 'starter';

/**
 * Decide a card's visual variant.
 * Prefer the backend-managed `is_popular` / `is_best_value` flags so that only
 * the plans you explicitly mark in the admin dashboard get those badges.
 * Fall back to a duration-based guess only if flags aren't set.
 */
export function planVariant(plan: Plan): PlanVariant {
  if (plan.price === 0) return 'starter';
  if (plan.is_best_value) return 'best-value';
  if (plan.is_popular) return 'most-popular';
  // Sensible fallback only when no flags are set
  if (plan.duration_days >= 365) return 'best-value';
  if (plan.duration_days === 180) return 'save-more';
  if (plan.duration_days === 30) return 'most-popular';
  return 'starter';
}

function getCtaText(plan: Plan, variant: PlanVariant): string {
  if (plan.price === 0) return 'Start Free Trial';
  if (variant === 'best-value') return 'Unlock 500+ Channels Now';
  return 'Start Watching Instantly';
}

function planSubtitle(plan: Plan): string {
  if (plan.price === 0) return 'Try the app free — no payment needed';
  if (plan.duration_days === 1) return 'Quick 24-hour trial to explore';
  if (plan.duration_days === 7) return 'Try the app for one week';
  if (plan.duration_days === 15) return 'Short plan for quick access';
  if (plan.duration_days === 30) return 'Best choice for regular viewers';
  if (plan.duration_days === 90) return 'Great value for three months';
  if (plan.duration_days === 180) return 'Save more with half-year access';
  return 'Best value for family use';
}

function formatDuration(days: number) {
  if (days >= 365) return 'Annual Plan';
  if (days === 180) return '6-Month Plan';
  if (days === 90) return 'Quarterly Plan';
  if (days === 30) return 'Monthly Plan';
  if (days === 7) return 'Weekly Plan';

  const y = Math.round(days / 365);
  const m = Math.round(days / 30);
  if (days > 365) return String(y) + ' Years';
  if (days > 30) return String(m) + ' Months';
  return String(days) + ' Days';
}

function monthlyPrice(plan: Plan): number | null {
  if (plan.duration_days < 30 || plan.price === 0) return null;
  return Math.round(plan.price / (plan.duration_days / 30));
}

// Card backgrounds — work in both dark & light mode via CSS tokens
const cardClasses: Record<PlanVariant, string> = {
  'most-popular':
    'bg-gradient-to-b from-brand-600/20 via-brand-600/8 to-[var(--color-surface)] border-brand-500/50 shadow-xl shadow-brand-500/10',
  'save-more':
    'bg-gradient-to-b from-green-600/12 via-green-600/4 to-[var(--color-surface)] border-green-500/35',
  'best-value':
    'bg-gradient-to-b from-amber-500/12 via-amber-500/4 to-[var(--color-surface)] border-amber-500/35',
  starter: 'bg-[var(--color-surface)] border-[var(--color-line)] hover:border-[var(--color-ink-subtle)]/30',
};

const priceColor: Record<PlanVariant, string> = {
  'most-popular': 'text-brand-500',
  'save-more': 'text-green-500',
  'best-value': 'text-amber-500',
  starter: 'text-[var(--color-ink)]',
};

const iconColor: Record<PlanVariant, string> = {
  'most-popular': 'text-brand-500',
  'save-more': 'text-green-500',
  'best-value': 'text-amber-500',
  starter: 'text-green-500',
};

interface Props {
  plan: Plan;
  ctaText?: string;
  variant?: PlanVariant;
  paymentMode?: string;
}

export default function PlanCard({ plan, ctaText, variant, paymentMode = 'razorpay' }: Props) {
  const [currentMode, setCurrentMode] = useState<string>(paymentMode);

  useEffect(() => {
    getPaymentConfig()
      .then((cfg) => {
        if (cfg?.payment_mode) setCurrentMode(cfg.payment_mode);
      })
      .catch(() => {});
  }, []);

  // Auto-detect variant from backend flags when not explicitly passed
  const resolvedVariant = variant ?? planVariant(plan);
  const isFree = plan.price === 0;
  const hasOffer = plan.regular_price && plan.regular_price > plan.price;

  const features = isFree ? TRIAL_FEATURES : FEATURES;
  const buttonText = ctaText || getCtaText(plan, resolvedVariant);

  const wrapperClass =
    'relative rounded-2xl border flex flex-col transition-all duration-300 hover:-translate-y-1.5 overflow-hidden shadow-card hover:shadow-card-hover ' +
    cardClasses[resolvedVariant];
  const priceCls = priceColor[resolvedVariant];
  const iconCls = iconColor[resolvedVariant];

  let badgeText = '';
  let badgeClass = '';
  if (resolvedVariant === 'most-popular') {
    badgeText = 'Most Popular';
    badgeClass = 'bg-brand-600 text-white';
  } else if (resolvedVariant === 'save-more') {
    badgeText = 'Save More — 6 Months';
    badgeClass = 'bg-green-600 text-white';
  } else if (resolvedVariant === 'best-value') {
    badgeText = 'Best Value';
    badgeClass = 'bg-amber-500 text-black';
  }

  let offerBadgeClass = 'bg-[var(--color-surface-2)] text-[var(--color-ink-muted)] border border-[var(--color-line)]';
  if (resolvedVariant === 'most-popular') offerBadgeClass = 'bg-brand-600 text-white';
  else if (resolvedVariant === 'save-more') offerBadgeClass = 'bg-green-600 text-white';
  else if (resolvedVariant === 'best-value') offerBadgeClass = 'bg-amber-500 text-black';

  let btnClass =
    'bg-[var(--color-surface-2)] hover:bg-[var(--color-line)] text-[var(--color-ink)] border border-[var(--color-line)]';
  if (resolvedVariant === 'most-popular')
    btnClass = 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-500/20';
  else if (resolvedVariant === 'save-more')
    btnClass = 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-500/20';
  else if (resolvedVariant === 'best-value')
    btnClass = 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20';

  return (
    <div className={wrapperClass}>
      {badgeText && (
        <div className={'w-full text-center text-xs font-bold py-1.5 tracking-wider uppercase ' + badgeClass}>
          {badgeText}
        </div>
      )}

      <div className="p-4 sm:p-6 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {plan.offer_label && (
            <span className={'text-xs font-semibold px-2.5 py-1 rounded-full ' + offerBadgeClass}>
              {plan.offer_label}
            </span>
          )}
        </div>

        <h3 className="text-lg font-bold text-[var(--color-ink)] mb-1">{plan.name}</h3>
        <p className="text-[var(--color-ink-muted)] text-sm mb-1">{planSubtitle(plan)}</p>
        <p className="text-[var(--color-ink-subtle)] text-xs mb-4">
          {formatDuration(plan.duration_days)} &bull; {plan.max_devices} {plan.max_devices > 1 ? 'Devices' : 'Device'}
        </p>

        <div className="mb-1">
          <div className="flex items-end gap-2 flex-wrap">
            {hasOffer && !isFree && (
              <span className="text-2xl text-red-500/80 line-through font-bold decoration-2">
                {'₹' + Math.round(plan.regular_price!)}
              </span>
            )}
            <span className={'text-4xl font-extrabold ' + priceCls}>
              {isFree ? 'Free' : '₹' + Math.round(plan.price)}
            </span>
          </div>
        </div>

        {monthlyPrice(plan) !== null && (
          <div className="mb-3 flex flex-col items-start gap-1">
            <p className="text-[var(--color-ink-subtle)] text-sm font-semibold">
              {'Only ₹' + monthlyPrice(plan) + '/month'}
            </p>
            {plan.duration_days >= 365 && plan.max_devices > 1 && (
              <>
                <p className="text-green-500 font-bold text-xs bg-green-500/10 px-2 py-0.5 rounded">
                  Family Plan - Just ₹{(monthlyPrice(plan)! / plan.max_devices).toFixed(1)}/mo per device!
                </p>
                <p className="text-amber-500 font-bold text-xs mt-0.5">
                  Save ₹{(99 * 12 * plan.max_devices) - plan.price} a year!
                </p>
              </>
            )}
            {plan.duration_days === 30 && (
              <p className="text-amber-500 font-bold text-xs mt-0.5">
                Costs less than a cup of cutting chai!
              </p>
            )}
          </div>
        )}

        <ul className="space-y-2 mb-6 flex-1 mt-2">
          {features.map(f => (
            <li key={f} className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
              <Check className={'w-4 h-4 shrink-0 ' + iconCls} />
              {f}
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 mt-auto">
          {!isFree && plan.duration_days >= 365 && (
            <p className="text-center text-xs font-bold text-amber-500 mb-0.5">
              ⭐ Chosen by 82% of families
            </p>
          )}
          {!isFree && plan.duration_days === 180 && (
            <p className="text-center text-xs font-bold text-green-500 mb-0.5">
              💰 Save 50% vs paying monthly!
            </p>
          )}
          <Link
            href={currentMode === 'manual' ? '/checkout?plan=' + plan.id : '/payment?plan_id=' + plan.id}
            className={'flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm sm:text-base transition-all min-h-[44px] ' + btnClass}
          >
            {buttonText}
          </Link>
          {isFree && (
            <p className="text-center text-[10px] text-[var(--color-ink-subtle)] px-2">
              Try it for 24 Hours, 100% Free.<br/>No Credit Card Required.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
