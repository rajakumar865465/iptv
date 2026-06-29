'use client';
import { useEffect } from 'react';
import { trackPageVisit } from '@/lib/behaviorTracker';

export default function PageTracker({ page }: { page: string }) {
  useEffect(() => { trackPageVisit(page); }, [page]);
  return null;
}
