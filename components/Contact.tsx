import React from 'react';
import { Mail, MessageSquare, Phone } from 'lucide-react';

const Contact: React.FC = () => {
  return (
    <div className="w-full pt-24 pb-16 bg-white animate-in fade-in duration-700">
      <div className="max-w-screen-2xl mx-auto px-6 space-y-12">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 border border-black px-3 py-1">
            <span className="font-mono text-xs uppercase tracking-widest font-bold">Contact</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold uppercase tracking-tight">Talk to the team</h1>
          <p className="font-sans text-lg text-gray-700 max-w-3xl leading-relaxed">
            Reach out for support, data requests, or partnership questions. We respond quickly during business hours.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-gray-200 bg-white p-6 space-y-3">
            <div className="flex items-center gap-2 text-gray-800">
              <Mail className="w-5 h-5" />
              <span className="font-display uppercase text-sm">Email</span>
            </div>
            <a href="mailto:hello@moodboardlab.com" className="font-mono text-xs uppercase tracking-widest text-black hover:underline">
              hello@moodboardlab.com
            </a>
          </div>
          <div className="border border-gray-200 bg-white p-6 space-y-3">
            <div className="flex items-center gap-2 text-gray-800">
              <Phone className="w-5 h-5" />
              <span className="font-display uppercase text-sm">Phone</span>
            </div>
            <p className="font-sans text-sm text-gray-700">+44 (0)20 1234 5678</p>
            <p className="font-sans text-xs text-gray-500">Mon–Fri, 9:00–18:00 GMT</p>
          </div>
          <div className="border border-gray-200 bg-white p-6 space-y-3">
            <div className="flex items-center gap-2 text-gray-800">
              <MessageSquare className="w-5 h-5" />
              <span className="font-display uppercase text-sm">Support</span>
            </div>
            <p className="font-sans text-sm text-gray-700 leading-relaxed">
              Need account help or data removal? Email us with your workspace ID and a brief summary so we can respond
              faster.
            </p>
          </div>
        </section>

        <section className="border border-gray-200 bg-gray-50 p-6 space-y-4">
          <h3 className="font-display uppercase text-lg">What to include</h3>
          <ul className="list-disc list-inside font-sans text-gray-800 space-y-2 text-sm">
            <li>Your name and workspace or organization.</li>
            <li>How we can help—support, partnership, data access/deletion.</li>
            <li>Any relevant file links or screenshots (optional).</li>
          </ul>
        </section>
      </div>
    </div>
  );
};

export default Contact;
