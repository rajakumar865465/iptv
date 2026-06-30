'use client';

// Keys stored in localStorage
const K = {
  pages: 'nivatv_pages_visited',
  sessions: 'nivatv_session_count',
  pricingSeconds: 'nivatv_pricing_seconds',
  trialUsed: 'nivatv_trial_used',
  offerShown: 'nivatv_offer_shown',
  offerPrice: 'nivatv_offer_price',
  lastSession: 'nivatv_last_session',
} as const;

function ls(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, val: string) {
  try { localStorage.setItem(key, val); } catch { /* noop */ }
}

// ---------- Session detection ----------

function initSession() {
  const SESSION_GAP_MS = 30 * 60 * 1000; // 30 minutes = new session
  const now = Date.now();
  const last = parseInt(ls(K.lastSession) || '0', 10);
  if (now - last > SESSION_GAP_MS) {
    lsSet(K.sessions, String((parseInt(ls(K.sessions) || '0', 10)) + 1));
  }
  lsSet(K.lastSession, String(now));
}

// ---------- Page tracking ----------

export function trackPageVisit(page: string) {
  if (typeof window === 'undefined') return;
  initSession();
  const pages: string[] = JSON.parse(ls(K.pages) || '[]');
  if (!pages.includes(page)) {
    pages.push(page);
    lsSet(K.pages, JSON.stringify(pages));
  }
}

// ---------- Pricing time ----------

let _pricingStart = 0;
let _pricingInterval: ReturnType<typeof setInterval> | null = null;

export function startPricingTimer() {
  if (typeof window === 'undefined') return;
  _pricingStart = Date.now();
  _pricingInterval = setInterval(() => {
    const elapsed = Math.round((Date.now() - _pricingStart) / 1000);
    const prev = parseInt(ls(K.pricingSeconds) || '0', 10);
    lsSet(K.pricingSeconds, String(prev + elapsed));
    _pricingStart = Date.now(); // reset for next tick
  }, 5000); // update every 5s
}

export function stopPricingTimer() {
  if (_pricingInterval) {
    clearInterval(_pricingInterval);
    _pricingInterval = null;
  }
  if (_pricingStart) {
    const elapsed = Math.round((Date.now() - _pricingStart) / 1000);
    const prev = parseInt(ls(K.pricingSeconds) || '0', 10);
    lsSet(K.pricingSeconds, String(prev + elapsed));
    _pricingStart = 0;
  }
}

// ---------- Trial flag ----------

export function markTrialUsed() {
  lsSet(K.trialUsed, '1');
}

export function markOfferShown(price: number) {
  lsSet(K.offerShown, '1');
  lsSet(K.offerPrice, String(price));
}

// ---------- Engagement algorithm ----------

function roundToNine(n: number): number {
  // Round down to nearest x9 within [29, 49]
  if (n <= 29) return 29;
  if (n <= 39) return 39;
  return 49;
}

export function computeOfferPrice(): number | null {
  if (typeof window === 'undefined') return null;
  if (ls(K.offerShown) === '1') return null;

  const pages: string[] = JSON.parse(ls(K.pages) || '[]');
  const sessions = parseInt(ls(K.sessions) || '1', 10);
  const pricingSeconds = parseInt(ls(K.pricingSeconds) || '0', 10);

  let score = 0;
  if (pages.includes('pricing')) score += 10;
  if (pages.includes('features')) score += 5;
  if (pages.includes('browse')) score += 5;
  if (pricingSeconds > 45) score += 10;
  if (sessions >= 2) score += 15;
  // Extra pages beyond 2
  const extraPages = Math.max(0, pages.length - 2);
  score += extraPages * 10;

  // Higher score = more engaged = better discount
  if (score >= 40) return 29;
  if (score >= 20) return 39;
  return 49;
}

export function isEligibleForOffer(): boolean {
  if (typeof window === 'undefined') return false;
  return ls(K.offerShown) !== '1';
}

export function getStoredOfferPrice(): number | null {
  const v = ls(K.offerPrice);
  return v ? parseInt(v, 10) : null;
}
