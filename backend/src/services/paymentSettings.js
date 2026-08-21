const QRCode = require('qrcode');
const db = require('../config/db');

/**
 * Payment settings service.
 *
 * Everything about *how* the site collects money lives in `app_settings` so it is
 * admin-controlled at runtime — no UPI ID, merchant name or WhatsApp number is
 * hardcoded anywhere in the codebase. Environment variables act as first-boot
 * defaults only (UPI_ID, UPI_MERCHANT_NAME, WHATSAPP_ADMIN_NUMBER, CURRENCY).
 */

// 'razorpay' keeps the original gateway checkout. 'manual' uses UPI + WhatsApp +
// admin approval. 'both' shows the customer a choice.
const PAYMENT_MODES = ['razorpay', 'manual', 'both'];

const PAYMENT_SETTING_KEYS = [
  'payment_mode',
  'upi_id',
  'upi_merchant_name',
  'whatsapp_admin_number',
  'payment_currency',
  'payment_qr_url',
  'manual_payment_instructions',
  'subscription_stacking',
];

const DEFAULTS = {
  payment_mode: 'razorpay',
  upi_id: '',
  upi_merchant_name: '',
  whatsapp_admin_number: '',
  payment_currency: 'INR',
  payment_qr_url: '',
  manual_payment_instructions: '',
  subscription_stacking: 'true',
};

/**
 * WhatsApp deep links (wa.me) accept digits only: country code + number, with no
 * '+', spaces, brackets or hyphens. A bare 10-digit number is assumed to be Indian.
 * Returns '' when the input cannot be made into a usable number.
 */
function normalizeWhatsAppNumber(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  if (withCountry.length < 11 || withCountry.length > 15) return '';
  return withCountry;
}

/** A UPI VPA looks like `name@bank`. Deliberately permissive but not empty-or-garbage. */
function isValidUpiId(value) {
  return /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/.test(String(value ?? '').trim());
}

/**
 * Reads the payment configuration, falling back to env vars then hardcoded
 * defaults. Never returns secrets — every value here is safe to show a customer.
 */
async function getPaymentSettings() {
  let rows = [];
  try {
    const result = await db.query(
      `SELECT setting_key, setting_value FROM app_settings WHERE setting_key = ANY($1)`,
      [PAYMENT_SETTING_KEYS]
    );
    rows = result.rows;
  } catch (err) {
    console.error('getPaymentSettings error:', err.message);
  }

  const stored = {};
  rows.forEach((row) => {
    if (row.setting_value !== null && String(row.setting_value).trim() !== '') {
      stored[row.setting_key] = String(row.setting_value).trim();
    }
  });

  const envFallback = {
    upi_id: process.env.UPI_ID,
    upi_merchant_name: process.env.UPI_MERCHANT_NAME,
    whatsapp_admin_number: process.env.WHATSAPP_ADMIN_NUMBER,
    payment_currency: process.env.CURRENCY,
  };

  const settings = { ...DEFAULTS };
  for (const key of PAYMENT_SETTING_KEYS) {
    const value = stored[key] || (envFallback[key] ? String(envFallback[key]).trim() : '');
    if (value) settings[key] = value;
  }

  // support_whatsapp is the pre-existing customer-support number; reuse it as the
  // verification number when a dedicated one hasn't been configured yet.
  if (!settings.whatsapp_admin_number) {
    try {
      const fb = await db.query(
        `SELECT setting_value FROM app_settings WHERE setting_key = 'support_whatsapp'`
      );
      if (fb.rows[0]?.setting_value) settings.whatsapp_admin_number = String(fb.rows[0].setting_value).trim();
    } catch { /* non-fatal */ }
  }

  if (!PAYMENT_MODES.includes(settings.payment_mode)) settings.payment_mode = DEFAULTS.payment_mode;
  settings.whatsapp_admin_number = normalizeWhatsAppNumber(settings.whatsapp_admin_number);
  settings.stacking_enabled = settings.subscription_stacking !== 'false';

  return settings;
}

async function getPaymentMode() {
  const settings = await getPaymentSettings();
  return settings.payment_mode;
}

/** True when `flow` ('manual' | 'razorpay') is currently accepting orders. */
function isFlowEnabled(activeMode, flow) {
  return activeMode === 'both' || activeMode === flow;
}

/**
 * Manual collection needs a UPI ID to show and a WhatsApp number to send the
 * screenshot to. Returns a list of human-readable problems (empty = ready).
 */
function validateManualConfig(settings) {
  const problems = [];
  if (!settings.upi_id) problems.push('UPI ID is not configured');
  else if (!isValidUpiId(settings.upi_id)) problems.push('Configured UPI ID is not a valid VPA');
  if (!settings.whatsapp_admin_number) problems.push('Admin WhatsApp number is not configured');
  return problems;
}

/**
 * Builds a UPI intent URI. The amount is always passed in by the caller from the
 * database — never from the browser — so the QR a customer scans cannot be
 * tampered with client-side.
 */
function buildUpiUri({ upiId, merchantName, amountRupees, note, currency = 'INR' }) {
  const params = new URLSearchParams();
  params.set('pa', upiId);
  params.set('pn', merchantName || 'Merchant');
  params.set('am', Number(amountRupees).toFixed(2));
  params.set('cu', currency);
  if (note) {
    // UPI apps are fussy about the note field; keep it short and alphanumeric.
    const clean = String(note).replace(/[^a-zA-Z0-9 ]/g, '').trim().slice(0, 50);
    if (clean) params.set('tn', clean);
  }
  // URLSearchParams encodes spaces as '+', which some UPI apps show literally.
  return `upi://pay?${params.toString().replace(/\+/g, '%20')}`;
}

/** Renders a UPI URI as a PNG data URL. Returns null rather than failing checkout. */
async function generateUpiQr(upiUri) {
  try {
    return await QRCode.toDataURL(upiUri, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: { dark: '#000000', light: '#FFFFFF' },
    });
  } catch (err) {
    console.error('generateUpiQr error:', err.message);
    return null;
  }
}

module.exports = {
  PAYMENT_MODES,
  PAYMENT_SETTING_KEYS,
  normalizeWhatsAppNumber,
  isValidUpiId,
  getPaymentSettings,
  getPaymentMode,
  isFlowEnabled,
  validateManualConfig,
  buildUpiUri,
  generateUpiQr,
};
