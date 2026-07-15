'use client';
import Link from 'next/link';
import { Check } from 'lucide-react';
import type { Plan } from '@/lib/publicApi';

const FEATURES = [
  'All live TV channels',
  'Indian & regional content',
  'HD quality streams',
  'Regular channel updates',
  'Instant license delivery',
  'No auto-renewal',
];

const TRIAL_FEATURES = [
  'All live TV channels',
  'Indian & regional content',
  'HD quality streams',
  'Regular channel updates',
  'No payment required',
  'No auto-renewal',
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
  if (plan.duration_days === 30) return 'most-popular';
  return 'starter';
}

function getCtaText(plan: Plan, variant: PlanVariant): string {
  if (plan.price === 0) return 'Start Free Trial';
  if (variant === 'most-popular') return plan.duration_days === 30 ? 'Get Monthly Plan' : 'Get Most Popular';
  if (variant === 'save-more') return 'Save with 6 Months';
  if (variant === 'best-value') return 'Get Best Value';
  if (plan.duration_days === 1) return 'Try for 1 Day';
  if (plan.duration_days === 7) return 'Try for a Week';
  if (plan.duration_days === 30) return 'Start Monthly';
  return 'Get Launch Offer';
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
  const y = Math.round(days / 365);
  const m = Math.round(days / 30);
  if (days >= 365) return String(y) + ' Year';
  if (days >= 30) return String(m) + ' Month' + (days >= 60 ? 's' : '');
  return String(days) + ' Day' + (days !== 1 ? 's' : '');
}

function monthlyPrice(plan: Plan): number | null {
  if (plan.duration_days < 30 || plan.price === 0) return null;
  return Math.round(plan.price / (plan.duration_days / 30));
}

const cardClasses: Record<PlanVariant, string> = {
  'most-popular':
    'bg-gradient-to-b from-indigo-600/25 via-indigo-600/10 to-transparent border-indigo-500/60 shadow-xl shadow-indigo-500/15',
  'save-more':
    'bg-gradient-to-b from-green-600/15 via-green-600/5 to-transparent border-green-500/40',
  'best-value':
    'bg-gradient-to-b from-amber-500/15 via-amber-500/5 to-transparent border-amber-500/40',
  starter: 'bg-white/5 border-white/10 hover:border-white/25',
};

const priceColor: Record<PlanVariant, string> = {
  'most-popular': 'text-indigo-400',
  'save-more': 'text-green-400',
  'best-value': 'text-amber-400',
  starter: 'text-white',
};

const iconColor: Record<PlanVariant, string> = {
  'most-popular': 'text-indigo-400',
  'save-more': 'text-green-400',
  'best-value': 'text-amber-400',
  starter: 'text-green-400',
};

interface Props {
  plan: Plan;
  ctaText?: string;
  variant?: PlanVariant;
}

export default function PlanCard({ plan, ctaText, variant }: Props) {
  // Auto-detect variant from backend flags when not explicitly passed
  const resolvedVariant = variant ?? planVariant(plan);
  const isFree = plan.price === 0;
  const hasOffer = plan.regular_price && plan.regular_price > plan.price;

  const features = isFree ? TRIAL_FEATURES : FEATURES;
  const buttonText = ctaText || getCtaText(plan, resolvedVariant);

  const wrapperClass = 'relative rounded-2xl border flex flex-col transition-all duration-300 hover:-translate-y-1 overflow-hidden ' +
    cardClasses[resolvedVariant];
  const priceCls = priceColor[resolvedVariant];
  const iconCls = iconColor[resolvedVariant];

  let badgeText = '';
  let badgeClass = '';
  if (resolvedVariant === 'most-popular') {
    badgeText = 'Most Popular';
    badgeClass = 'bg-indigo-600 text-white';
  } else if (resolvedVariant === 'save-more') {
    badgeText = 'Save More';
    badgeClass = 'bg-green-600 text-white';
  } else if (resolvedVariant === 'best-value') {
    badgeText = 'Best Value';
    badgeClass = 'bg-amber-500 text-black';
  }

  let offerBadgeClass = 'bg-white/10 text-slate-300';
  if (resolvedVariant === 'most-popular') offerBadgeClass = 'bg-indigo-600 text-white';
  else if (resolvedVariant === 'save-more') offerBadgeClass = 'bg-green-600 text-white';
  else if (resolvedVariant === 'best-value') offerBadgeClass = 'bg-amber-500 text-black';

  let btnClass = 'bg-white/10 hover:bg-white/20 text-white border border-white/10';
  if (resolvedVariant === 'most-popular') btnClass = 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20';
  else if (resolvedVariant === 'save-more') btnClass = 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-500/20';
  else if (resolvedVariant === 'best-value') btnClass = 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20';

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

        <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
        <p className="text-slate-300 text-sm mb-1">{planSubtitle(plan)}</p>
        <p className="text-slate-400 text-xs mb-4">
          {formatDuration(plan.duration_days)} &bull; {plan.max_devices} {plan.max_devices > 1 ? 'Devices' : 'Device'}
        </p>

        <div className="mb-1">
          {hasOffer && (
            <p className="text-slate-500 text-sm line-through mb-0.5">
              {'₹' + Math.round(plan.regular_price!) + ' regular price'}
            </p>
          )}
          <div className="flex items-end gap-2">
            <span className={'text-4xl font-extrabold ' + priceCls}>
              {isFree ? 'Free' : '₹' + Math.round(plan.price)}
            </span>
            {!isFree && (
              <span className="text-slate-400 text-sm mb-1">launch price</span>
            )}
          </div>
        </div>

        {monthlyPrice(plan) !== null && (
          <p className="text-slate-400 text-sm mb-3">
            {'Only ₹' + monthlyPrice(plan) + '/month'}
          </p>
        )}

        <ul className="space-y-2 mb-6 flex-1">
          {features.map(f => (
            <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
              <Check className={'w-4 h-4 shrink-0 ' + iconCls} />
              {f}
            </li>
          ))}
        </ul>

        <Link
          href={'/payment?plan_id=' + plan.id}
          className={'flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all min-h-[44px] ' + btnClass}
        >
          {buttonText}
        </Link>
      </div>
    </div>
  );
}
