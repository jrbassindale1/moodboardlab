import React from 'react';

const PrivacyPolicy: React.FC = () => {
  const effectiveDate = 'April 30, 2024';

  return (
    <div className="w-full pt-24 pb-16 bg-white animate-in fade-in duration-700">
      <div className="max-w-screen-2xl mx-auto px-6 space-y-12">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 border border-black px-3 py-1">
            <span className="font-mono text-xs uppercase tracking-widest font-bold">Privacy Policy</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold uppercase tracking-tight">How we handle data</h1>
          <p className="font-sans text-lg text-gray-700 max-w-3xl leading-relaxed">
            We collect the minimum data needed to run the Moodboard Lab experience. This page explains what we collect,
            how we use it, and your choices. This policy is effective as of {effectiveDate} and will be updated when
            practices change.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="border border-gray-200 bg-gray-50 p-6 space-y-3">
            <h3 className="font-display uppercase text-lg">What we collect</h3>
            <ul className="list-disc list-inside font-sans text-gray-800 space-y-2 text-sm">
              <li>Account basics: name, email, and workspace identifiers you provide.</li>
              <li>Usage analytics: page views, feature usage, performance events, IP addresses, and device info.</li>
              <li>Inputs and outputs: prompts, uploads, generated images, and project results you choose to store.</li>
              <li>Support interactions: messages and attachments you send to our team.</li>
            </ul>
          </div>
          <div className="border border-gray-200 bg-gray-50 p-6 space-y-3">
            <h3 className="font-display uppercase text-lg">How we use it</h3>
            <ul className="list-disc list-inside font-sans text-gray-800 space-y-2 text-sm">
              <li>Operate and improve the product experience, including quality and reliability of generated outputs.</li>
              <li>Secure accounts, prevent abuse, and maintain platform reliability.</li>
              <li>Provide support and respond to requests, including data access or deletion.</li>
              <li>Aggregate, anonymized analytics to guide roadmap decisions and performance tuning.</li>
              <li>Advertising with Google AdSense: serving ads, capping frequency, and measuring performance.</li>
            </ul>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="border border-gray-200 bg-white p-6 space-y-3">
            <h3 className="font-display uppercase text-lg">Cookies & ad technology</h3>
            <p className="font-sans text-gray-700 leading-relaxed text-sm">
              We and Google use cookies and similar identifiers to deliver and measure ads. Depending on your region you
              can choose personalized or non-personalized ads, or disable non-essential cookies through the consent
              banner and the “Privacy & Cookies” preference link. Ads may personalize using your activity on this site
              and across partner sites; you can also visit Google Ads Settings to manage ad personalization. Learn more
              in Google’s Ad Policies and how Google uses information from sites or apps that use their services.
            </p>
          </div>
          <div className="border border-gray-200 bg-white p-6 space-y-3">
            <h3 className="font-display uppercase text-lg">Sharing</h3>
            <ul className="list-disc list-inside font-sans text-gray-800 space-y-2 text-sm">
              <li>Service providers: hosting, storage, analytics, ads, and model/AI partners under contractual safeguards.</li>
              <li>Legal and safety: if required by law or to investigate abuse or security issues.</li>
              <li>Marketing: content you have allowed us to showcase (see “Using generated content”).</li>
              <li>We do not sell personal data.</li>
            </ul>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="border border-gray-200 bg-gray-50 p-6 space-y-3">
            <h3 className="font-display uppercase text-lg">Storage & retention</h3>
            <p className="font-sans text-gray-700 leading-relaxed text-sm">
              Project files, prompts, and renders are kept while your account remains active or until you delete them.
              Support records and access logs are retained for approximately 12 months to investigate issues and ensure
              security, after which they are either deleted or aggregated. If required by law or to resolve disputes,
              certain records may be kept longer. We regularly review data to ensure it is not held longer than needed.
            </p>
          </div>
          <div className="border border-gray-200 bg-gray-50 p-6 space-y-3">
            <h3 className="font-display uppercase text-lg">Using generated content</h3>
            <p className="font-sans text-gray-700 leading-relaxed text-sm">
              With your permission, we may store and feature prompts, uploads, and results for marketing showcases,
              case studies, or product education. We aim to anonymize or remove personal identifiers unless you approve
              attribution. You can opt out at any time via the “Privacy & Cookies” preferences or by contacting us; we
              process opt-outs and removal requests as quickly as possible, typically within 10 business days.
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="border border-gray-200 bg-white p-6 space-y-3">
            <h3 className="font-display uppercase text-lg">Your choices & rights</h3>
            <ul className="list-disc list-inside font-sans text-gray-800 space-y-2 text-sm">
              <li>Access, update, or delete your account data on request.</li>
              <li>Export your projects and renders at any time.</li>
              <li>Opt out of non-essential analytics and personalized ads through the consent banner or preferences link.</li>
              <li>Withdraw consent for marketing use of your content and request removal of prior showcases.</li>
            </ul>
          </div>
          <div className="border border-gray-200 bg-white p-6 space-y-3">
            <h3 className="font-display uppercase text-lg">Security</h3>
            <p className="font-sans text-gray-700 text-sm leading-relaxed">
              We use TLS for data in transit, access controls for production systems, and reputable cloud providers with
              encryption at rest. Access to production data is limited to authorized personnel for support and
              maintenance. If we learn of a security incident that affects your data, we will investigate and notify you
              when required.
            </p>
          </div>
        </section>

        <section className="border border-gray-200 bg-black text-white p-6 space-y-3">
          <h3 className="font-display uppercase text-lg">Contact & updates</h3>
          <p className="font-sans text-sm text-gray-200 leading-relaxed">
            Reach out via the contact page for data access or deletion requests, consent changes, or privacy questions.
            We respond promptly and aim to confirm completion of any removal request within 10 business days. We will
            post updates on this page for any material changes to the policy.
          </p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
