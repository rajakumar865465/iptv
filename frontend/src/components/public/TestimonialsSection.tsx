import { Star, Quote } from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────────
 * PLACEHOLDER REVIEWS — replace with real user reviews when available.
 * Keep tone honest and specific; avoid puffery. Each entry: name, location,
 * star rating (1–5), short quote, optional plan label.
 * ────────────────────────────────────────────────────────────────────────── */
const TESTIMONIALS = [
  {
    name: 'Rahul S.',
    location: 'Patna, Bihar',
    rating: 5,
    plan: '1 Month plan',
    quote:
      'Setup took two minutes. I entered my license key and was watching the news right away — no set-top box, no technician visit.',
  },
  {
    name: 'Priya M.',
    location: 'Coimbatore, Tamil',
    rating: 5,
    plan: '1 Year plan',
    quote:
      'Finally all my Tamil channels in one app. The player is smooth even on my mobile data, and I love that there is no auto-renewal.',
  },
  {
    name: 'Imran K.',
    location: 'Hyderabad',
    rating: 4,
    plan: '1 Month plan',
    quote:
      'Good value for money. I tried the 1-day trial first, liked it, then bought a month. Support replied quickly on WhatsApp when I had a question.',
  },
];

function Stars({ rating }: { rating: number }) {
  return (
    <div role="img" aria-label={`${rating} out of 5 stars`} className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-[var(--color-line)]'}`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export default function TestimonialsSection() {
  return (
    <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
      {TESTIMONIALS.map(t => (
        <figure
          key={t.name}
          className="relative p-5 sm:p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-line)] shadow-card hover:shadow-card-hover hover:border-brand-500/25 hover:-translate-y-1 transition-all overflow-hidden"
        >
          {/* Watermark quote mark */}
          <Quote className="absolute top-4 right-4 w-10 h-10 text-[var(--color-line)] rotate-180 opacity-50" />

          <div className="flex items-center justify-between mb-4">
            <Stars rating={t.rating} />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-500 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full">
              {t.plan}
            </span>
          </div>

          <blockquote className="text-sm sm:text-[15px] text-[var(--color-ink-muted)] leading-relaxed mb-5 relative z-10">
            "{t.quote}"
          </blockquote>

          <figcaption className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500/30 to-brand-700/20 border border-brand-500/20 flex items-center justify-center font-display font-bold text-brand-400 text-sm">
              {t.name.charAt(0)}
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--color-ink)]">{t.name}</div>
              <div className="text-xs text-[var(--color-ink-subtle)]">{t.location}</div>
            </div>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
