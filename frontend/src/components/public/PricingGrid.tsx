'use client';

import type { Plan } from '@/lib/publicApi';
import PlanCard from '@/components/public/PlanCard';
import UnifiedProCard from '@/components/public/UnifiedProCard';

interface Props {
  plans: Plan[];
  paymentMode?: string;
  className?: string;
}

export default function PricingGrid({ plans, paymentMode = 'razorpay', className }: Props) {
  // Consolidate into exactly 3 tiers/cards:
  // 1. Starter (budget tier: price <= 50)
  const starterPlan = plans.find((p) => p.price > 0 && p.price <= 50) || plans.find((p) => p.id === 3);
  // 2. Pro Trial and Paid Pro (consolidated into the middle card)
  const trialProPlan = plans.find((p) => p.price === 0) || plans.find((p) => p.id === 64);
  const paidProPlan = plans.find((p) => p.price > 50 && p.duration_days <= 60) || plans.find((p) => p.id === 63);
  // 3. Plus (yearly/family tier)
  const plusPlan = plans.find((p) => p.duration_days >= 180 || p.price >= 500) || plans.find((p) => p.id === 6);

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch ${className ?? 'mb-16'}`}>
      {starterPlan && (
        <PlanCard plan={starterPlan} paymentMode={paymentMode} />
      )}
      <UnifiedProCard
        trialPlan={trialProPlan}
        paidPlan={paidProPlan}
        paymentMode={paymentMode}
      />
      {plusPlan && (
        <PlanCard plan={plusPlan} paymentMode={paymentMode} />
      )}
    </div>
  );
}
