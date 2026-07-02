import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms & Conditions — NivaTV' };

export default function TermsPage() {
  return (
    <div className="pt-24 pb-20 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-extrabold text-white mb-2">Terms & Conditions</h1>
        <p className="text-slate-500 text-sm mb-10">Last updated: June 2026</p>

        {[
          {
            title: '1. Acceptance of Terms',
            content: `By purchasing a license and using the NivaTV application, you agree to these Terms and Conditions. If you do not agree, do not use the service.`,
          },
          {
            title: '2. License Usage',
            content: `Each license key is for personal, non-commercial use only. You may not share, resell, or redistribute your license key. Violation will result in immediate license revocation without refund.`,
          },
          {
            title: '3. Device Limits',
            content: `Your license is valid for the number of devices specified in your plan. Using a license on more devices than permitted is a violation of these terms.`,
          },
          {
            title: '4. No Refund Policy',
            content: `Due to the digital nature of the product, we do not offer refunds once the license key has been delivered. If you experience technical issues, contact support before requesting a refund.`,
          },
          {
            title: '5. Service Availability',
            content: `We aim to maintain 99% channel availability. However, we cannot guarantee uninterrupted service. Channel availability may vary based on broadcaster decisions. In case of extended outages, we may extend license durations at our discretion.`,
          },
          {
            title: '6. Prohibited Use',
            content: `You may not use this service for unknown commercial redistribution, public screening, or in violation of copyright laws. The service is for private personal viewing only.`,
          },
          {
            title: '7. Account Suspension',
            content: `We reserve the right to suspend or revoke licenses without notice for violations of these terms, chargebacks, or fraud.`,
          },
          {
            title: '8. Changes to Terms',
            content: `We may update these terms at unknown time. Continued use of the service after changes constitutes acceptance of the new terms.`,
          },
          {
            title: '9. Governing Law',
            content: `These terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of Indian courts.`,
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
