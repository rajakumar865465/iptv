'use client';

import type { Plan } from '@/lib/publicApi';
import PlanCard from '@/components/public/PlanCard';

interface Props {
  plans: Plan[];
  paymentMode?: string;
  className?: string;
}

export default function PricingGrid({ plans, paymentMode = 'razorpay', className }: Props) {
  // Sort plans: Free Trial (price === 0) first, or by sort_order
  const sortedPlans = [...plans].sort((a, b) => {
    if (a.sort_order !== undefined && b.sort_order !== undefined && a.sort_order !== b.sort_order) {
      return a.sort_order - b.sort_order;
    }
    if (a.price === 0) return -1;
    if (b.price === 0) return 1;
    return a.price - b.price;
  });

  const count = sortedPlans.length;
  const gridCols =
    count === 1
      ? 'grid-cols-1 max-w-md'
      : count === 2
      ? 'grid-cols-1 md:grid-cols-2 max-w-4xl'
      : count === 3
      ? 'grid-cols-1 md:grid-cols-3 max-w-6xl'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 max-w-7xl';

  return (
    <div className={`grid ${gridCols} gap-6 mx-auto items-stretch ${className ?? 'mb-16'}`}>
      {sortedPlans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} paymentMode={paymentMode} />
      ))}
    </div>
  );
}
