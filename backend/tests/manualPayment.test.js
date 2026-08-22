/**
 * Unit tests for the manual UPI payment flow's pure logic: subscription date
 * maths, order-id generation, UTR normalisation and UPI URI building.
 *
 * These are deliberately DB-free — the transactional approve/reject paths are
 * covered by the integration checklist in the feature docs, since they need a
 * live Postgres instance.
 */

const {
  calculateSubscriptionDates,
  generateOrderId,
  generateLicenseKey,
  isSubscriptionActive,
  remainingDays,
} = require('../src/services/subscriptionService');

const {
  normalizeWhatsAppNumber,
  isValidUpiId,
  buildUpiUri,
  isFlowEnabled,
  validateManualConfig,
  PAYMENT_MODES,
} = require('../src/services/paymentSettings');

const { normalizeUtr, maskUtr } = require('../src/controllers/manualOrderController');

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-08-21T10:00:00.000Z');

describe('calculateSubscriptionDates', () => {
  it('starts today for a first-time subscriber', () => {
    const r = calculateSubscriptionDates(30, null, true, NOW);
    expect(r.startDate.getTime()).toBe(NOW.getTime());
    expect(r.expiresAt.getTime()).toBe(NOW.getTime() + 30 * DAY);
    expect(r.stacked).toBe(false);
  });

  it('extends from the existing expiry when a live subscription is renewed', () => {
    const currentExpiry = new Date(NOW.getTime() + 10 * DAY);
    const r = calculateSubscriptionDates(30, currentExpiry, true, NOW);
    expect(r.startDate.getTime()).toBe(currentExpiry.getTime());
    // 10 unused days are preserved on top of the new 30.
    expect(r.expiresAt.getTime()).toBe(NOW.getTime() + 40 * DAY);
    expect(r.stacked).toBe(true);
  });

  it('starts today when stacking is disabled, even with time remaining', () => {
    const currentExpiry = new Date(NOW.getTime() + 10 * DAY);
    const r = calculateSubscriptionDates(30, currentExpiry, false, NOW);
    expect(r.startDate.getTime()).toBe(NOW.getTime());
    expect(r.expiresAt.getTime()).toBe(NOW.getTime() + 30 * DAY);
    expect(r.stacked).toBe(false);
  });

  it('does not stack onto an already-expired subscription', () => {
    const pastExpiry = new Date(NOW.getTime() - 5 * DAY);
    const r = calculateSubscriptionDates(30, pastExpiry, true, NOW);
    expect(r.startDate.getTime()).toBe(NOW.getTime());
    expect(r.expiresAt.getTime()).toBe(NOW.getTime() + 30 * DAY);
    expect(r.stacked).toBe(false);
  });

  it('ignores an unparseable existing expiry rather than producing an invalid date', () => {
    const r = calculateSubscriptionDates(30, 'not-a-date', true, NOW);
    expect(Number.isNaN(r.expiresAt.getTime())).toBe(false);
    expect(r.expiresAt.getTime()).toBe(NOW.getTime() + 30 * DAY);
  });

  it('handles each configured plan length', () => {
    [30, 90, 180, 365].forEach((days) => {
      const r = calculateSubscriptionDates(days, null, true, NOW);
      expect(r.expiresAt.getTime() - r.startDate.getTime()).toBe(days * DAY);
    });
  });

  it('rejects a non-positive or non-numeric duration', () => {
    expect(() => calculateSubscriptionDates(0, null, true, NOW)).toThrow();
    expect(() => calculateSubscriptionDates(-5, null, true, NOW)).toThrow();
    expect(() => calculateSubscriptionDates(undefined, null, true, NOW)).toThrow();
    expect(() => calculateSubscriptionDates('abc', null, true, NOW)).toThrow();
  });
});

