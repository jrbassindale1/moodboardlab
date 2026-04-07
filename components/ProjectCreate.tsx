import React, { useState } from 'react';
import { ChevronLeft, Loader2 } from 'lucide-react';
import type { ProjectType, ProjectStage, ProjectEntryRoute, CreateProjectPayload } from '../api';

interface ProjectCreateProps {
  onNavigate: (page: string) => void;
  onCreateProject: (payload: CreateProjectPayload) => Promise<void>;
  isCreating: boolean;
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

const ENTRY_ROUTES: { value: ProjectEntryRoute; label: string; description: string }[] = [
  { value: 'materials', label: 'Materials', description: 'Start by selecting materials' },
  { value: 'sketch', label: 'Sketch', description: 'Upload a sketch to apply materials' },
  { value: 'place', label: 'Place', description: 'Start from a site or location' },
  { value: 'mood', label: 'Mood', description: 'Begin with a mood or atmosphere' },
];

const ProjectCreate: React.FC<ProjectCreateProps> = ({ onNavigate, onCreateProject, isCreating }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<ProjectType | null>(null);
  const [location, setLocation] = useState('');
  const [stage, setStage] = useState<ProjectStage | null>(null);
  const [brief, setBrief] = useState('');
  const [entryRoute, setEntryRoute] = useState<ProjectEntryRoute | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        entryRoute,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    }
  };

  return (
    <div className="min-h-screen bg-white pt-20">
      {/* Sub-header with back button */}
      <div className="border-b border-gray-200">
        <div className="max-w-screen-md mx-auto px-6 h-14 flex items-center">
          <button
            onClick={() => onNavigate('projects')}
            className="flex items-center gap-2 font-mono text-xs text-gray-500 hover:text-black transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Projects
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-screen-md mx-auto px-6 py-8">
        <h1 className="font-display text-3xl font-black uppercase tracking-tight text-gray-900 mb-2">
          New Project
        </h1>
        <p className="font-mono text-xs text-gray-500 mb-8">
          Create a project to group materials, renders, sustainability insights, and precedents together.
        </p>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Project Name */}
          <div>
            <label className="block font-mono text-[10px] tracking-widest uppercase text-gray-500 mb-2">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bristol Timber Housing Study"
              className="w-full px-4 py-3 border border-gray-200 font-mono text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-gray-400 transition-colors"
              maxLength={255}
              disabled={isCreating}
            />
          </div>

          {/* Project Type */}
          <div>
            <label className="block font-mono text-[10px] tracking-widest uppercase text-gray-500 mb-3">
              Project Type
            </label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(type === t.value ? null : t.value)}
                  disabled={isCreating}
                  className={`px-4 py-2 font-mono text-[10px] tracking-widest uppercase border transition-colors ${
                    type === t.value
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  } ${isCreating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block font-mono text-[10px] tracking-widest uppercase text-gray-500 mb-2">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Bristol, UK"
              className="w-full px-4 py-3 border border-gray-200 font-mono text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-gray-400 transition-colors"
              maxLength={255}
              disabled={isCreating}
            />
          </div>

          {/* Design Stage */}
          <div>
            <label className="block font-mono text-[10px] tracking-widest uppercase text-gray-500 mb-3">
              Design Stage
            </label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_STAGES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStage(stage === s.value ? null : s.value)}
                  disabled={isCreating}
                  className={`px-4 py-2 font-mono text-[10px] tracking-widest uppercase border transition-colors ${
                    stage === s.value
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  } ${isCreating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Brief */}
          <div>
            <label className="block font-mono text-[10px] tracking-widest uppercase text-gray-500 mb-2">
              Brief
            </label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="A short description of the project..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 font-mono text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-gray-400 transition-colors resize-none"
              disabled={isCreating}
            />
          </div>

          {/* Entry Route */}
          <div>
            <label className="block font-mono text-[10px] tracking-widest uppercase text-gray-500 mb-3">
              Start From
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {ENTRY_ROUTES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setEntryRoute(entryRoute === r.value ? null : r.value)}
                  disabled={isCreating}
                  className={`p-4 border text-left transition-colors ${
                    entryRoute === r.value
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  } ${isCreating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className={`font-mono text-[11px] tracking-widest uppercase font-bold mb-1 ${
                    entryRoute === r.value ? 'text-white' : 'text-gray-900'
                  }`}>
                    {r.label}
                  </div>
                  <div className={`font-mono text-[9px] ${
                    entryRoute === r.value ? 'text-gray-300' : 'text-gray-400'
                  }`}>
                    {r.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isCreating || !name.trim()}
              className={`w-full md:w-auto px-8 py-3 bg-black text-white font-mono text-[11px] tracking-widest uppercase transition-colors ${
                isCreating || !name.trim()
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-gray-900'
              }`}
            >
              {isCreating ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </span>
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

export default ProjectCreate;
