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
              <li>Follow applicable laws and avoid prohibited uses such as illegal content, harassment, or violating the rights of others.</li>
            </ul>
          </div>
          <div className="border border-gray-200 bg-gray-50 p-6 space-y-3">
            <h3 className="font-display uppercase text-lg">Content & IP</h3>
            <ul className="list-disc list-inside font-sans text-gray-800 space-y-2 text-sm">
              <li>You retain ownership of your uploads, prompts, and generated renders.</li>
              <li>We retain rights to the platform code, branding, and service assets.</li>
              <li>License to operate: you grant us a limited license to host, process, and display your content to operate, secure, and improve the service.</li>
              <li>Optional marketing license: with your consent, you grant us a revocable license to feature your prompts, uploads, or results for marketing or case studies. You can withdraw this permission at any time via privacy preferences or by contacting us.</li>
            </ul>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="border border-gray-200 bg-white p-6 space-y-3">
            <h3 className="font-display uppercase text-lg">Availability & support</h3>
            <p className="font-sans text-gray-700 text-sm leading-relaxed">
              We work to maintain high availability but do not guarantee uptime. Planned maintenance will be communicated
              when possible. Support requests can be made through the contact page. If we need to suspend or terminate access
              for misuse or safety, we will provide notice when reasonable.
            </p>
          </div>
          <div className="border border-gray-200 bg-white p-6 space-y-3">
            <h3 className="font-display uppercase text-lg">Disclaimers & liability</h3>
            <p className="font-sans text-gray-700 text-sm leading-relaxed">
              The service is provided as-is. To the fullest extent permitted by law, we disclaim warranties of
              merchantability, fitness for a particular purpose, and non-infringement. Our liability is limited to the
              amount you paid for the service in the 3 months preceding any claim. We are not liable for indirect,
              incidental, or consequential damages.
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="border border-gray-200 bg-gray-50 p-6 space-y-3">
            <h3 className="font-display uppercase text-lg">Removal & takedowns</h3>
            <p className="font-sans text-gray-700 text-sm leading-relaxed">
              We may remove or disable content that violates these terms, legal requirements, or someone else’s rights. You
              can request removal of your own content or opt out of marketing showcases through privacy preferences or by
              contacting us. We strive to respond within 10 business days.
            </p>
          </div>
          <div className="border border-gray-200 bg-gray-50 p-6 space-y-3">
            <h3 className="font-display uppercase text-lg">Governing law & updates</h3>
            <p className="font-sans text-gray-700 text-sm leading-relaxed">
              These terms are governed by the laws of your primary place of business unless otherwise required by local law.
              If we make material changes to these terms, we will post an updated version and, where appropriate, notify you
              before it takes effect. Continued use after updates means you accept the revised terms.
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
