import Link from 'next/link';
import { XCircle, RefreshCw, Headphones } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Payment Failed — NivaTV' };

export default function PaymentFailedPage() {
  return (
    <div className="pt-32 pb-20 px-4">
      <div className="max-w-md mx-auto text-center">
        <div className="w-16 h-16 rounded-full bg-red-600/20 flex items-center justify-center mx-auto mb-5">
          <XCircle className="w-9 h-9 text-red-400" />
        </div>
        <h1 className="text-3xl font-extrabold text-[var(--color-ink)] mb-3">Payment Failed</h1>
        <p className="text-[var(--color-ink-muted)] mb-2">Your payment was not completed successfully.</p>
        <p className="text-slate-500 text-sm mb-10">
          No money has been deducted. If your account was charged, contact support with your transaction ID.
        </p>

        <div className="flex flex-col gap-3">
          <Link href="/pricing" className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-[var(--color-ink)] font-semibold transition-colors">
            <RefreshCw className="w-4 h-4" /> Try Again
          </Link>
          <Link href="/support" className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)] text-[var(--color-ink)] font-semibold transition-colors border border-[var(--color-line)]">
            <Headphones className="w-4 h-4" /> Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}
