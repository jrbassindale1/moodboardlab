import React, { useEffect, useState } from 'react';
import { X, FolderPlus, MapPin } from 'lucide-react';
import type { ProjectType, ProjectStage, CreateProjectPayload } from '../api';

interface ProjectCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (payload: CreateProjectPayload) => Promise<void>;
  isLoading?: boolean;
}

const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: 'Residential', label: 'Residential' },
  { value: 'Commercial', label: 'Commercial' },
  { value: 'Education', label: 'Education' },
  { value: 'Mixed-Use', label: 'Mixed-Use' },
  { value: 'Cultural', label: 'Cultural' },
  { value: 'Landscape', label: 'Landscape' },
];

const PROJECT_STAGES: { value: ProjectStage; label: string }[] = [
  { value: 'Concept', label: 'Concept' },
  { value: 'Scheme', label: 'Scheme' },
  { value: 'Detailed', label: 'Detailed' },
  { value: 'Planning', label: 'Planning' },
];

const ProjectCreateModal: React.FC<ProjectCreateModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
  isLoading = false,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<ProjectType | null>(null);
  const [location, setLocation] = useState('');
  const [stage, setStage] = useState<ProjectStage | null>(null);
  const [brief, setBrief] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setType(null);
      setLocation('');
      setStage(null);
      setBrief('');
      setError(null);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, isLoading, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    try {
      await onCreateProject({
        name: name.trim(),
        type,
        location: location.trim() || null,
        stage,
        brief: brief.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={isLoading ? undefined : onClose}
      />

      {/* Modal */}
      <div className="relative bg-white w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
              <FolderPlus className="w-5 h-5 text-gray-700" />
            </div>
            <h2 className="text-xl font-mono uppercase tracking-widest">
              New Project
            </h2>
          </div>
          <p className="text-sm text-gray-500">
            Create a project to organize your moodboards and renders.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Name field */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-2">
              Project Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Riverside Apartments"
              className="w-full px-3 py-2 border border-gray-200 focus:outline-none focus:border-black font-sans text-sm"
              disabled={isLoading}
              autoFocus
            />
          </div>

          {/* Type chips */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-2">
              Project Type
            </label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(type === t.value ? null : t.value)}
                  disabled={isLoading}
                  className={`px-3 py-1.5 border font-mono text-[10px] uppercase tracking-widest transition-colors disabled:opacity-50 ${
                    type === t.value
                      ? 'border-black bg-black text-white'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Location field */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-2">
              Location
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., London, UK"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 focus:outline-none focus:border-black font-sans text-sm"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Stage chips */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-2">
              Design Stage
            </label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_STAGES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStage(stage === s.value ? null : s.value)}
                  disabled={isLoading}
                  className={`px-3 py-1.5 border font-mono text-[10px] uppercase tracking-widest transition-colors disabled:opacity-50 ${
                    stage === s.value
                      ? 'border-black bg-black text-white'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Brief textarea */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-2">
              Project Brief
            </label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Describe the project scope, goals, or key requirements..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 focus:outline-none focus:border-black font-sans text-sm resize-none"
              disabled={isLoading}
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 font-mono text-sm uppercase tracking-widest hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="flex-1 py-3 px-4 bg-black text-white font-mono text-sm uppercase tracking-widest hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectCreateModal;
