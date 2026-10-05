'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Smartphone, Mail, ArrowRight, Loader2, Lock, User as UserIcon } from 'lucide-react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '@/contexts/AuthContext';

const GOOGLE_CLIENT_ID = '73771138100-in6cnnidmh4hd3ltcubls6glq4a3k0rj.apps.googleusercontent.com';

function CustomGoogleButton({ onSuccess, onError, disabled }: { onSuccess: (token: string) => void, onError: (err: string) => void, disabled: boolean }) {
  const login = useGoogleLogin({
    onSuccess: (codeResponse) => {
      onSuccess(codeResponse.access_token);
    },
    onError: () => onError('Google login failed')
  });

  return (
    <button
      type="button"
      onClick={() => login()}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 rounded-xl font-medium transition-colors border border-transparent disabled:opacity-50 cursor-pointer"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path fill="currentColor" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.36,22 12.22,22C17,22 21.6,18.33 21.6,12.73C21.6,11.67 21.35,11.1 21.35,11.1V11.1Z" />
      </svg>
      Continue with Google
    </button>
  );
}

export default function AuthModal({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess: (user: any) => void }) {
  const [mounted, setMounted] = useState(false);
  const [method, setMethod] = useState<'select' | 'phone' | 'otp' | 'email_login' | 'email_signup'>('select');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
          mobile: phone ? phone.replace(/[\s\-+]/g, '') : undefined,
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
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 flex items-center justify-between border-b border-white/5 bg-slate-900/50">
          <h2 className="text-lg font-semibold text-white">
            {method === 'email_signup' ? 'Create an Account' : 'Sign In to Continue'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {method === 'select' && (
            <div className="space-y-4">
              <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                <CustomGoogleButton onSuccess={handleGoogleSuccess} onError={setError} disabled={loading} />
              </GoogleOAuthProvider>

              <div className="relative py-2 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                <div className="relative px-4 text-xs font-medium text-slate-500 uppercase bg-slate-900">Or continue with</div>
              </div>

              <button
                type="button"
                onClick={() => { setError(''); setMethod('email_login'); }}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors border border-white/5 cursor-pointer"
              >
                <Mail className="w-5 h-5 text-brand-400" />
                Email & Password
              </button>

              <button
                type="button"
                onClick={() => { setError(''); setMethod('phone'); }}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors border border-white/5 cursor-pointer"
              >
                <Smartphone className="w-5 h-5 text-slate-400" />
                Phone Number (OTP)
              </button>
            </div>
          )}

          {method === 'email_login' && (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors cursor-pointer"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
                {!loading && <ArrowRight className="w-5 h-5" />}
              </button>

              <div className="pt-2 text-center text-xs text-slate-400 space-y-2">
                <div>
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setError(''); setMethod('email_signup'); }}
                    className="text-brand-400 hover:underline font-semibold cursor-pointer"
                  >
                    Sign up now
                  </button>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => { setError(''); setMethod('select'); }}
                    className="text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    Back to other options
                  </button>
                </div>
              </div>
            </form>
          )}

          {method === 'email_signup' && (
            <form onSubmit={handleEmailSignup} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="Your Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Mobile (Optional)</label>
                <div className="relative">
                  <Smartphone className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="tel"
                    placeholder="9999999999"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Password (min 6 characters)</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email || !password || fullName.length < 2}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors cursor-pointer mt-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account & Continue'}
                {!loading && <ArrowRight className="w-5 h-5" />}
              </button>

              <div className="pt-2 text-center text-xs text-slate-400 space-y-2">
                <div>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setError(''); setMethod('email_login'); }}
                    className="text-brand-400 hover:underline font-semibold cursor-pointer"
                  >
                    Sign in
                  </button>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => { setError(''); setMethod('select'); }}
                    className="text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    Back to other options
                  </button>
                </div>
              </div>
            </form>
          )}

          {method === 'phone' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Mobile Number</label>
                <input
                  type="tel"
                  required
                  placeholder="+91 9999999999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading || phone.length < 9}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors cursor-pointer"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send OTP'}
                {!loading && <ArrowRight className="w-5 h-5" />}
              </button>
              <button type="button" onClick={() => { setError(''); setMethod('select'); }} className="w-full text-center text-sm text-slate-400 hover:text-white pt-2 cursor-pointer">
                Back to all options
              </button>
            </form>
          )}

          {method === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center mb-6">
                <p className="text-sm text-slate-400">Enter the 6-digit code sent to</p>
                <p className="font-medium text-white">{phone}</p>
              </div>
              <div>
                <input
                  type="text"
                  required
                  placeholder="000000"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest placeholder-slate-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors cursor-pointer"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & Login'}
              </button>
              <button type="button" onClick={() => { setError(''); setMethod('phone'); }} className="w-full text-center text-sm text-slate-400 hover:text-white pt-2 cursor-pointer">
                Change phone number
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
