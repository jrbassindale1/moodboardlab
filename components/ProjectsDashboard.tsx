import React, { useState, useEffect, useRef } from 'react';
import { SignInButton } from '@clerk/clerk-react';
import { Plus, FolderOpen, Loader2, LogIn, MapPin } from 'lucide-react';
import { useAuth, isClerkAuthEnabled, isAuthBypassEnabled } from '../auth';
import { getProjects, type Project } from '../api';

interface ProjectsDashboardProps {
  onNavigate: (page: string) => void;
  onSelectProject: (project: Project) => void;
}

const ProjectsDashboard: React.FC<ProjectsDashboardProps> = ({ onNavigate, onSelectProject }) => {
  const { isAuthenticated, getAccessToken } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);
  const isPreviewMode = isAuthBypassEnabled && !isAuthenticated;
  const canAccess = isAuthenticated || isPreviewMode;

  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoading(false);
      setProjects([]);
      setError(null);
      hasFetchedRef.current = false;
      return;
    }

    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const fetchProjects = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = await getAccessToken();
        if (token) {
          const data = await getProjects(token);
          setProjects(data);
        }
      } catch (err) {
        console.error('Failed to fetch projects:', err);
        setError(err instanceof Error ? err.message : 'Failed to load projects');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, [isAuthenticated, getAccessToken]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return diffMins <= 1 ? 'Just now' : `${diffMins} minutes ago`;
      }
      return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (!canAccess) {
    return (
      <div className="w-full min-h-screen pt-20 bg-white">
        <div className="max-w-screen-lg mx-auto px-6 py-12 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
            <LogIn className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="font-display text-4xl font-bold uppercase tracking-tighter mb-4">
            Sign In Required
          </h1>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Sign in to view your projects and create new design workspaces.
          </p>
          {isClerkAuthEnabled ? (
            <SignInButton mode="modal">
              <button className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 transition-colors">
                <LogIn className="w-4 h-4" />
                Sign In
              </button>
            </SignInButton>
          ) : (
            <p className="text-gray-500 text-sm">Authentication not configured</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen pt-20 bg-white">
      <div className="max-w-screen-2xl mx-auto px-6 py-12 space-y-8">
        {isPreviewMode && (
          <div className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Preview mode: authentication is bypassed in this environment.
          </div>
        )}

        {/* Header */}
        <div className="border-b border-gray-200 pb-6">
          <h1 className="font-display text-5xl font-bold uppercase tracking-tighter">
            Projects
          </h1>
          <p className="text-gray-600 mt-2">
            Your design workspaces. Each project connects materials, renders, sustainability and precedents.
          </p>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* New Project Card */}
            <button
              onClick={() => onNavigate('project-create')}
              className="group border-2 border-dashed border-gray-300 p-6 flex flex-col items-center justify-center text-center min-h-[200px] hover:border-gray-400 hover:bg-gray-50 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4 group-hover:bg-gray-200 transition-colors">
                <Plus className="w-6 h-6 text-gray-400 group-hover:text-gray-600" />
              </div>
              <div className="font-mono text-[11px] tracking-widest uppercase text-gray-500 group-hover:text-gray-700">
                New Project
              </div>
            </button>

            {/* Project Cards */}
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => onSelectProject(project)}
                className="group border border-gray-200 p-0 text-left hover:border-black transition-colors overflow-hidden"
              >
                {/* Placeholder for cover image / palette strip */}
                <div className="h-24 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <FolderOpen className="w-8 h-8 text-gray-300" />
                </div>

                <div className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    {project.type && (
                      <span className="font-mono text-[8px] tracking-widest uppercase text-gray-400 bg-gray-100 px-1.5 py-0.5">
                        {project.type}
                      </span>
                    )}
                    {project.stage && (
                      <span className="font-mono text-[8px] tracking-widest uppercase text-gray-400">
                        {project.stage}
                      </span>
                    )}
                  </div>

                  <h3 className="font-display text-lg font-bold uppercase tracking-tight text-gray-900 mb-1 group-hover:text-black">
                    {project.name}
                  </h3>

                  {project.location && (
                    <div className="flex items-center gap-1 text-gray-400 mb-2">
                      <MapPin className="w-3 h-3" />
                      <span className="font-mono text-[10px]">{project.location}</span>
                    </div>
                  )}

                  <div className="font-mono text-[9px] text-gray-300">
                    Updated {formatDate(project.updatedAt)}
                  </div>
                </div>
              </button>
            ))}

            {/* Empty state */}
            {projects.length === 0 && !isLoading && (
              <div className="md:col-span-2 lg:col-span-3 xl:col-span-4 border border-dashed border-gray-300 p-8 text-center">
                <FolderOpen className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 mb-2">No projects yet</p>
                <p className="text-gray-400 text-sm mb-6">
                  Create your first project to start organising your design work.
                </p>
                <button
                  onClick={() => onNavigate('project-create')}
                  className="px-4 py-2 bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 transition-colors"
                >
                  Create Your First Project
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectsDashboard;
