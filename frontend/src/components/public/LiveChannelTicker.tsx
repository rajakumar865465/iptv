'use client';

import { useMemo } from 'react';
import { Radio } from 'lucide-react';
import ChannelLogoImage from '@/components/ChannelLogoImage';
import type { Channel } from '@/lib/publicApi';

interface LiveChannelTickerProps {
  channels: Channel[];
}

/* Render a single channel pill. Kept tiny so two rows stay legible. */
function ChannelPill({ channel }: { channel: Channel }) {
  return (
    <div className="flex items-center gap-2.5 shrink-0 px-3.5 py-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-line)] hover:border-brand-500/30 hover:bg-brand-500/[0.05] transition-colors shadow-card">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full rounded-full bg-live/60 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
      </span>
      <div className="w-7 h-7 rounded-lg bg-[var(--color-surface-2)] flex items-center justify-center shrink-0 overflow-hidden">
        <ChannelLogoImage
          src={channel.logo_url || ''}
          alt={channel.name}
          className="w-full h-full object-contain p-1"
          fallbackClassName="text-[10px]"
          containerClassName="w-full h-full"
        />
      </div>
      <span className="text-xs sm:text-sm font-semibold text-[var(--color-ink-muted)] whitespace-nowrap">
        {channel.name}
      </span>
    </div>
  );
}

/**
 * Two-row auto-scrolling marquee of real channel logos.
 * Each row duplicates its content twice and translates -50% for a seamless loop.
 * Pauses on hover (via the `.marquee-pause` parent in globals.css) and falls
 * back to a static layout when prefers-reduced-motion is set.
 */
export default function LiveChannelTicker({ channels }: LiveChannelTickerProps) {
  // Derive per-row duration from the count so wider rows scroll a touch slower
  // (keeps a consistent px/s cadence regardless of channel count).
  // Memoized so it's stable across renders; no effect/state needed.
  const rowDuration = useMemo(
    () => Math.min(70, Math.max(28, channels.length * 1.6)),
    [channels.length]
  );

  // Split into two roughly-even rows. If we have too few channels, fall back to
  // duplicating within a single row so the marquee still looks full.
  const mid = Math.ceil(channels.length / 2);
  const rowA = channels.slice(0, mid);
  const rowB = channels.slice(mid);
  const rows = rowB.length ? [rowA, rowB] : [channels];

  // Render the pill list twice for the seamless -50% translate trick.
  const renderRow = (row: Channel[], reverse: boolean) => {
    const content = (
      <div className="flex gap-3 px-1.5">
        {[...row, ...row].map((ch, i) => (
          // index key is safe here: list is static per render and duplicated intentionally
          <ChannelPill key={`${ch.id}-${i}`} channel={ch} />
        ))}
      </div>
    );
    return (
      <div className="flex w-max">
        <div
          className={reverse ? 'animate-marquee-reverse' : 'animate-marquee'}
          style={{ animationDuration: `${rowDuration}s` }}
        >
          {content}
        </div>
      </div>
    );
  };

  return (
    <div className="marquee-pause relative overflow-hidden py-6 sm:py-8">
      {/* Edge fades so channels slide in/out instead of clipping hard */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 sm:w-32 bg-gradient-to-r from-[var(--color-base)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 sm:w-32 bg-gradient-to-l from-[var(--color-base)] to-transparent" />

      <div className="space-y-3">
        {rows.map((row, i) => renderRow(row, i % 2 === 1))}
      </div>

      {/* Small "live now" caption above, purely decorative reinforcement */}
      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-live/10 border border-live/20">
        <Radio className="w-3 h-3 text-live" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-live">Live now</span>
      </div>
    </div>
  );
}
