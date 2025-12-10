import React from 'react';

const TermsOfService: React.FC = () => {
  return (
    <div className="w-full pt-24 pb-16 bg-white animate-in fade-in duration-700">
      <div className="max-w-screen-2xl mx-auto px-6 space-y-12">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 border border-black px-3 py-1">
            <span className="font-mono text-xs uppercase tracking-widest font-bold">Terms of Service</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold uppercase tracking-tight">Your use of Moodboard Lab</h1>
          <p className="font-sans text-lg text-gray-700 max-w-3xl leading-relaxed">
            These terms outline how you can use the product, what you can expect from us, and the responsibilities on both
            sides. By using Moodboard Lab you agree to the points below.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="border border-gray-200 bg-gray-50 p-6 space-y-3">
            <h3 className="font-display uppercase text-lg">Use of service</h3>
            <ul className="list-disc list-inside font-sans text-gray-800 space-y-2 text-sm">
              <li>Keep your account credentials secure and do not share access.</li>
              <li>Do not misuse the service, interfere with others, or attempt to breach security.</li>
              <li>You are responsible for content you upload; ensure you have rights to use it.</li>
              <li>We may update or change features; we will aim to provide notice for material changes.</li>
            </ul>
          </div>
          <div className="border border-gray-200 bg-gray-50 p-6 space-y-3">
            <h3 className="font-display uppercase text-lg">Content & IP</h3>
            <ul className="list-disc list-inside font-sans text-gray-800 space-y-2 text-sm">
              <li>You retain ownership of your uploads and generated renders.</li>
              <li>We retain rights to the platform code, branding, and service assets.</li>
              <li>Limited license: we may process your content to operate and improve the service.</li>
            </ul>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="border border-gray-200 bg-white p-6 space-y-3">
            <h3 className="font-display uppercase text-lg">Availability & support</h3>
            <p className="font-sans text-gray-700 text-sm leading-relaxed">
              We work to maintain high availability but do not guarantee uptime. Planned maintenance will be communicated
              when possible. Support requests can be made through the contact page.
            </p>
          </div>
          <div className="border border-gray-200 bg-white p-6 space-y-3">
            <h3 className="font-display uppercase text-lg">Disclaimers & liability</h3>
            <p className="font-sans text-gray-700 text-sm leading-relaxed">
              The service is provided as-is. To the fullest extent permitted by law, we disclaim warranties of
              merchantability, fitness for a particular purpose, and non-infringement. Our liability is limited to the
              amount you paid for the service in the 3 months preceding any claim.
            </p>
          </div>
        </section>

        <section className="border border-gray-200 bg-black text-white p-6 space-y-3">
          <h3 className="font-display uppercase text-lg">Contact</h3>
          <p className="font-sans text-sm text-gray-200 leading-relaxed">
            Questions about these terms? Use the contact page to reach the team and we will respond promptly.
          </p>
        </section>
      </div>
    </div>
  );
};

export default TermsOfService;
