import React from 'react';

const PrivacyPolicy: React.FC = () => {
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
            how we use it, and your choices.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="border border-gray-200 bg-gray-50 p-6 space-y-3">
            <h3 className="font-display uppercase text-lg">What we collect</h3>
            <ul className="list-disc list-inside font-sans text-gray-800 space-y-2 text-sm">
              <li>Account basics: name, email, and workspace identifiers you provide.</li>
              <li>Usage analytics: page views, feature usage, and performance events.</li>
              <li>Uploaded files and generated renders you choose to store in the app.</li>
              <li>Support interactions when you contact us for help.</li>
            </ul>
          </div>
          <div className="border border-gray-200 bg-gray-50 p-6 space-y-3">
            <h3 className="font-display uppercase text-lg">How we use it</h3>
            <ul className="list-disc list-inside font-sans text-gray-800 space-y-2 text-sm">
              <li>Operate and improve the product experience.</li>
              <li>Secure accounts, prevent abuse, and maintain platform reliability.</li>
              <li>Provide support and respond to requests.</li>
              <li>Aggregate, anonymized analytics to guide roadmap decisions.</li>
            </ul>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="border border-gray-200 bg-white p-6 space-y-3">
            <h3 className="font-display uppercase text-lg">Storage & retention</h3>
            <p className="font-sans text-gray-700 leading-relaxed text-sm">
              We keep project files and renders until you delete them or request removal. Analytics events are kept in
              aggregated form; raw events are retained for a limited window to debug performance and reliability issues.
            </p>
          </div>
          <div className="border border-gray-200 bg-white p-6 space-y-3">
            <h3 className="font-display uppercase text-lg">Your choices</h3>
            <ul className="list-disc list-inside font-sans text-gray-800 space-y-2 text-sm">
              <li>Access, update, or delete your account data on request.</li>
              <li>Export your projects and renders at any time.</li>
              <li>Opt out of non-essential analytics where available.</li>
              <li>Contact us to close your account and purge stored files.</li>
            </ul>
          </div>
        </section>

        <section className="border border-gray-200 bg-black text-white p-6 space-y-3">
          <h3 className="font-display uppercase text-lg">Questions?</h3>
          <p className="font-sans text-sm text-gray-200 leading-relaxed">
            Reach out via the contact page for data access or deletion requests. We respond promptly to privacy concerns
            and will confirm completion of any removal request.
          </p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
