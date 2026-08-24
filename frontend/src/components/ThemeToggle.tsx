'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ThemeToggleProps {
  className?: string;
  /** 'icon' = icon-only button (for header/sidebar); 'pill' = labelled pill button */
  variant?: 'icon' | 'pill';
}

export default function ThemeToggle({ className = '', variant = 'icon' }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — render only after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Placeholder same size as the button to avoid layout shift
    return (
      <div
        className={
          variant === 'pill'
            ? `h-9 w-28 rounded-full bg-transparent ${className}`
            : `h-9 w-9 rounded-full bg-transparent ${className}`
        }
        aria-hidden="true"
      />
    );
  }

  const isDark = resolvedTheme === 'dark';
  const label = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';

  const toggle = () => setTheme(isDark ? 'light' : 'dark');

  if (variant === 'pill') {
    return (
      <button
        onClick={toggle}
        aria-label={label}
        title={label}
        className={`
          group inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium
          border transition-all duration-200
          [data-theme='dark']_& : bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white
          bg-zinc-100 border-zinc-200 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900
          data-[theme='dark']:bg-white/5 data-[theme='dark']:border-white/10
          ${className}
        `}
      >
        <span className="relative w-4 h-4 shrink-0">
          <Sun
            className={`absolute inset-0 w-4 h-4 transition-all duration-300 ${
              isDark ? 'opacity-0 scale-50 rotate-90' : 'opacity-100 scale-100 rotate-0'
            }`}
          />
          <Moon
            className={`absolute inset-0 w-4 h-4 transition-all duration-300 ${
              isDark ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90'
            }`}
          />
        </span>
        <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`
        group relative flex items-center justify-center w-9 h-9 rounded-full
        border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-brand-500 focus-visible:ring-offset-2
        ${
          isDark
            ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white hover:border-white/20 focus-visible:ring-offset-gray-950'
            : 'bg-zinc-100 border-zinc-200 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 hover:border-zinc-300 focus-visible:ring-offset-white'
        }
        ${className}
      `}
    >
      <span className="relative w-4 h-4">
        {/* Sun icon — visible in light mode */}
        <Sun
          className={`absolute inset-0 w-4 h-4 transition-all duration-300 ${
            isDark ? 'opacity-0 scale-50 rotate-90' : 'opacity-100 scale-100 rotate-0'
          }`}
        />
        {/* Moon icon — visible in dark mode */}
        <Moon
          className={`absolute inset-0 w-4 h-4 transition-all duration-300 ${
            isDark ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90'
          }`}
        />
      </span>
    </button>
  );
}
