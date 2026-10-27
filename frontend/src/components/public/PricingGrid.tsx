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
  // Find distinct tier plans
  const starterPlan = plans.find((p) => p.id === 3 || (p.price > 0 && p.price <= 50));
  const trialProPlan = plans.find((p) => p.id === 64 || p.price === 0);
  const paidProPlan = plans.find((p) => p.id === 63 || (p.price > 50 && p.duration_days === 30));
  const plusPlan = plans.find((p) => p.id === 6 || p.duration_days >= 365 || p.price >= 600);

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