describe('isSubscriptionActive / remainingDays', () => {
  it('treats a future expiry on an active row as active', () => {
    expect(isSubscriptionActive({ status: 'active', expires_at: new Date(NOW.getTime() + DAY) }, NOW)).toBe(true);
  });

  it('treats a past expiry as inactive even while status still says active', () => {
    // The safety net for a delayed expiry job.
    expect(isSubscriptionActive({ status: 'active', expires_at: new Date(NOW.getTime() - DAY) }, NOW)).toBe(false);
  });

  it('rejects non-active statuses and missing input', () => {
    expect(isSubscriptionActive({ status: 'cancelled', expires_at: new Date(NOW.getTime() + DAY) }, NOW)).toBe(false);
    expect(isSubscriptionActive({ status: 'active', expires_at: null }, NOW)).toBe(false);
    expect(isSubscriptionActive(null, NOW)).toBe(false);
  });

  it('rounds remaining days up and never goes negative', () => {
    expect(remainingDays(new Date(NOW.getTime() + 10 * DAY), NOW)).toBe(10);
    expect(remainingDays(new Date(NOW.getTime() + 1.2 * DAY), NOW)).toBe(2);
    expect(remainingDays(new Date(NOW.getTime() - 5 * DAY), NOW)).toBe(0);
    expect(remainingDays(null, NOW)).toBe(0);
  });
});

describe('generateOrderId', () => {
  it('matches NIVA-YYYYMMDD-XXXXXX', () => {
    expect(generateOrderId('NIVA', NOW)).toMatch(/^NIVA-\d{8}-[0-9A-Z]{6}$/);
  });

  it('embeds the given date', () => {
    expect(generateOrderId('NIVA', new Date('2026-01-05T00:00:00Z'))).toContain('-20260105-');
  });

  it('avoids characters that are misread aloud (I, O, 0, 1)', () => {
    for (let i = 0; i < 200; i++) {
      const suffix = generateOrderId().split('-')[2];
      expect(suffix).not.toMatch(/[IO01]/);
    }
  });

  it('does not collide across many generations', () => {
    const ids = new Set();
    for (let i = 0; i < 2000; i++) ids.add(generateOrderId());
    expect(ids.size).toBe(2000);
  });
});

