'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { X, Sparkles, Clock } from 'lucide-react';
import { markOfferShown } from '@/lib/behaviorTracker';

interface Props {
  price: number;    // 29 | 39 | 49
  planId: number;   // DB id of the 7-day offer plan
  onClose: () => void;
}

const COUNTDOWN_SECONDS = 5 * 60; // 5 minutes

function useCountdown(seconds: number, onExpire: () => void) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    const t = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) { clearInterval(t); onExpire(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [onExpire]);
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function ScratchCardModal({ price, planId, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [scratching, setScratching] = useState(false);
  const isPointerDown = useRef(false);

  const CARD_W = 260;
  const CARD_H = 140;
  const REVEAL_THRESHOLD = 0.5;

  const handleClose = useCallback(() => {
    markOfferShown(price);
    onClose();
  }, [price, onClose]);

  const countdown = useCountdown(COUNTDOWN_SECONDS, handleClose);

  // Draw the gold foil layer on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Gold gradient foil
    const grad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
    grad.addColorStop(0, '#c8a415');
    grad.addColorStop(0.3, '#f0d060');
    grad.addColorStop(0.5, '#fef3a0');
    grad.addColorStop(0.7, '#f0d060');
    grad.addColorStop(1, '#c8a415');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    // Texture lines
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < CARD_W; i += 8) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CARD_H); ctx.stroke();
    }

    // Scratch hint text
    ctx.fillStyle = 'rgba(120,80,0,0.7)';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✦ SCRATCH TO REVEAL ✦', CARD_W / 2, CARD_H / 2 + 5);
  }, []);

  const checkRevealProgress = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || revealed) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pixels = ctx.getImageData(0, 0, CARD_W, CARD_H).data;
    let transparent = 0;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] < 128) transparent++;
    }
    if (transparent / (CARD_W * CARD_H) > REVEAL_THRESHOLD) {
      // Clear remaining foil
      ctx.clearRect(0, 0, CARD_W, CARD_H);
      setRevealed(true);
      markOfferShown(price);
    }
  }, [revealed, price]);

  const scratch = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const cx = (x - rect.left) * (CARD_W / rect.width);
    const cy = (y - rect.top) * (CARD_H / rect.height);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    checkRevealProgress();
  }, [checkRevealProgress]);

  // Mouse events
  const onMouseDown = (e: React.MouseEvent) => { isPointerDown.current = true; scratch(e.clientX, e.clientY); };
  const onMouseMove = (e: React.MouseEvent) => { if (isPointerDown.current) scratch(e.clientX, e.clientY); };
  const onMouseUp = () => { isPointerDown.current = false; };

  // Touch events
  const onTouchStart = (e: React.TouchEvent) => { e.preventDefault(); scratch(e.touches[0].clientX, e.touches[0].clientY); };
  const onTouchMove = (e: React.TouchEvent) => { e.preventDefault(); scratch(e.touches[0].clientX, e.touches[0].clientY); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="relative bg-[#0e0e12] border border-white/10 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-white" />
        </button>

        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500/20 via-yellow-400/15 to-amber-500/20 border-b border-amber-500/20 px-6 pt-6 pb-5 text-center">
          <div className="flex justify-center mb-2">
            <Sparkles className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="text-xl font-extrabold text-white mb-1">Congratulations!</h2>
          <p className="text-amber-300/80 text-sm">You&apos;ve unlocked a special offer</p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col items-center gap-4">

          {/* Price reveal area (hidden behind canvas) */}
          <div className="relative" style={{ width: CARD_W, height: CARD_H }}>
            {/* Price shown underneath */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border border-white/10 flex flex-col items-center justify-center">
              <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">7 Days Access</p>
              <div className="flex items-end gap-1">
                <span className="text-slate-500 text-sm line-through">₹49</span>
                <span className="text-4xl font-extrabold text-amber-400">₹{price}</span>
              </div>
              <p className="text-green-400 text-xs mt-1 font-semibold">
                {price < 49 ? `You save ₹${49 - price}!` : 'Launch price!'}
              </p>
            </div>

            {/* Scratch canvas overlay */}
            {!revealed && (
              <canvas
                ref={canvasRef}
                width={CARD_W}
                height={CARD_H}
                className="absolute inset-0 rounded-2xl cursor-crosshair touch-none"
                style={{ width: '100%', height: '100%' }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
              />
            )}
          </div>

          {!revealed && !scratching && (
            <p className="text-slate-400 text-xs">Scratch the card above to reveal your price</p>
          )}

          {/* CTA — shown when revealed */}
          {revealed && (
            <div className="w-full flex flex-col gap-3 mt-1">
              <div className="text-center">
                <p className="text-white font-semibold text-sm mb-0.5">7 Days Full Access</p>
                <p className="text-slate-400 text-xs">All live TV channels · 1 Device · No auto-renewal</p>
              </div>
              <Link
                href={`/payment?plan_id=${planId}&offer_price=${price}`}
                onClick={() => markOfferShown(price)}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-colors shadow-lg shadow-amber-500/25"
              >
                <Sparkles className="w-4 h-4" />
                Claim ₹{price} Offer
              </Link>
            </div>
          )}

          {/* Countdown */}
          <div className="flex items-center gap-1.5 text-slate-500 text-xs">
            <Clock className="w-3.5 h-3.5 text-red-500/70" />
            <span>Offer expires in <span className="text-red-400 font-mono font-semibold">{countdown}</span></span>
          </div>

          <button
            onClick={handleClose}
            className="text-slate-600 hover:text-slate-400 text-xs transition-colors"
          >
            No thanks, skip this offer
          </button>
        </div>
      </div>
    </div>
  );
}
