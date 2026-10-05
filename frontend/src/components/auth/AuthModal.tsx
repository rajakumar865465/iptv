'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import {
  X,
  Smartphone,
  Mail,
  ArrowRight,
  Loader2,
  Lock,
  User as UserIcon,
  ChevronRight,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '@/contexts/AuthContext';

const GOOGLE_CLIENT_ID = '73771138100-in6cnnidmh4hd3ltcubls6glq4a3k0rj.apps.googleusercontent.com';

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function CustomGoogleButton({
  onSuccess,
  onError,
  disabled
}: {
  onSuccess: (token: string) => void;
  onError: (err: string) => void;
  disabled: boolean;
}) {
  const login = useGoogleLogin({
    onSuccess: (codeResponse) => {
      onSuccess(codeResponse.access_token);
    },
    onError: () => onError('Google sign in was canceled or failed.')
  });

  return (
    <button
      type="button"
      onClick={() => login()}
      disabled={disabled}
      className="w-full relative flex items-center justify-center gap-3 py-3.5 px-5 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-900 rounded-2xl font-semibold text-sm transition-all shadow-md hover:shadow-lg border border-white/20 disabled:opacity-50 cursor-pointer group"
    >
      <GoogleIcon />
      <span className="tracking-tight font-medium text-slate-800 group-hover:text-slate-950">Continue with Google</span>
    </button>
  );
}

export default function AuthModal({
  isOpen,
  onClose,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [method, setMethod] = useState<'select' | 'phone' | 'otp' | 'email_login' | 'email_signup'>('select');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const handleGoogleSuccess = async (accessToken: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Google login failed');

      login(data.data.token, data.data.user);
      onSuccess(data.data.user);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: phone })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send OTP');

      setMethod('otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: phone, code: otp })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid OTP');

      login(data.data.token, data.data.user);
      onSuccess(data.data.user);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Login failed. Please check your credentials.');
      }

      login(data.data.token, data.data.user);
      onSuccess(data.data.user);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
          mobile: phone ? phone.replace(/[\s\-+]/g, '') : undefined
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Signup failed. Please try again.');
      }

      login(data.data.token, data.data.user);
      onSuccess(data.data.user);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-white/10 rounded-3xl overflow-hidden shadow-[0_25px_70px_rgba(0,0,0,0.85)] z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glows */}
        <div className="absolute -top-24 -left-20 w-52 h-52 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-24 -right-20 w-52 h-52 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Top Bar */}
        <div className="relative px-6 pt-6 pb-4 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
              <Image src="/logo.png" alt="NivaTV" width={26} height={26} className="object-contain" priority />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                Niva<span className="text-brand-500">TV</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  Pass
                </span>
              </h2>
              <p className="text-xs text-slate-400">Stream 500+ Indian Live Channels</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 border border-white/5 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 relative">
          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium text-center flex items-center justify-center gap-2 animate-in fade-in">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* MAIN SELECTION VIEW */}
          {method === 'select' && (
            <div className="space-y-4">
              <div className="text-center mb-5">
                <h3 className="text-xl font-extrabold text-white tracking-tight mb-1">
                  Sign In to Continue
                </h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Access your subscription, sync devices, and unlock immediate live stream playback.
                </p>
              </div>

              {/* 1. Google One-Tap */}
              <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                <CustomGoogleButton onSuccess={handleGoogleSuccess} onError={setError} disabled={loading} />
              </GoogleOAuthProvider>

              {/* Divider */}
              <div className="relative py-2.5 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-900 rounded-full border border-white/5">
                  Or continue with
                </div>
              </div>

              {/* 2. Email & Password Card */}
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setMethod('email_login');
                }}
                className="w-full flex items-center justify-between p-3.5 bg-slate-800/60 hover:bg-slate-800 text-left rounded-2xl border border-white/10 hover:border-brand-500/40 transition-all duration-200 group cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 group-hover:scale-105 transition-transform">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white tracking-tight">Email & Password</p>
                    <p className="text-xs text-slate-400">Sign in with password or create new account</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* 3. Phone OTP Card */}
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setMethod('phone');
                }}
                className="w-full flex items-center justify-between p-3.5 bg-slate-800/60 hover:bg-slate-800 text-left rounded-2xl border border-white/10 hover:border-indigo-500/40 transition-all duration-200 group cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white tracking-tight">Phone Number (OTP)</p>
                    <p className="text-xs text-slate-400">Receive a one-time verification code</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* Trust Badge */}
              <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>256-bit encrypted authentication &bull; No spam</span>
              </div>
            </div>
          )}

          {/* EMAIL LOGIN & SIGNUP VIEW */}
          {(method === 'email_login' || method === 'email_signup') && (
            <div>
              {/* Tab Selector */}
              <div className="grid grid-cols-2 p-1 bg-slate-950/80 border border-white/10 rounded-xl mb-5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setMethod('email_login');
                  }}
                  className={`py-2 rounded-lg transition-all cursor-pointer ${
                    method === 'email_login'
                      ? 'bg-brand-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setMethod('email_signup');
                  }}
                  className={`py-2 rounded-lg transition-all cursor-pointer ${
                    method === 'email_signup'
                      ? 'bg-brand-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {method === 'email_login' ? (
                /* LOGIN FORM */
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                        aria-label="Toggle password visibility"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !email || !password}
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-brand-600 via-rose-600 to-brand-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-brand-500/25 cursor-pointer mt-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In & Watch'}
                    {!loading && <ArrowRight className="w-4 h-4" />}
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setMethod('select');
                      }}
                      className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      &larr; Back to all sign in options
                    </button>
                  </div>
                </form>
              ) : (
                /* SIGNUP FORM */
                <form onSubmit={handleEmailSignup} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                    <div className="relative">
                      <UserIcon className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rahul Sharma"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Mobile Number (Optional)</label>
                    <div className="relative">
                      <Smartphone className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                      <input
                        type="tel"
                        placeholder="9876543210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        placeholder="Minimum 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 cursor-pointer"
                        aria-label="Toggle password visibility"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !email || !password || fullName.length < 2}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-brand-600 via-rose-600 to-brand-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-brand-500/25 cursor-pointer mt-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account & Continue'}
                    {!loading && <ArrowRight className="w-4 h-4" />}
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setMethod('select');
                      }}
                      className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      &larr; Back to all sign in options
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* PHONE NUMBER (OTP) VIEW */}
          {method === 'phone' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="text-center mb-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-2 text-indigo-400">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Enter Mobile Number</h3>
                <p className="text-xs text-slate-400">We will send a 6-digit verification code</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Mobile Number</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3.5 text-sm font-semibold text-slate-400">+91</span>
                  <input
                    type="tel"
                    required
                    placeholder="98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-14 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm font-medium tracking-wide"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || phone.length < 9}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/25 cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send OTP Code'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setMethod('select');
                  }}
                  className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  &larr; Back to all options
                </button>
              </div>
            </form>
          )}

          {/* OTP VERIFICATION VIEW */}
          {method === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center mb-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mx-auto mb-2 text-brand-400">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Verify Code</h3>
                <p className="text-xs text-slate-400">
                  Enter the 6-digit OTP sent to <span className="font-semibold text-white">{phone}</span>
                </p>
              </div>

              <div>
                <input
                  type="text"
                  required
                  placeholder="&bull; &bull; &bull; &bull; &bull; &bull;"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-2xl px-4 py-3.5 text-white text-center text-2xl font-mono tracking-[0.5em] placeholder-slate-600 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-brand-500/25 cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Continue'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setMethod('phone');
                  }}
                  className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Change phone number
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
