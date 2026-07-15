import type { ReactNode } from 'react';

interface SectionHeadingProps {
  /** Small uppercase label above the title. */
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Center (default), or left-aligned for inline layouts. */
  align?: 'center' | 'left';
  className?: string;
}

/**
 * Shared section header: eyebrow + title + subtitle.
 * Enforces Poppins display font and balanced line wrapping so every
 * section on the landing page reads consistently.
 */
export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'center',
  className = '',
}: SectionHeadingProps) {
  const isCenter = align === 'center';
  return (
    <div
      className={`${isCenter ? 'text-center mx-auto' : 'text-left'} max-w-2xl ${className}`.trim()}
    >
      {eyebrow && (
        <div
          className={`inline-flex items-center gap-2 mb-3 ${isCenter ? 'justify-center' : ''}`}
        >
          <span className="h-px w-6 bg-gradient-to-r from-transparent to-indigo-500/60" />
          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.18em] text-indigo-400">
            {eyebrow}
          </span>
          {isCenter && (
            <span className="h-px w-6 bg-gradient-to-l from-transparent to-indigo-500/60" />
          )}
        </div>
      )}
      <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-tight text-balance">
        {title}
      </h2>
      {subtitle && (
        <p className="text-slate-400 text-sm sm:text-lg mt-2 sm:mt-3 leading-relaxed text-balance">
          {subtitle}
        </p>
      )}
    </div>
  );
}
