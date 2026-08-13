import axios from 'axios';

export function getPublicErrorMessage(err: any, fallback: string) {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    return data?.message || err.message || fallback;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

const publicAxios = axios.create({
  baseURL: typeof window !== 'undefined' ? '' : (process.env.BACKEND_URL || 'http://127.0.0.1:5000'),
  headers: { 'Content-Type': 'application/json' },
});

export interface Plan {
  id: number;
  name: string;
  price: number;
  regular_price: number | null;
  duration_days: number;
  max_devices: number;
  description: string;
  sort_order: number;
  offer_label: string | null;
  is_popular: boolean;
  is_best_value: boolean;
}

export interface Channel {
  id: number;
  name: string;
  logo_url: string;
  language: string;
  is_premium: boolean;
  is_featured: boolean;
  is_popular: boolean;
  category: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon_url: string;
  channel_count: number;
}

function normalizeCategory(cat: any): Category {
  return {
    ...cat,
    channel_count: typeof cat.channel_count === 'string' ? parseInt(cat.channel_count, 10) : cat.channel_count,
  };
}

export interface AppRelease {
  version: string;
  version_code: number;
  apk_url: string;
  file_size: string;
  release_notes: string[];
  minimum_android_version: string;
  force_update: boolean;
  created_at: string;
}

export interface WebsiteSettings {
  hero_title?: string;
  hero_subtitle?: string;
  support_whatsapp?: string;
  support_email?: string;
  upi_id?: string;
  payment_qr_url?: string;
  telegram_url?: string;
  apk_download_url?: string;
  stats_channels_count?: string;
  stats_categories_count?: string;
  stats_users_count?: string;
  app_name?: string;
  support_phone?: string;
}

export interface OrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  plan_name: string;
  customer_name: string;
  email: string;
  mobile: string;
}

export interface LicenseResult {
  license_key: string;
  plan_name: string;
  duration_days: number;
  max_devices: number;
  order_id: string;
}

export interface OrderStatus {
  order_id: string;
  status: string;
  plan_name: string;
  amount: number;
  currency: string;
  license_key: string | null;
  license_status: string | null;
  duration_days: number | null;
  max_devices: number | null;
}

export interface LicenseCheckResult {
  license_key: string;
  status: string;
  plan_name: string;
  duration_days: number;
  max_devices: number;
  devices_used: number;
  activated_at: string | null;
  expires_at: string | null;
}

const unwrap = (res: { data: { data: any } }) => res.data.data;

function normalizePlan(plan: any): Plan {
  return {
    ...plan,
    price: typeof plan.price === 'string' ? parseFloat(plan.price) : plan.price,
    regular_price: typeof plan.regular_price === 'string' ? parseFloat(plan.regular_price) : plan.regular_price,
  };
}

export const getPublicPlans = (): Promise<Plan[]> =>
  publicAxios.get('/api/public/plans').then(res => {
    const data = res.data.data as any[];
    // Filter out the 7-day plan (it's meant to be hidden for scratchcard only)
    return data.map(normalizePlan).filter(p => p.duration_days !== 7);
  });

function fixLogoUrl(url: string | null): string {
  if (!url) return '';
  if (url.includes('127.0.0.1') || url.includes('localhost')) {
    try {
      const u = new URL(url);
      return u.pathname + u.search;
    } catch {
      return url;
    }
  }
  return url;
}

export const getPopularChannels = (limit = 12): Promise<Channel[]> =>
  publicAxios.get(`/api/public/channels/popular?limit=${limit}`).then(unwrap).then(data => (data as any[]).map(c => ({...c, logo_url: fixLogoUrl(c.logo_url)}))) as Promise<Channel[]>;

export const getChannelPreview = (category?: string): Promise<Channel[]> => {
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  return publicAxios.get('/api/public/channels/preview' + qs).then(unwrap).then(data => (data as any[]).map(c => ({...c, logo_url: fixLogoUrl(c.logo_url)}))) as Promise<Channel[]>;
};

export const getCategories = (): Promise<Category[]> =>
  publicAxios.get('/api/public/categories').then(res => {
    const data = res.data.data as any[];
    return data.map(normalizeCategory);
  });

export const getAppDownload = (): Promise<AppRelease | null> =>
  publicAxios.get('/api/public/app/download').then(unwrap) as Promise<AppRelease | null>;

export const getWebsiteSettings = (): Promise<WebsiteSettings> =>
  publicAxios.get('/api/public/settings').then(unwrap) as Promise<WebsiteSettings>;

export const createOrder = (data: {
  plan_id: number;
  customer_name: string;
  email: string;
  mobile: string;
  offer_price?: number;
}): Promise<OrderResponse> =>
  publicAxios.post('/api/public/orders/create', data).then(unwrap) as Promise<OrderResponse>;

export const verifyPayment = (data: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<LicenseResult> =>
  publicAxios.post('/api/public/payments/verify', data).then(unwrap) as Promise<LicenseResult>;

export const getOrderStatus = (orderId: string): Promise<OrderStatus> =>
  publicAxios.get(`/api/public/payments/status/${orderId}`).then(unwrap) as Promise<OrderStatus>;

export const checkLicense = (data: { license_key: string }): Promise<LicenseCheckResult> =>
  publicAxios.post('/api/public/license/check', data).then(unwrap) as Promise<LicenseCheckResult>;

export interface OfferPlan {
  id: number;
  name: string;
  price: number;
  duration_days: number;
  max_devices: number;
}

export const getSevenDayOffer = (): Promise<OfferPlan> =>
  publicAxios.get('/api/public/offers/7day').then(unwrap) as Promise<OfferPlan>;
