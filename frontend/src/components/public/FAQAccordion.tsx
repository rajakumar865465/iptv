'use client';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FAQItem {
  q: string;
  a: string;
}

interface Props {
  items: FAQItem[];
}

export default function FAQAccordion({ items }: Props) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] shadow-card overflow-hidden transition-all hover:border-brand-500/30"
          >
            <h3 className="m-0">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${i}`}
                id={`faq-trigger-${i}`}
                className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-4 min-h-[44px] text-left cursor-pointer"
              >
                <span className="font-medium text-[var(--color-ink)] text-sm">{item.q}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={`w-5 h-5 text-[var(--color-ink-subtle)] shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </h3>
            <div
              id={`faq-panel-${i}`}
              role="region"
              aria-labelledby={`faq-trigger-${i}`}
              className={`grid transition-all duration-300 ease-out ${
                isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <p className="px-4 sm:px-5 pb-4 text-[var(--color-ink-muted)] text-sm leading-relaxed border-t border-[var(--color-line)]">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
