import React, { useMemo, useState } from 'react';
import { Lock, Mail, MessageSquare } from 'lucide-react';
import { trackEvent } from '../utils/analytics';

const Contact: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    workspace: '',
    message: '',
    honeypot: '',
  });
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showEmail, setShowEmail] = useState(false);

  const secureEmail = useMemo(() => {
    const user = 'jonathan';
    const domain = 'moodboard-lab.com';
    return `${user}@${domain}`;
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    setStatus('idle');
    setError(null);

    if (formData.honeypot) {
      setStatus('error');
      setError('Submission blocked. Please try again.');
      return;
    }

    if (!formData.message.trim()) {
      setStatus('error');
      setError('Please add a message before sending.');
      return;
    }

    const subject = encodeURIComponent(`Moodboard Lab inquiry from ${formData.name || 'anonymous'}`);
    const body = encodeURIComponent(
      `Workspace or organization: ${formData.workspace || '—'}\n` +
      `Reply-to email: ${formData.email || 'not provided'}\n\n` +
      `${formData.message.trim()}`
    );

    trackEvent('contact', {
      channel: 'contact_form',
      has_reply_email: Boolean(formData.email.trim()),
      has_workspace: Boolean(formData.workspace.trim()),
    });
    window.location.href = `mailto:${secureEmail}?subject=${subject}&body=${body}`;
    setStatus('success');
    setError(null);
  };

  return (
    <div className="w-full pt-24 pb-16 bg-white animate-in fade-in duration-700">
      <div className="max-w-screen-2xl mx-auto px-6 space-y-12">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 border border-black px-3 py-1">
            <span className="font-mono text-xs uppercase tracking-widest font-bold">Contact</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold uppercase tracking-tight">Talk to the team</h1>
          <p className="font-sans text-lg text-gray-700 max-w-3xl leading-relaxed">
            Reach out for support, data requests, or partnership questions. We respond quickly during business hours and keep our contact channel secured to reduce spam.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-gray-200 bg-white p-6 space-y-3">
            <div className="flex items-center gap-2 text-gray-800">
              <Mail className="w-5 h-5" />
              <span className="font-display uppercase text-sm">Email</span>
            </div>
            <div className="space-y-2">
              {showEmail ? (
                <a
                  href={`mailto:${secureEmail}`}
                  className="font-mono text-xs uppercase tracking-widest text-black underline-offset-4 hover:underline"
                >
                  {secureEmail}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowEmail(true)}
                  className="font-mono text-xs uppercase tracking-widest text-black underline-offset-4 hover:underline"
                >
                  Reveal secure email
                </button>
              )}
              <p className="font-sans text-xs text-gray-600 leading-relaxed">
                Email is obfuscated on load to limit automated scraping. Use the contact form to compose a message directly.
              </p>
            </div>
          </div>
          <div className="border border-gray-200 bg-white p-6 space-y-3">
            <div className="flex items-center gap-2 text-gray-800">
              <MessageSquare className="w-5 h-5" />
              <span className="font-display uppercase text-sm">Support</span>
            </div>
            <p className="font-sans text-sm text-gray-700 leading-relaxed">
              Need account help or data removal? Email us with your workspace ID and a brief summary so we can respond faster.
            </p>
          </div>
          <div className="border border-gray-200 bg-white p-6 space-y-3">
            <div className="flex items-center gap-2 text-gray-800">
              <Lock className="w-5 h-5" />
              <span className="font-display uppercase text-sm">Spam Control</span>
            </div>
            <p className="font-sans text-sm text-gray-700 leading-relaxed">
              The form below includes human-friendly validation and a hidden field that blocks automated submissions, helping to keep your inbox clean.
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="border border-gray-200 bg-gray-50 p-6 space-y-4 lg:col-span-1">
            <h3 className="font-display uppercase text-lg">What to include</h3>
            <ul className="list-disc list-inside font-sans text-gray-800 space-y-2 text-sm">
              <li>Your name and workspace or organization.</li>
              <li>How we can help—support, partnership, data access/deletion.</li>
              <li>Any relevant file links or screenshots (optional).</li>
            </ul>
            <p className="font-sans text-xs text-gray-600 leading-relaxed">
              Direct replies will always come from {secureEmail}. If you receive something different, please ignore it.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="border border-gray-200 bg-white p-6 space-y-4 lg:col-span-2" noValidate>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-1">
                <span className="font-display uppercase text-xs text-gray-700">Name</span>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  autoComplete="name"
                  className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="Your name"
                />
              </label>

              <label className="space-y-1">
                <span className="font-display uppercase text-xs text-gray-700">Reply email (optional)</span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
                  className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="you@example.com"
                />
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="font-display uppercase text-xs text-gray-700">Workspace or organization</span>
                <input
                  type="text"
                  name="workspace"
                  value={formData.workspace}
                  onChange={handleChange}
                  autoComplete="organization"
                  className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="Workspace name"
                />
              </label>
            </div>

            <label className="space-y-1 block">
              <span className="font-display uppercase text-xs text-gray-700">How can we help?</span>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
                minLength={10}
                className="w-full border border-gray-300 px-3 py-2 text-sm h-32 focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="Provide details so we can respond quickly"
              />
            </label>

            <label className="sr-only" aria-hidden="true">
              Do not fill this field if you are human
              <input
                type="text"
                name="honeypot"
                value={formData.honeypot}
                onChange={handleChange}
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
              />
            </label>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <div className="text-xs font-sans text-gray-600 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                <span>Spam-filtered: submissions are validated and include a hidden bot check.</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="bg-black text-white px-4 py-2 text-sm font-display uppercase tracking-widest hover:bg-gray-800 transition-colors"
                >
                  Compose email
                </button>
                {status === 'success' && (
                  <span className="text-xs font-sans text-green-700">Opening your email client…</span>
                )}
                {status === 'error' && error && (
                  <span className="text-xs font-sans text-red-700">{error}</span>
                )}
              </div>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default Contact;
