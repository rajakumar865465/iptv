import { getWebsiteSettings } from '@/lib/publicApi';
import { MessageCircle, Mail, Phone, Clock, Key } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Support — NivaTV' };
export const dynamic = 'force-dynamic';

const COMMON_ISSUES = [
  { issue: 'License key not working', fix: 'Make sure you are copying the full key including dashes. Keys look like NVT-XXXX-XXXX-XXXX.' },
  { issue: 'Channels buffering or not loading', fix: 'Check your internet speed. Try switching from WiFi to mobile data or vice versa. If the issue persists, report the channel inside the app.' },
  { issue: 'Payment done but no license key', fix: 'Check your payment success page or visit the License Check page. If it\'s still missing, contact us with your transaction ID.' },
  { issue: 'App crashes on startup', fix: 'Make sure you have the latest APK installed. Download the latest version from our Download page.' },
  { issue: 'Device limit reached', fix: 'Your plan allows a limited number of devices. Log out from an old device inside the app or contact support.' },
];

export default async function SupportPage() {
  const settings = await getWebsiteSettings().catch(() =>({})) as Record<string, string>;

  const rawWhatsapp = settings.support_whatsapp;
  const whatsapp = (rawWhatsapp && rawWhatsapp !== '+919999999999') ? rawWhatsapp : '+919774401306';
  const email = settings.support_email;
  const telegram = settings.telegram_url;
  const phone = settings.support_phone;

  return (
    <div className="pt-24 pb-20 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-white mb-3">Support</h1>
          <p className="text-slate-400">We typically respond within a few hours. Choose the fastest way to reach us.</p>
        </div>

        {/* Contact options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-4 bg-green-600/10 border border-green-500/30 rounded-2xl p-5 hover:bg-green-600/15 transition-colors"
            >
              <MessageCircle className="w-8 h-8 text-green-400 shrink-0" />
              <div>
                <p className="text-white font-semibold">WhatsApp</p>
                <p className="text-slate-400 text-sm">{whatsapp}</p>
              </div>
            </a>
          )}

          {email && (
            <a
              href={`mailto:${email}`}
              className="flex items-center gap-4 bg-blue-600/10 border border-blue-500/30 rounded-2xl p-5 hover:bg-blue-600/15 transition-colors"
            >
              <Mail className="w-8 h-8 text-blue-400 shrink-0" />
              <div>
                <p className="text-white font-semibold">Email</p>
                <p className="text-slate-400 text-sm break-all">{email}</p>
              </div>
            </a>
          )}

          {telegram && (
            <a
              href={telegram}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-4 bg-sky-600/10 border border-sky-500/30 rounded-2xl p-5 hover:bg-sky-600/15 transition-colors"
            >
              <MessageCircle className="w-8 h-8 text-sky-400 shrink-0" />
              <div>
                <p className="text-white font-semibold">Telegram</p>
                <p className="text-slate-400 text-sm">Join our Telegram group</p>
              </div>
            </a>
          )}

          {phone && (
            <a
              href={`tel:${phone}`}
              className="flex items-center gap-4 bg-purple-600/10 border border-purple-500/30 rounded-2xl p-5 hover:bg-purple-600/15 transition-colors"
            >
              <Phone className="w-8 h-8 text-purple-400 shrink-0" />
              <div>
                <p className="text-white font-semibold">Phone / Call</p>
                <p className="text-slate-400 text-sm">{phone}</p>
              </div>
            </a>
          )}

          <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-5">
            <Clock className="w-8 h-8 text-slate-400 shrink-0" />
            <div>
              <p className="text-white font-semibold">Response Time</p>
              <p className="text-slate-400 text-sm">Usually within 2–4 hours</p>
            </div>
          </div>
        </div>

        {/* Common issues */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-6">Common Issues & Quick Fixes</h2>
          <div className="space-y-4">
            {COMMON_ISSUES.map(item => (
              <div key={item.issue} className="bg-white/5 border border-white/10 rounded-xl p-5">
                <p className="text-white font-semibold text-sm mb-1">❓ {item.issue}</p>
                <p className="text-slate-400 text-sm leading-relaxed">✅ {item.fix}</p>
              </div>
            ))}
          </div>
        </div>

        {/* License check CTA */}
        <div className="bg-gradient-to-r from-indigo-600/15 to-transparent border border-indigo-500/20 rounded-2xl p-6 flex items-center gap-4">
          <Key className="w-8 h-8 text-indigo-400 shrink-0" />
          <div>
            <p className="text-white font-semibold mb-1">Check Your License Status</p>
            <p className="text-slate-400 text-sm mb-3">Verify your license key, activation status and expiry date.</p>
            <Link href="/license" className="text-sm text-indigo-400 hover:text-blue-300 font-medium underline underline-offset-2">
              Go to License Check →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
