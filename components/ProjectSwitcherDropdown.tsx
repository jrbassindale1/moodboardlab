import React, { useEffect, useRef } from 'react';
import { Check, Plus, FolderOpen, Loader2 } from 'lucide-react';
import type { Project } from '../api';

interface ProjectSwitcherDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  currentProject: Project | null;
  onSelectProject: (project: Project) => void;
  onCreateNew: () => void;
  isLoading?: boolean;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

const ProjectSwitcherDropdown: React.FC<ProjectSwitcherDropdownProps> = ({
  isOpen,
  onClose,
  projects,
  currentProject,
  onSelectProject,
  onCreateNew,
  isLoading = false,
  anchorRef,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        anchorRef?.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose, anchorRef]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full right-0 mt-2 w-72 bg-white border border-gray-200 shadow-xl z-50"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
          Switch Project
        </h3>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="px-4 py-8 text-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-xs text-gray-400">Loading projects...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <FolderOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 mb-1">No projects yet</p>
          <p className="text-xs text-gray-400">Create your first project to get started</p>
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto">
          {projects.map((project) => {
            const isSelected = currentProject?.id === project.id;
            return (
              <button
                key={project.id}
                onClick={() => {
                  onSelectProject(project);
                  onClose();
                }}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${
                  isSelected ? 'bg-gray-50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm truncate ${isSelected ? 'font-semibold' : ''}`}>
                        {project.name}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-black flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {project.type && (
                        <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400">
                          {project.type}
                        </span>
                      )}
                      {project.type && project.location && (
                        <span className="text-gray-300">·</span>
                      )}
                      {project.location && (
                        <span className="text-[10px] text-gray-400 truncate">
                          {project.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">
                    {formatDate(project.updatedAt)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Create new button */}
      <div className="border-t border-gray-100">
        <button
          onClick={() => {
            onCreateNew();
            onClose();
          }}
          className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4 text-gray-400" />
          <span className="font-mono text-[11px] uppercase tracking-widest">New Project</span>
        </button>
      </div>
    </div>
  );
};

export default ProjectSwitcherDropdown;
