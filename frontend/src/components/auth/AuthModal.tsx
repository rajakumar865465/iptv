'use client';
import { useState } from 'react';
import { X, Smartphone, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = '73771138100-in6cnnidmh4hd3ltcubls6glq4a3k0rj.apps.googleusercontent.com';

export default function AuthModal({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess: (user: any) => void }) {
  const [method, setMethod] = useState<'select' | 'phone' | 'otp'>('select');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Google login failed');
      
      localStorage.setItem('adminToken', data.data.token); // Store token
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
      
      localStorage.setItem('adminToken', data.data.token);
      onSuccess(data.data.user);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-4 flex items-center justify-between border-b border-white/5 bg-slate-900/50">
          <h2 className="text-lg font-semibold text-white">Sign In or Create Account</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition-colors">
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
              {GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE' ? (
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white/5 text-slate-500 rounded-xl font-medium border border-white/5 cursor-not-allowed"
                >
                  <svg className="w-5 h-5 opacity-50" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.36,22 12.22,22C17,22 21.6,18.33 21.6,12.73C21.6,11.67 21.35,11.1 21.35,11.1V11.1Z" />
                  </svg>
                  Google Login (Missing Client ID)
                </button>
              ) : (
                <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                  <div className="flex justify-center w-full bg-white rounded-xl overflow-hidden hover:opacity-90 transition-opacity">
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={() => setError('Google login popup closed or failed')}
                      useOneTap
                      theme="outline"
                      size="large"
                      shape="rectangular"
                      width="100%"
                    />
                  </div>
                </GoogleOAuthProvider>
              )}

              <div className="relative py-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                <div className="relative px-4 text-xs font-medium text-slate-500 uppercase bg-slate-900">Or</div>
              </div>

              <button
                onClick={() => setMethod('phone')}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors border border-white/5"
              >
                <Smartphone className="w-5 h-5 text-slate-400" />
                Continue with Phone Number
              </button>
            </div>
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={loading || phone.length < 9}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send OTP'}
                {!loading && <ArrowRight className="w-5 h-5" />}
              </button>
              <button type="button" onClick={() => setMethod('select')} className="w-full text-center text-sm text-slate-400 hover:text-white pt-2">
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
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & Login'}
              </button>
              <button type="button" onClick={() => setMethod('phone')} className="w-full text-center text-sm text-slate-400 hover:text-white pt-2">
                Change phone number
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
