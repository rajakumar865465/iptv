'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X, Key, Download, Shield, User, LogOut } from 'lucide-react';

import AuthModal from '@/components/auth/AuthModal';
import ThemeToggle from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';

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
  const { user, logout: authLogout, setUser } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

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
    authLogout();
    setDropdownOpen(false);
  };

  return (
    <>
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} onSuccess={(u) => setUser(u)} />
      
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          scrolled
            ? 'bg-[var(--color-surface)]/90 backdrop-blur-xl border-b border-[var(--color-line)] shadow-sm'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <Image src="/logo.png" alt="NivaTV Logo" width={56} height={56} className="h-12 sm:h-14 w-auto object-contain" priority />
              <span className="font-display text-2xl font-bold tracking-tight leading-none select-none hidden sm:block">
                <span className="text-[var(--color-ink)]">Niva</span>
                <span className="text-brand-500">TV</span>
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-colors group ${
                    pathname === link.href
                      ? 'text-brand-500 bg-brand-500/10'
                      : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
                  }`}
                >
                  {link.label}
                  {/* Animated underline on active link */}
                  {pathname === link.href && (
                    <span className="absolute bottom-0.5 left-3 right-3 h-0.5 bg-brand-500 rounded-full" />
                  )}
                </Link>
              ))}

              {/* Admin Panel link for privileged users */}
              {isAdmin && (
                <Link
                  href="/dashboard"
                  className={`relative px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
                    pathname.startsWith('/dashboard') || pathname.startsWith('/channels') || pathname.startsWith('/orders')
                      ? 'text-brand-500 bg-brand-500/15 border border-brand-500/30'
                      : 'text-brand-500 hover:text-brand-400 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/25 shadow-sm'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 text-brand-500" />
                  <span>Admin Panel</span>
                </Link>
              )}
            </nav>

            {/* Desktop CTA, Theme Toggle & Auth */}
            <div className="hidden md:flex items-center gap-2">
              {/* Theme toggle */}
              <ThemeToggle />

              {!user ? (
                <>
                  <button
                    onClick={() => setAuthOpen(true)}
                    className="px-4 py-2 text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] text-sm font-medium transition-colors cursor-pointer"
                  >
                    Log In
                  </button>
                  <Link
                    href="/pricing"
                    className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-all shadow-lg shadow-brand-600/20 hover:shadow-brand-500/30 hover:-translate-y-px"
                  >
                    Buy Now
                  </Link>
                </>
              ) : (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)] border border-[var(--color-line)] transition-colors cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {user.full_name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <span className="text-sm font-medium text-[var(--color-ink)] max-w-[110px] truncate">
                      {user.full_name || user.mobile || 'User'}
                    </span>
                    {isAdmin && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-brand-500/15 text-brand-500 border border-brand-500/20">
                        Admin
                      </span>
                    )}
                  </button>
                  
                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-[var(--color-surface)] border border-[var(--color-line)] rounded-xl shadow-card-lg py-2 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-4 py-2 border-b border-[var(--color-line)] bg-[var(--color-surface-2)]/40">
                        <p className="text-xs font-bold text-[var(--color-ink)] truncate">
                          {user.full_name || 'Account'}
                        </p>
                        <p className="text-[11px] text-[var(--color-ink-subtle)] truncate">
                          {user.email || user.mobile}
                        </p>
                        {isAdmin && (
                          <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-500 border border-brand-500/30">
                            <Shield className="w-2.5 h-2.5" />
                            {user.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                          </span>
                        )}
                      </div>

                      {isAdmin && (
                        <Link
                          href="/dashboard"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-brand-500 hover:text-brand-400 hover:bg-brand-500/10 transition-colors"
                        >
                          <Shield className="w-4 h-4 text-brand-500 shrink-0" />
                          <span>Admin Dashboard</span>
                        </Link>
                      )}

                      <Link
                        href="/my-account"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] transition-colors"
                      >
                        <User className="w-4 h-4 shrink-0" />
                        <span>My Account</span>
                      </Link>

                      <div className="border-t border-[var(--color-line)] my-1" />

                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2.5 w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 shrink-0" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

          {/* Mobile: theme toggle + menu toggle */}
          <div className="md:hidden flex items-center gap-1">
            <ThemeToggle />
            <button
              className="text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] p-2 -mr-2 transition-colors cursor-pointer"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu - full screen overlay */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 top-14 bg-[var(--color-base)]/98 backdrop-blur-xl z-40 overflow-y-auto border-t border-[var(--color-line)]">
          <div className="px-5 pt-6 pb-10">
            <nav className="space-y-1">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`block px-4 py-3.5 rounded-xl text-base font-medium transition-colors ${
                    pathname === link.href
                      ? 'text-brand-500 bg-brand-500/10'
                      : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              {/* Admin Panel link in mobile menu */}
              {isAdmin && (
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl text-base font-bold text-brand-500 bg-brand-500/15 border border-brand-500/30 transition-colors mt-2"
                >
                  <Shield className="w-5 h-5 text-brand-500" />
                  <span>Admin Panel</span>
                </Link>
              )}
            </nav>
            <div className="mt-8 space-y-3">
              <Link
                href="/pricing"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full px-4 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-base font-bold transition-colors shadow-lg shadow-brand-600/25"
              >
                <Key className="w-5 h-5" /> Buy License
              </Link>
              <Link
                href="/download"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full px-4 py-3.5 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)] text-[var(--color-ink)] text-base font-bold border border-[var(--color-line)] transition-colors"
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
