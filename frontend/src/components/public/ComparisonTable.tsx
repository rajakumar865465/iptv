import { Check, X, Minus } from 'lucide-react';

/**
 * "Why switch to NivaTV" comparison.
 * NivaTV column is highlighted; competitor figures are reasonable generic
 * ballpark values with an "*approximate" footnote — no specific competitor
 * is named or disparaged.
 */
type CellStatus = 'yes' | 'no' | 'partial' | 'text';

interface Row {
  feature: string;
  nivatv: { status: CellStatus; text?: string };
  cable: { status: CellStatus; text?: string };
  otherApps: { status: CellStatus; text?: string };
}

const ROWS: Row[] = [
  {
    feature: 'Starting price',
    nivatv:  { status: 'text', text: '₹10 / trial' },
    cable:   { status: 'text', text: '₹300+/mo*' },
    otherApps:{ status: 'text', text: '₹99+/mo*' },
  },
  {
    feature: 'Devices per license',
    nivatv:  { status: 'text', text: 'Up to 3' },
    cable:   { status: 'text', text: '1 TV box' },
    otherApps:{ status: 'partial', text: 'Often 1' },
  },
  {
    feature: 'Live channels',
    nivatv:  { status: 'text', text: '500+' },
    cable:   { status: 'text', text: '300+*' },
    otherApps:{ status: 'text', text: 'Varies*' },
  },
  {
    feature: 'Indian & regional languages',
    nivatv:  { status: 'yes' },
    cable:   { status: 'partial', text: 'Limited' },
    otherApps:{ status: 'partial', text: 'Some' },
  },
  {
    feature: 'No set-top box / hardware',
    nivatv:  { status: 'yes' },
    cable:   { status: 'no' },
    otherApps:{ status: 'yes' },
  },
  {
    feature: 'Setup time',
    nivatv:  { status: 'text', text: '< 5 min' },
    cable:   { status: 'text', text: 'Days*' },
    otherApps:{ status: 'text', text: 'Minutes' },
  },
  {
    feature: 'No auto-renewal',
    nivatv:  { status: 'yes' },
    cable:   { status: 'no' },
    otherApps:{ status: 'no' },
  },
  {
    feature: 'Cancel anytime, pay only when you want',
    nivatv:  { status: 'yes' },
    cable:   { status: 'no' },
    otherApps:{ status: 'partial', text: 'Limited' },
  },
];

function Cell({ cell, highlight }: { cell: Row['nivatv']; highlight?: boolean }) {
  const tone = highlight
    ? 'text-brand-500 font-bold'
    : 'text-[var(--color-ink-muted)]';
  if (cell.status === 'yes')
    return (
      <>
        <Check aria-hidden="true" className={`w-5 h-5 mx-auto ${highlight ? 'text-green-500' : 'text-green-500/70'}`} />
        <span className="sr-only">Included</span>
      </>
    );
  if (cell.status === 'no')
    return (
      <>
        <X aria-hidden="true" className="w-5 h-5 mx-auto text-[var(--color-ink-subtle)] opacity-50" />
        <span className="sr-only">Not included</span>
      </>
    );
  if (cell.status === 'partial')
    return (
      <span className="inline-flex flex-col items-center gap-0.5">
        <Minus aria-hidden="true" className="w-4 h-4 text-amber-500/80" />
        <span className="sr-only">Partial</span>
        {cell.text && <span className="text-[10px] text-[var(--color-ink-subtle)]">{cell.text}</span>}
      </span>
    );
  return <span className={`text-sm font-semibold ${tone}`}>{cell.text}</span>;
}

export default function ComparisonTable() {
  return (
    <div>
      {/* ---- Desktop / tablet table ---- */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] shadow-card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-line)]">
              <th className="text-left text-xs font-bold uppercase tracking-wider text-[var(--color-ink-subtle)] px-5 py-4 bg-[var(--color-surface-2)]">
                Compare
              </th>
              <th className="relative px-5 py-4 bg-brand-500/[0.06]">
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand-500 to-brand-600" />
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-500 mb-0.5">
                    Best value
                  </span>
                  <span className="font-display text-lg font-extrabold text-[var(--color-ink)]">NivaTV</span>
                </div>
              </th>
              <th className="text-center text-sm font-semibold text-[var(--color-ink-subtle)] px-5 py-4 bg-[var(--color-surface-2)]">Cable / DTH</th>
              <th className="text-center text-sm font-semibold text-[var(--color-ink-subtle)] px-5 py-4 bg-[var(--color-surface-2)]">Other apps</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => (
              <tr
                key={row.feature}
                className={`border-b border-[var(--color-line)] last:border-0 ${i % 2 === 1 ? 'bg-[var(--color-surface-2)]/50' : ''}`}
              >
                <td className="px-5 py-4 text-sm font-medium text-[var(--color-ink-muted)]">{row.feature}</td>
                <td className="px-5 py-4 text-center bg-brand-500/[0.04] border-x border-brand-500/10">
                  <Cell cell={row.nivatv} highlight />
                </td>
                <td className="px-5 py-4 text-center"><Cell cell={row.cable} /></td>
                <td className="px-5 py-4 text-center"><Cell cell={row.otherApps} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---- Mobile: stacked cards ---- */}
      <div className="md:hidden space-y-4">
        {ROWS.map(row => (
          <div
            key={row.feature}
            className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] shadow-card p-4"
          >
            <div className="text-sm font-semibold text-[var(--color-ink)] mb-3">{row.feature}</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-brand-500/[0.08] border border-brand-500/20 py-2.5">
                <Cell cell={row.nivatv} highlight />
                <div className="text-[10px] text-brand-500 mt-1 font-semibold">NivaTV</div>
              </div>
              <div className="rounded-lg py-2.5">
                <Cell cell={row.cable} />
                <div className="text-[10px] text-[var(--color-ink-subtle)] mt-1">Cable</div>
              </div>
              <div className="rounded-lg py-2.5">
                <Cell cell={row.otherApps} />
                <div className="text-[10px] text-[var(--color-ink-subtle)] mt-1">Others</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-[11px] text-[var(--color-ink-subtle)] mt-4">
        *Competitor details are approximate, for comparison only. Prices and packages vary by provider.
      </p>
    </div>
  );
}
