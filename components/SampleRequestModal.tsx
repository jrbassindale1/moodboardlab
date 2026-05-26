import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Mail, X } from 'lucide-react';
import { submitSampleRequest } from '../api';
import type { MaterialOption } from '../types';

interface SampleRequestModalProps {
  mat: MaterialOption;
  onClose: () => void;
  accessToken?: string;
}

const PROJECT_TYPES = [
  'Residential',
  'Commercial',
  'Hospitality',
  'Education',
  'Healthcare',
  'Public / Civic',
  'Mixed Use',
  'Other',
];

const SampleRequestModal: React.FC<SampleRequestModalProps> = ({ mat, onClose, accessToken }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [projectType, setProjectType] = useState('');
  const [message, setMessage] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await submitSampleRequest(
        {
          brandId: mat.brandId ?? '',
          materialId: mat.id,
          materialName: mat.name,
          brandName: mat.brandName ?? '',
          requesterName: name.trim(),
          requesterEmail: email.trim(),
          requesterCompany: company.trim() || undefined,
          requesterRole: role.trim() || undefined,
          projectType: projectType || undefined,
          message: message.trim() || undefined,
        },
        accessToken,
      );
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-gray-600" />
            <span className="font-mono text-xs uppercase tracking-widest text-gray-700">
              Request Sample
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Material context */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-0.5">
            {mat.brandName}
          </p>
          <p className="font-display text-base uppercase tracking-wide">{mat.name}</p>
        </div>

        {submitted ? (
          <div className="px-6 py-12 text-center space-y-3">
            <div className="w-10 h-10 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto">
              <Mail className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="font-display text-lg uppercase tracking-wide">Request sent</p>
            <p className="font-sans text-sm text-gray-600 leading-relaxed">
              {mat.brandName} will be in touch with you about your sample request.
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2 bg-black text-white text-xs font-mono uppercase tracking-widest hover:bg-gray-900 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
                  Name <span className="text-gray-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-300 px-3 py-2 font-sans text-sm focus:outline-none focus:border-black bg-white"
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
                  Email <span className="text-gray-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 px-3 py-2 font-sans text-sm focus:outline-none focus:border-black bg-white"
                  placeholder="you@practice.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
                  Company
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full border border-gray-300 px-3 py-2 font-sans text-sm focus:outline-none focus:border-black bg-white"
                  placeholder="Architecture practice"
                />
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
                  Role
                </label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full border border-gray-300 px-3 py-2 font-sans text-sm focus:outline-none focus:border-black bg-white"
                  placeholder="Architect / Designer"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
                Project type
              </label>
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                className="w-full border border-gray-300 px-3 py-2 font-sans text-sm focus:outline-none focus:border-black bg-white"
              >
                <option value="">Select project type…</option>
                {PROJECT_TYPES.map((pt) => (
                  <option key={pt} value={pt}>{pt}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
                Message
              </label>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full border border-gray-300 px-3 py-2 font-sans text-sm focus:outline-none focus:border-black resize-none bg-white"
                placeholder="Any details about your project or sample requirements"
              />
            </div>

            {error && (
              <p className="font-sans text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex items-center justify-between pt-2">
              <p className="font-mono text-[9px] text-gray-400 uppercase tracking-widest">
                Sent directly to {mat.brandName}
              </p>
              <button
                type="submit"
                disabled={isSubmitting || !name.trim() || !email.trim()}
                className="px-6 py-2.5 bg-black text-white text-xs font-mono uppercase tracking-widest hover:bg-gray-900 transition-colors disabled:opacity-40"
              >
                {isSubmitting ? 'Sending…' : 'Send Request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default SampleRequestModal;
