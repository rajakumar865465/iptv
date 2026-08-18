'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X, Key, Download } from 'lucide-react';

import AuthModal from '@/components/auth/AuthModal';

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
  const [authOpen, setAuthOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    // Check auth on mount
    const token = localStorage.getItem('adminToken');
    if (token) {
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          if (data.data?.user) setUser(data.data.user);
          else localStorage.removeItem('adminToken');
        })
        .catch(() => localStorage.removeItem('adminToken'));
    }
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (menuOpen || authOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen, authOpen]);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setUser(null);
    setDropdownOpen(false);
  };

  return (
    <>
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} onSuccess={(u) => setUser(u)} />
      
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          scrolled ? 'bg-black/90 backdrop-blur-xl border-b border-white/10 shadow-lg' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <Image src="/logo.png" alt="" width={40} height={40} className="h-9 w-auto object-contain" priority />
              <span className="font-display text-xl font-bold tracking-tight leading-none select-none hidden sm:block">
                <span className="text-white">Niva</span>
                <span className="text-brand-500">TV</span>
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
                      ? 'text-brand-400 bg-brand-500/10'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Desktop CTA & Auth */}
            <div className="hidden md:flex items-center gap-3">
              {!user ? (
                <>
                  <button
                    onClick={() => setAuthOpen(true)}
                    className="px-4 py-2 text-slate-300 hover:text-white text-sm font-medium transition-colors"
                  >
                    Log In
                  </button>
                  <Link
                    href="/pricing"
                    className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors"
                  >
                    Buy Now
                  </Link>
                </>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 border border-white/10 transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center text-xs font-bold text-white">
                      {user.full_name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <span className="text-sm font-medium text-white max-w-[100px] truncate">
                      {user.full_name || user.mobile || 'User'}
                    </span>
                  </button>
                  
                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-white/10 rounded-xl shadow-2xl py-1 overflow-hidden">
                      <Link href="/my-account" onClick={() => setDropdownOpen(false)} className="block px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800">
                        My Dashboard
                      </Link>
                      <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-800">
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              )}
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
                      ? 'text-brand-400 bg-brand-500/10'
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
                className="flex items-center justify-center gap-2 w-full px-4 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-base font-bold transition-colors"
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
    </>
  );
}
