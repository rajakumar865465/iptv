'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Tv, Key, Download } from 'lucide-react';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/features', label: 'Features' },
  { href: '/browse', label: 'Channels' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/download', label: 'Download APK' },
  { href: '/support', label: 'Support' },
];

export default function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-black/90 backdrop-blur-xl border-b border-white/10 shadow-lg' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center group-hover:bg-red-500 transition-colors">
              <Tv className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white text-base sm:text-lg">
              IPTV<span className="text-red-500">Live</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? 'text-red-400 bg-red-500/10'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/pricing"
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
            >
              Buy Now
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden text-slate-300 hover:text-white p-2 -mr-2"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu - full screen overlay */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 top-14 bg-black/95 backdrop-blur-xl z-40 overflow-y-auto">
          <div className="px-5 pt-6 pb-10">
            <nav className="space-y-1">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`block px-4 py-3.5 rounded-xl text-base font-medium transition-colors ${
                    pathname === link.href
                      ? 'text-red-400 bg-red-500/10'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-8 space-y-3">
              <Link
                href="/pricing"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full px-4 py-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-base font-bold transition-colors"
              >
                <Key className="w-5 h-5" /> Buy License
              </Link>
              <Link
                href="/download"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full px-4 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-base font-bold border border-white/10 transition-colors"
              >
                <Download className="w-5 h-5" /> Download APK
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