describe('generateLicenseKey', () => {
  it('matches NVT-XXXX-XXXX-XXXX', () => {
    expect(generateLicenseKey()).toMatch(/^NVT-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });
});

describe('normalizeUtr', () => {
  it('collapses case, spaces and punctuation so duplicates cannot slip through', () => {
    expect(normalizeUtr('  123456789012 ')).toBe('123456789012');
    expect(normalizeUtr('abc-123 def')).toBe('ABC123DEF');
    expect(normalizeUtr('123456789012')).toBe(normalizeUtr(' 1234 5678 9012 '));
    expect(normalizeUtr('utr123')).toBe(normalizeUtr('UTR-123'));
  });

  it('handles null and undefined', () => {
    expect(normalizeUtr(null)).toBe('');
    expect(normalizeUtr(undefined)).toBe('');
  });
});

describe('maskUtr', () => {
  it('reveals only the last four characters', () => {
    expect(maskUtr('123456789012')).toBe('••••••••9012');
    expect(maskUtr('1234')).toBe('1234');
    expect(maskUtr('')).toBe('');
  });
});

describe('normalizeWhatsAppNumber', () => {
  it('strips +, spaces, hyphens and brackets', () => {
    expect(normalizeWhatsAppNumber('+91 98765-43210')).toBe('919876543210');
    expect(normalizeWhatsAppNumber('(+91) 98765 43210')).toBe('919876543210');
  });

  it('assumes India for a bare 10-digit number', () => {
    expect(normalizeWhatsAppNumber('9876543210')).toBe('919876543210');
  });

  it('leaves an already-prefixed number alone', () => {
    expect(normalizeWhatsAppNumber('919876543210')).toBe('919876543210');
  });

  it('returns empty for unusable input', () => {
    expect(normalizeWhatsAppNumber('')).toBe('');
    expect(normalizeWhatsAppNumber('abc')).toBe('');
    expect(normalizeWhatsAppNumber('12345')).toBe('');
    expect(normalizeWhatsAppNumber('1234567890123456789')).toBe('');
  });
});

describe('isValidUpiId', () => {
  it('accepts real VPA shapes', () => {
    ['merchant@okhdfcbank', 'nivatv.pay@ybl', 'abc-123@paytm', 'a_b@upi'].forEach((v) =>
      expect(isValidUpiId(v)).toBe(true)
    );
  });

  it('rejects anything that is not name@handle', () => {
    ['', 'noatsign', '@bank', 'user@', 'user@@bank', 'user name@bank', null, undefined].forEach((v) =>
      expect(isValidUpiId(v)).toBe(false)
    );
  });
});

describe('buildUpiUri', () => {
  const base = { upiId: 'merchant@okhdfcbank', merchantName: 'NivaTV Media', currency: 'INR' };

  it('always renders the amount with two decimals', () => {
    expect(buildUpiUri({ ...base, amountRupees: 99 })).toContain('am=99.00');
    expect(buildUpiUri({ ...base, amountRupees: 249.5 })).toContain('am=249.50');
    expect(buildUpiUri({ ...base, amountRupees: '799' })).toContain('am=799.00');
  });

  it('includes the payee, currency and scheme', () => {
    const uri = buildUpiUri({ ...base, amountRupees: 449 });
    expect(uri.startsWith('upi://pay?')).toBe(true);
    expect(uri).toContain('pa=merchant%40okhdfcbank');
    expect(uri).toContain('cu=INR');
  });

  it('encodes spaces as %20, not + (some UPI apps show + literally)', () => {
    const uri = buildUpiUri({ ...base, amountRupees: 99 });
    expect(uri).toContain('pn=NivaTV%20Media');
    expect(uri).not.toContain('+');
  });

  it('strips punctuation from the note and caps its length', () => {
    const uri = buildUpiUri({ ...base, amountRupees: 99, note: '3 Months (Save 15%) — best!' });
    expect(uri).toContain('tn=3%20Months%20Save%2015');
    const note = new URL(uri.replace('upi://', 'https://')).searchParams.get('tn');
    expect(note.length).toBeLessThanOrEqual(50);
  });

  it('omits the note entirely when nothing usable remains', () => {
    expect(buildUpiUri({ ...base, amountRupees: 99, note: '!!!' })).not.toContain('tn=');
    expect(buildUpiUri({ ...base, amountRupees: 99 })).not.toContain('tn=');
  });
});

describe('payment mode switch', () => {
  it('exposes exactly the three supported modes', () => {
    expect(PAYMENT_MODES).toEqual(['razorpay', 'manual', 'both']);
  });

  it('gates each flow on the active mode', () => {
    expect(isFlowEnabled('manual', 'manual')).toBe(true);
    expect(isFlowEnabled('manual', 'razorpay')).toBe(false);
    expect(isFlowEnabled('razorpay', 'razorpay')).toBe(true);
    expect(isFlowEnabled('razorpay', 'manual')).toBe(false);
    // 'both' lets the customer choose.
    expect(isFlowEnabled('both', 'manual')).toBe(true);
    expect(isFlowEnabled('both', 'razorpay')).toBe(true);
  });

  it('reports what is missing before manual mode can be enabled', () => {
    expect(validateManualConfig({ upi_id: 'merchant@okhdfcbank', whatsapp_admin_number: '919876543210' })).toEqual([]);
    expect(validateManualConfig({ upi_id: '', whatsapp_admin_number: '919876543210' })).toContain('UPI ID is not configured');
    expect(validateManualConfig({ upi_id: 'merchant@okhdfcbank', whatsapp_admin_number: '' }))
      .toContain('Admin WhatsApp number is not configured');
    expect(validateManualConfig({ upi_id: 'nonsense', whatsapp_admin_number: '919876543210' }))
      .toContain('Configured UPI ID is not a valid VPA');
  });
});
