import React from 'react';
import Link from 'next/link';

export default function SEOContent() {
  return (
    <section className="py-16 sm:py-24 md:py-28 bg-[var(--color-surface)] border-t border-[var(--color-line)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-[var(--color-ink-muted)] text-base leading-relaxed space-y-8">

        <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[var(--color-ink)] mb-2">
          Watch Live TV on Your Android Phone — No Cable, No Setup
        </h2>
        <p>
          NivaTV is an Android app built specifically for Indian viewers who want to watch their favourite TV channels on a smartphone or tablet — without installing a dish, buying a set-top box, or paying high monthly cable bills. You get instant access to 500+ channels the moment you activate your license, covering news, entertainment, sports, devotional, and regional content.
        </p>

        <h3 className="text-xl font-bold text-[var(--color-ink)] mt-8 mb-2">Which Channels Are Available?</h3>
        <p>
          NivaTV carries a wide mix of Indian channels across every genre and language. Popular choices include <strong>Zee News</strong>, <strong>Sony TV</strong>, <strong>Sony Max</strong>, <strong>Colors TV</strong>, <strong>Star Sports</strong>, <strong>DD National</strong>, and <strong>MTV</strong>. Regional language viewers will find dedicated sections for Tamil, Telugu, Malayalam, Kannada, Bengali, Marathi, Punjabi, and Gujarati channels. The{' '}
          <Link href="/browse" className="text-brand-500 hover:text-brand-500 underline underline-offset-2">full channel list</Link>{' '}
          is updated regularly as new streams are added.
        </p>

        <h3 className="text-xl font-bold text-[var(--color-ink)] mt-8 mb-2">How Does the License Work?</h3>
        <p>
          Unlike cable TV, NivaTV uses a simple license key system. After you{' '}
          <Link href="/pricing" className="text-brand-500 hover:text-brand-500 underline underline-offset-2">choose a plan</Link>,
          your payment is processed through Razorpay (UPI, PhonePe, GPay, credit/debit cards). Within seconds you receive a unique key — enter it inside the app and you are live. There is no auto-renewal; your access lasts exactly as long as the plan you bought. When it expires you simply purchase a new plan at your convenience.
        </p>

        <h3 className="text-xl font-bold text-[var(--color-ink)] mt-8 mb-2">Watching IPL and Sports Live</h3>
        <p>
          Cricket fans can catch IPL, international matches, and domestic tournaments through NivaTV&apos;s sports channels. The app streams in the best quality your internet connection supports — most users on a stable 4G connection get HD quality with very low delay. If a stream drops mid-match, the app automatically switches to a backup source so you stay connected to the action.
        </p>

        <h3 className="text-xl font-bold text-[var(--color-ink)] mt-8 mb-2">Is It Safe to Install?</h3>
        <p>
          NivaTV is distributed as a direct APK download from our own servers — not through third-party sites. The APK is scanned before each release. When you install, Android may show a one-time &ldquo;Install from this source&rdquo; prompt — this is standard for any app installed outside the Play Store and does not mean the app is harmful. Our{' '}
          <Link href="/download" className="text-brand-500 hover:text-brand-500 underline underline-offset-2">download page</Link>{' '}
          includes a step-by-step installation guide so you can set it up in under five minutes.
        </p>

        <h3 className="text-xl font-bold text-[var(--color-ink)] mt-8 mb-2">NivaTV vs Cable TV vs OTT Platforms</h3>
        <p>
          A typical cable or DTH connection costs ₹250–₹600 per month and requires a technician visit to set up. Premium OTT apps charge separately per platform and rarely include live news or regional sports. NivaTV consolidates 500+ live channels — including genres most OTT platforms skip — into a single affordable license. No hardware required, no long-term contract, and no surprise charges. If you have any questions before buying,{' '}
          <Link href="/support" className="text-brand-500 hover:text-brand-500 underline underline-offset-2">our support team</Link>{' '}
          is available on WhatsApp.
        </p>

      </div>
    </section>
  );
}
