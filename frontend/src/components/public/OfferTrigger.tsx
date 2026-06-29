'use client';
import { useEffect, useState } from 'react';
import { trackPageVisit, startPricingTimer, stopPricingTimer, computeOfferPrice, isEligibleForOffer } from '@/lib/behaviorTracker';
import { getSevenDayOffer } from '@/lib/publicApi';
import ScratchCardModal from './ScratchCardModal';

export default function OfferTrigger() {
  const [showModal, setShowModal] = useState(false);
  const [offerPrice, setOfferPrice] = useState<number | null>(null);
  const [planId, setPlanId] = useState<number | null>(null);

  useEffect(() => {
    trackPageVisit('pricing');
    startPricingTimer();
    return () => stopPricingTimer();
  }, []);

  useEffect(() => {
    if (!isEligibleForOffer()) return;

    // Fetch the hidden 7-day plan ID then start countdown
    getSevenDayOffer()
      .then(plan => {
        setPlanId(plan.id);
        const t = setTimeout(() => {
          const price = computeOfferPrice();
          if (price !== null) {
            setOfferPrice(price);
            setShowModal(true);
          }
        }, 8000);
        return () => clearTimeout(t);
      })
      .catch(() => { /* offer plan not configured — silently skip */ });
  }, []);

  if (!showModal || offerPrice === null || planId === null) return null;

  return (
    <ScratchCardModal
      price={offerPrice}
      planId={planId}
      onClose={() => setShowModal(false)}
    />
  );
}
