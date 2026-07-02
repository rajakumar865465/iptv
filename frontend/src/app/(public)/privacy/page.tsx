import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy Policy — NivaTV' };

export default function PrivacyPage() {
  return (
    <div className="pt-24 pb-20 px-4">
      <div className="max-w-3xl mx-auto prose prose-invert prose-slate max-w-none">
        <h1 className="text-4xl font-extrabold text-white mb-2">Privacy Policy</h1>
        <p className="text-slate-500 text-sm mb-10">Last updated: June 2026</p>

        {[
          {
            title: '1. Information We Collect',
            content: `When you purchase a plan, we collect your name, email address, and mobile number to deliver your license key and provide support. When you use the app, we collect your device ID to enforce license device limits. We do not collect browsing history, location, or contact lists.`,
          },
          {
            title: '2. How We Use Your Information',
            content: `We use your information to: deliver license keys, verify payments, provide customer support, and send important account notifications. We do not sell, rent, or share your personal information with third parties for marketing purposes.`,
          },
          {
            title: '3. Payment Security',
            content: `All payments are processed by Razorpay, a PCI DSS compliant payment gateway. We never store your card details, UPI credentials, or banking information on our servers.`,
          },
          {
            title: '4. Data Retention',
            content: `We retain your account data for the duration of your subscription and for a reasonable period afterward for support purposes. You may request deletion of your data by contacting our support team.`,
          },
          {
            title: '5. Cookies',
            content: `This website does not use tracking cookies. We use only essential session cookies required for the checkout process.`,
          },
          {
            title: '6. Third-Party Services',
            content: `We use Razorpay for payment processing. Their privacy policy governs how they handle your payment data. We do not use third-party advertising networks or analytics trackers on this website.`,
          },
          {
            title: '7. Your Rights',
            content: `You have the right to access, correct, or delete the personal information we hold about you. Contact our support team to make unknown such requests.`,
          },
          {
            title: '8. Contact',
            content: `For privacy-related concerns, contact us via the Support page. We will respond within 72 hours.`,
          },
        ].map(section => (
          <div key={section.title} className="mb-8">
            <h2 className="text-xl font-bold text-white mb-3">{section.title}</h2>
            <p className="text-slate-400 leading-relaxed">{section.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
