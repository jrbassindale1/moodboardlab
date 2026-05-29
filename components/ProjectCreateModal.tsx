import React, { useEffect, useState } from 'react';
import { X, FolderPlus } from 'lucide-react';
import type { CreateProjectPayload } from '../api';

interface ProjectCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (payload: CreateProjectPayload) => Promise<void>;
  isLoading?: boolean;
}

const ProjectCreateModal: React.FC<ProjectCreateModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
  isLoading = false,
}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
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
      await onCreateProject({ name: name.trim(), type: null, location: null, stage: null, brief: null });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={isLoading ? undefined : onClose}
      />

      <div className="relative bg-white w-full max-w-md shadow-xl">
        <div className="px-8 pt-8 pb-6 border-b border-gray-100">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
              <FolderPlus className="w-5 h-5 text-gray-700" />
            </div>
            <h2 className="text-xl font-mono uppercase tracking-widest">
              New Project
            </h2>
          </div>
          <p className="text-sm text-gray-500">
            Give the project a name to group your outputs together. You can also start with materials first — Moodboard Lab will create a project automatically when you generate your first output.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
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

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

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
